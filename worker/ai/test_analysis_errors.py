import unittest
import uuid

from models import AnalysisStatus
from app.core.analysis_errors import AnalysisErrorCode, get_user_facing_message
from worker.ai.gemini_assist import GeminiAssistEngine
from worker.celery_app import persist_analysis_failure


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
        result = GeminiAssistEngine(api_key=None).analyze_document("Document text")
        self.assertTrue(result["degraded"])
        self.assertEqual(result["error_code"], AnalysisErrorCode.LLM_FAILED.value)
        self.assertEqual(result["flags"], [])


if __name__ == "__main__":
    unittest.main()