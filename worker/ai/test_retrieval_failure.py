import logging
import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from models import AnalysisStatus
from worker.ai.pii_masker import PIIMasker
from worker.celery_app import (
    RetrievalError,
    _safe_retrieval_reason,
    fail_closed_on_retrieval_error,
    persist_retrieval_failure,
    retrieve_rag_context,
)


class _FakeAnalysis:
    def __init__(self):
        self.id = uuid.uuid4()
        self.status = AnalysisStatus.pending
        self.summary = None
        self.error_message = None
        self.model_name = "gemini-2.5-flash"
        self.generated_at = None


class _FakeDocument:
    def __init__(self):
        self.ai_analysis = {"flags": [{"matched_rule_id": "stale"}]}


def _pii_laden_error():
    return RuntimeError(
        "lookup failed for Client Jane Smith email jane.smith@example.com "
        "SSN 123-45-6789 account ACC-987654 text: guaranteed 25% returns"
    )


class TestSafeRetrievalReason(unittest.TestCase):
    def test_reason_is_exception_type_only(self):
        self.assertEqual(_safe_retrieval_reason(_pii_laden_error()), "RuntimeError")

    def test_reason_includes_cause_type_without_message(self):
        try:
            raise TimeoutError("pgvector timed out on Jane Smith") from ConnectionError(
                "dsn=client-jane"
            )
        except TimeoutError as exc:
            reason = _safe_retrieval_reason(exc)
        self.assertEqual(reason, "TimeoutError:ConnectionError")
        self.assertNotIn("Jane", reason)
        self.assertNotIn("client-jane", reason)


class TestRetrieveRagContext(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.db = MagicMock()
        self.masker = PIIMasker()
        self.embeddings = [[0.1, 0.2, 0.3]]

    async def test_rule_retrieval_failure_raises_stage_rules(self):
        with (
            patch(
                "worker.celery_app.retrieve_rules_for_document",
                new=AsyncMock(side_effect=_pii_laden_error()),
            ),
            patch(
                "worker.celery_app.find_missing_disclosures",
                new=AsyncMock(),
            ) as disclosure_mock,
            patch(
                "worker.celery_app.retrieve_precedents",
                new=AsyncMock(),
            ) as precedent_mock,
        ):
            with self.assertRaises(RetrievalError) as ctx:
                await retrieve_rag_context(self.db, self.embeddings, self.masker)
        self.assertEqual(ctx.exception.stage, "rules")
        self.assertEqual(ctx.exception.reason, "RuntimeError")
        disclosure_mock.assert_not_called()
        precedent_mock.assert_not_called()

    async def test_disclosure_retrieval_failure_raises_stage_disclosures(self):
        with (
            patch(
                "worker.celery_app.retrieve_rules_for_document",
                new=AsyncMock(return_value=[]),
            ),
            patch(
                "worker.celery_app.find_missing_disclosures",
                new=AsyncMock(side_effect=OSError("index unavailable")),
            ),
            patch(
                "worker.celery_app.retrieve_precedents",
                new=AsyncMock(),
            ) as precedent_mock,
        ):
            with self.assertRaises(RetrievalError) as ctx:
                await retrieve_rag_context(self.db, self.embeddings, self.masker)
        self.assertEqual(ctx.exception.stage, "disclosures")
        self.assertEqual(ctx.exception.reason, "OSError")
        precedent_mock.assert_not_called()

    async def test_precedent_retrieval_failure_raises_stage_precedents(self):
        with (
            patch(
                "worker.celery_app.retrieve_rules_for_document",
                new=AsyncMock(return_value=[]),
            ),
            patch(
                "worker.celery_app.find_missing_disclosures",
                new=AsyncMock(return_value=[]),
            ),
            patch(
                "worker.celery_app.retrieve_precedents",
                new=AsyncMock(side_effect=ConnectionError("pgvector down")),
            ),
        ):
            with self.assertRaises(RetrievalError) as ctx:
                await retrieve_rag_context(self.db, self.embeddings, self.masker)
        self.assertEqual(ctx.exception.stage, "precedents")
        self.assertEqual(ctx.exception.reason, "ConnectionError")

    async def test_successful_retrieval_returns_context_for_normal_analysis(self):
        rules = [
            SimpleNamespace(rule_key="RULE_FINRA_2210_NO_GUARANTEES", rule_type="PROHIBITED", text="no guarantees")
        ]
        missing = [
            SimpleNamespace(rule_key="RULE_DISCLOSURE_PAST_PERFORMANCE", text="past performance", closest_distance=0.9)
        ]
        precedents = [
            SimpleNamespace(decision="reject", comment="Client Jane Smith was rejected", distance=0.12)
        ]
        with (
            patch(
                "worker.celery_app.retrieve_rules_for_document",
                new=AsyncMock(return_value=rules),
            ) as rules_mock,
            patch(
                "worker.celery_app.find_missing_disclosures",
                new=AsyncMock(return_value=missing),
            ) as disclosure_mock,
            patch(
                "worker.celery_app.retrieve_precedents",
                new=AsyncMock(return_value=precedents),
            ) as precedent_mock,
        ):
            rules_context, missing_disclosures, retrieved_precedents = await retrieve_rag_context(
                self.db, self.embeddings, self.masker
            )

        rules_mock.assert_awaited_once()
        disclosure_mock.assert_awaited_once()
        precedent_mock.assert_awaited_once()
        self.assertEqual(rules_context[0]["id"], "RULE_FINRA_2210_NO_GUARANTEES")
        self.assertEqual(missing_disclosures[0]["id"], "RULE_DISCLOSURE_PAST_PERFORMANCE")
        self.assertEqual(retrieved_precedents[0]["decision"], "reject")
        self.assertNotIn("Jane Smith", retrieved_precedents[0]["comment"])
        self.assertIn("[CLIENT_1]", retrieved_precedents[0]["comment"])


class TestRetrievalFailurePersistenceAndLogging(unittest.IsolatedAsyncioTestCase):
    async def test_persist_status_reason_no_flags_and_safe_logging(self):
        ai_record = _FakeAnalysis()
        doc = _FakeDocument()
        db = MagicMock()
        db.execute = AsyncMock()
        db.commit = AsyncMock()
        retrieval_err = RetrievalError("rules", "RuntimeError")
        analyze_fn = MagicMock()

        with self.assertLogs("worker.celery_app", level="ERROR") as logs:
            result = await fail_closed_on_retrieval_error(
                db, "doc-123", ai_record, doc, retrieval_err
            )

        analyze_fn.assert_not_called()
        db.execute.assert_awaited()
        db.commit.assert_awaited_once()
        self.assertEqual(result["status"], "error")
        self.assertEqual(result["error_type"], "retrieval_failed")
        self.assertEqual(result["failed_stage"], "rules")
        self.assertEqual(ai_record.status, AnalysisStatus.error)
        self.assertEqual(ai_record.error_message, "retrieval_failed:stage=rules:reason=RuntimeError")
        self.assertIn("manual review", ai_record.summary.lower())
        self.assertTrue(doc.ai_analysis["degraded"])
        self.assertEqual(doc.ai_analysis["flags"], [])
        self.assertEqual(doc.ai_analysis["failed_stage"], "rules")
        self.assertTrue(doc.ai_analysis["manual_review_required"])

        joined_logs = "\n".join(logs.output)
        self.assertIn("skipping LLM analysis", joined_logs)
        self.assertIn("stage=rules", joined_logs)
        self.assertIn("doc-123", joined_logs)
        self.assertNotIn("Jane Smith", joined_logs)
        self.assertNotIn("jane.smith@example.com", joined_logs)
        self.assertNotIn("123-45-6789", joined_logs)
        self.assertNotIn("ACC-987654", joined_logs)
        self.assertNotIn("guaranteed 25%", joined_logs)

    def test_persisted_payload_never_includes_pii_from_exception_text(self):
        ai_record = _FakeAnalysis()
        doc = _FakeDocument()
        payload = persist_retrieval_failure(
            ai_record, doc, RetrievalError("disclosures", _safe_retrieval_reason(_pii_laden_error()))
        )
        serialized = str(payload) + str(ai_record.error_message)
        self.assertNotIn("Jane Smith", serialized)
        self.assertNotIn("jane.smith@example.com", serialized)
        self.assertNotIn("123-45-6789", serialized)
        self.assertIn("stage=disclosures", ai_record.error_message)


class TestLlmNotCalledAfterRetrievalFailure(unittest.IsolatedAsyncioTestCase):
    async def test_pipeline_skips_llm_and_flag_inserts_on_each_stage(self):
        stages = ("rules", "disclosures", "precedents")
        for stage in stages:
            with self.subTest(stage=stage):
                ai_record = _FakeAnalysis()
                doc = _FakeDocument()
                db = MagicMock()
                db.execute = AsyncMock()
                db.commit = AsyncMock()
                db.add = MagicMock()
                analyze_fn = MagicMock()

                async def run_stage():
                    side_effects = {
                        "rules": {"rules": _pii_laden_error()},
                        "disclosures": {"disclosures": OSError("down")},
                        "precedents": {"precedents": ConnectionError("down")},
                    }
                    kwargs = {
                        "rules": AsyncMock(return_value=[]),
                        "disclosures": AsyncMock(return_value=[]),
                        "precedents": AsyncMock(return_value=[]),
                    }
                    for name, exc in side_effects[stage].items():
                        kwargs[name] = AsyncMock(side_effect=exc)
                    with (
                        patch("worker.celery_app.retrieve_rules_for_document", new=kwargs["rules"]),
                        patch("worker.celery_app.find_missing_disclosures", new=kwargs["disclosures"]),
                        patch("worker.celery_app.retrieve_precedents", new=kwargs["precedents"]),
                    ):
                        try:
                            await retrieve_rag_context(db, [[0.1]], PIIMasker())
                        except RetrievalError as err:
                            analyze_fn.assert_not_called()
                            return await fail_closed_on_retrieval_error(
                                db, str(uuid.uuid4()), ai_record, doc, err
                            )
                    analyze_fn("should not run")
                    return None

                with self.assertLogs("worker.celery_app", level="ERROR"):
                    result = await run_stage()

                analyze_fn.assert_not_called()
                db.add.assert_not_called()
                self.assertEqual(result["failed_stage"], stage)
                self.assertEqual(doc.ai_analysis["flags"], [])
                self.assertEqual(ai_record.status, AnalysisStatus.error)

    async def test_successful_retrieval_invokes_llm_callable(self):
        analyze_fn = MagicMock(return_value={"summary": "ok", "flags": [], "degraded": False})
        rules = [SimpleNamespace(rule_key="RULE_A", rule_type="PROHIBITED", text="t")]
        with (
            patch(
                "worker.celery_app.retrieve_rules_for_document",
                new=AsyncMock(return_value=rules),
            ),
            patch(
                "worker.celery_app.find_missing_disclosures",
                new=AsyncMock(return_value=[]),
            ),
            patch(
                "worker.celery_app.retrieve_precedents",
                new=AsyncMock(return_value=[]),
            ),
        ):
            rules_context, missing_disclosures, precedents = await retrieve_rag_context(
                MagicMock(), [[0.1]], PIIMasker()
            )
            analysis = analyze_fn(
                "masked",
                {},
                rules_context,
                missing_disclosures,
                precedents,
            )

        analyze_fn.assert_called_once()
        self.assertEqual(analysis["summary"], "ok")
        self.assertEqual(analyze_fn.call_args.args[2][0]["id"], "RULE_A")


class TestLogRecordsRejectDocumentBody(unittest.TestCase):
    def test_logger_error_format_does_not_accept_document_kwargs(self):
        logger = logging.getLogger("worker.celery_app")
        retrieval_err = RetrievalError("rules", "OperationalError")
        with self.assertLogs("worker.celery_app", level="ERROR") as logs:
            logger.error(
                "RAG retrieval failed; skipping LLM analysis document_id=%s stage=%s error_type=%s",
                "11111111-1111-1111-1111-111111111111",
                retrieval_err.stage,
                retrieval_err.reason,
            )
        self.assertEqual(len(logs.records), 1)
        self.assertNotIn("passage", logs.records[0].getMessage())
        self.assertNotIn("prompt", logs.records[0].getMessage())
        self.assertNotIn("masked_text", logs.records[0].getMessage())


if __name__ == "__main__":
    unittest.main()
