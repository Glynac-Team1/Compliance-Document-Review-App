import unittest
import asyncio
import os
import socket
import urllib.error
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock
from unittest.mock import patch

from models import AnalysisStatus
from app.core.analysis_errors import AnalysisErrorCode, get_user_facing_message
from worker.ai.gemini_assist import (
    DEFAULT_GEMINI_MODEL,
    GeminiAssistEngine,
    LLMFailureCategory,
    LLMProviderError,
    _classify_provider_error,
    _gemini_candidate_models,
    _is_retryable_http_error,
)
from worker.celery_app import (
    ANALYSIS_TASK_MAX_RETRIES,
    ANALYSIS_TASK_RETRY_BASE_SECONDS,
    _analysis_retry_countdown,
    analyze_document,
    claim_analysis,
    persist_analysis_failure,
)


class _Analysis:
    id = uuid.uuid4()
    status = AnalysisStatus.pending
    summary = None
    error_message = None
    error_code = None
    user_facing_error = None
    technical_error = None
    model_name = None
    generated_at = None


class _Document:
    ai_analysis = None


class TestAnalysisErrors(unittest.TestCase):
    def test_error_messages_are_specific(self):
        self.assertIn("image-only", get_user_facing_message(AnalysisErrorCode.PDF_NO_TEXT))
        self.assertIn("retrieved", get_user_facing_message(AnalysisErrorCode.STORAGE_DOWNLOAD_FAILED))
        self.assertIn("reference data", get_user_facing_message(AnalysisErrorCode.RAG_RETRIEVAL_FAILED))
        self.assertNotIn("format or document structure", get_user_facing_message(AnalysisErrorCode.LLM_FAILED))

    def test_persist_failure_keeps_code_safe_message_and_technical_detail(self):
        analysis = _Analysis()
        document = _Document()
        payload = persist_analysis_failure(
            analysis, document, AnalysisErrorCode.PDF_CORRUPTED, "PDFSyntaxError: invalid xref table"
        )
        self.assertEqual(analysis.status, AnalysisStatus.error)
        self.assertEqual(analysis.error_code, AnalysisErrorCode.PDF_CORRUPTED.value)
        self.assertIn("corrupted", analysis.user_facing_error)
        self.assertEqual(analysis.technical_error, "PDFSyntaxError: invalid xref table")
        self.assertEqual(payload["error_code"], AnalysisErrorCode.PDF_CORRUPTED.value)
        self.assertNotIn("invalid xref table", payload["user_facing_error"])

    def test_llm_fallback_is_not_a_normal_analysis(self):
        with patch.dict(
            os.environ,
            {"LLM_API_KEY": "", "GEMINI_API_KEY": "", "GROQ_API_KEY": ""},
            clear=False,
        ):
            result = GeminiAssistEngine(api_key=None).analyze_document("Document text")
        self.assertTrue(result["degraded"])
        self.assertEqual(result["error_code"], AnalysisErrorCode.LLM_FAILED.value)
        self.assertEqual(result["flags"], [])

    def test_gemini_default_model_is_current_and_configurable(self):
        self.assertEqual(DEFAULT_GEMINI_MODEL, "gemini-3.6-flash")
        self.assertEqual(_gemini_candidate_models(), ["gemini-3.6-flash"])

    def test_network_timeouts_are_retryable(self):
        self.assertTrue(_is_retryable_http_error(TimeoutError("timed out")))
        self.assertTrue(_is_retryable_http_error(socket.timeout("read timed out")))
        self.assertTrue(_is_retryable_http_error(ConnectionError("reset")))

    def test_permanent_http_errors_are_not_retryable(self):
        error = urllib.error.HTTPError("https://provider.test", 401, "unauthorized", {}, None)
        self.assertFalse(_is_retryable_http_error(error))
        failure = _classify_provider_error(error, "gemini", "gemini-3.6-flash")
        self.assertEqual(failure.category, LLMFailureCategory.AUTHENTICATION)
        self.assertFalse(failure.retryable)

    def test_rate_limit_classification_is_safe_and_retryable(self):
        error = urllib.error.HTTPError("https://provider.test", 429, "rate limited", {}, None)
        failure = _classify_provider_error(error, "groq", "llama-3.3-70b-versatile")
        self.assertEqual(failure.category, LLMFailureCategory.RATE_LIMITED)
        self.assertTrue(failure.retryable)
        self.assertNotIn("rate limited", failure.safe_detail)
        self.assertEqual(
            failure.safe_detail,
            "category=rate_limited:provider=groq:model=llama-3.3-70b-versatile:status=429",
        )

    def test_transient_provider_exhaustion_marks_result_retryable(self):
        engine = GeminiAssistEngine(api_key="test-key", provider="gemini")
        with patch.object(
            engine,
            "_call_provider",
            side_effect=LLMProviderError(LLMFailureCategory.TRANSIENT, "gemini"),
        ):
            result = engine.analyze_masked_document("masked", {})
        self.assertTrue(result["degraded"])
        self.assertTrue(result["retryable"])

    def test_permanent_provider_failure_does_not_mark_result_retryable(self):
        engine = GeminiAssistEngine(api_key="test-key", provider="gemini")
        with patch.object(
            engine,
            "_call_provider",
            side_effect=LLMProviderError(LLMFailureCategory.AUTHENTICATION, "gemini"),
        ):
            result = engine.analyze_masked_document("masked", {})
        self.assertTrue(result["degraded"])
        self.assertFalse(result["retryable"])

    def test_celery_retry_budget_and_countdown_are_bounded(self):
        self.assertEqual(analyze_document.max_retries, ANALYSIS_TASK_MAX_RETRIES)
        for retry_number in range(ANALYSIS_TASK_MAX_RETRIES + 1):
            countdown = _analysis_retry_countdown(retry_number)
            self.assertGreaterEqual(countdown, ANALYSIS_TASK_RETRY_BASE_SECONDS)
            self.assertLessEqual(
                countdown,
                ANALYSIS_TASK_RETRY_BASE_SECONDS * (2 ** retry_number),
            )

    def test_analysis_claim_can_be_acquired_and_renewed_by_same_task(self):
        record = MagicMock(
            id=uuid.uuid4(),
            status=AnalysisStatus.pending,
            claim_token=None,
            claim_expires_at=None,
        )
        db = MagicMock()
        db.scalar = AsyncMock(return_value=record)
        db.commit = AsyncMock()

        self.assertTrue(asyncio.run(claim_analysis(db, record, "task-a")))
        self.assertEqual(record.claim_token, "task-a")
        self.assertTrue(asyncio.run(claim_analysis(db, record, "task-a")))
        self.assertEqual(db.commit.await_count, 2)

    def test_active_analysis_claim_rejects_other_task(self):
        record = MagicMock(
            id=uuid.uuid4(),
            status=AnalysisStatus.pending,
            claim_token="task-a",
            claim_expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
        )
        db = MagicMock()
        db.scalar = AsyncMock(return_value=record)
        db.commit = AsyncMock()

        async def check_claim():
            return await claim_analysis(db, record, "task-b")

        self.assertFalse(asyncio.run(check_claim()))
        db.commit.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
