"""
Unit tests for multi-LLM provider fallback mechanisms (Gemini, OpenRouter, Groq).
Validates failover behavior, retry resilience, provider sequencing, and outbound privacy boundaries.
"""

import json
import unittest
from unittest.mock import MagicMock, patch

from worker.ai.gemini_assist import (
    DEFAULT_GEMINI_MODEL,
    DEFAULT_GROQ_MODEL,
    DEFAULT_OPENROUTER_MODEL,
    GeminiAssistEngine,
)
from worker.ai.schemas import Severity


class TestLLMFallbackEngine(unittest.TestCase):
    def setUp(self):
        self.sample_doc = (
            "Advisor John Smith (john@example.com) promises a 25% annual return on Account ACC-998811."
        )
        self.mock_json_response = json.dumps({
            "summary": "The document contains prohibited return guarantees.",
            "flags": [
                {
                    "passage": "promises a 25% annual return",
                    "matched_rule_id": "RULE_FINRA_2210_NO_GUARANTEES",
                    "severity": "HIGH",
                    "explanation": "Guarantees of investment returns are strictly prohibited.",
                }
            ],
        })

    def test_provider_initialization_and_chain(self):
        """Verifies default and customized fallback chains based on configured API keys."""
        # Only gemini key
        engine1 = GeminiAssistEngine(api_key="gemini_key", provider="gemini")
        self.assertEqual(engine1.provider, "gemini")
        self.assertEqual(engine1._get_provider_key("gemini"), "gemini_key")
        self.assertIsNone(engine1._get_provider_key("openrouter"))
        self.assertIsNone(engine1._get_provider_key("groq"))

        # Multi-key initialization
        engine2 = GeminiAssistEngine(
            api_key="gemini_key",
            provider="gemini",
            openrouter_api_key="or_key",
            groq_api_key="groq_key",
        )
        chain = engine2._get_fallback_chain()
        self.assertEqual(chain, ["gemini", "openrouter", "groq"])

        # Explicit fallback_providers override
        engine3 = GeminiAssistEngine(
            api_key="gemini_key",
            provider="gemini",
            openrouter_api_key="or_key",
            groq_api_key="groq_key",
            fallback_providers=["groq", "openrouter"],
        )
        self.assertEqual(engine3._get_fallback_chain(), ["gemini", "groq", "openrouter"])

    def test_openrouter_payload_structure(self):
        """Verifies OpenRouter payload format adheres to OpenAI chat completions schema."""
        engine = GeminiAssistEngine(
            openrouter_api_key="mock_or_key",
            provider="openrouter",
        )
        payload, mapping = engine.get_outbound_payload(self.sample_doc)
        self.assertEqual(payload["model"], DEFAULT_OPENROUTER_MODEL)
        self.assertIn("messages", payload)
        self.assertEqual(payload["messages"][0]["role"], "system")
        self.assertEqual(payload["messages"][1]["role"], "user")
        self.assertEqual(payload["response_format"], {"type": "json_object"})
        self.assertNotIn("john@example.com", json.dumps(payload))
        self.assertNotIn("ACC-998811", json.dumps(payload))

    def test_openrouter_call_success(self):
        """Tests successful direct analysis via OpenRouter."""
        engine = GeminiAssistEngine(
            openrouter_api_key="mock_or_key",
            provider="openrouter",
        )

        with patch.object(engine, "_call_openrouter_api", return_value=(self.mock_json_response, "google/gemini-2.5-flash")) as mock_call:
            result = engine.analyze_document(self.sample_doc)
            self.assertFalse(result["degraded"])
            self.assertEqual(result["provider"], "openrouter")
            self.assertEqual(result["model"], "google/gemini-2.5-flash")
            self.assertEqual(len(result["flags"]), 1)
            self.assertEqual(result["flags"][0]["matched_rule_id"], "RULE_FINRA_2210_NO_GUARANTEES")
            mock_call.assert_called_once()

    def test_failover_gemini_to_openrouter(self):
        """Verifies that when Gemini fails (e.g. 429 Rate Limit / HTTPError), failover to OpenRouter succeeds."""
        engine = GeminiAssistEngine(
            api_key="gemini_key",
            provider="gemini",
            openrouter_api_key="or_key",
        )

        with patch.object(engine, "_call_gemini_api", side_effect=RuntimeError("Gemini 429 Quota Exceeded")) as mock_gemini:
            with patch.object(engine, "_call_openrouter_api", return_value=(self.mock_json_response, "google/gemini-2.5-flash")) as mock_or:
                result = engine.analyze_document(self.sample_doc)

                mock_gemini.assert_called_once()
                mock_or.assert_called_once()
                self.assertFalse(result["degraded"])
                self.assertEqual(result["provider"], "openrouter")
                self.assertEqual(result["model"], "google/gemini-2.5-flash")
                self.assertEqual(len(result["flags"]), 1)

    def test_failover_multi_tier_gemini_to_openrouter_to_groq(self):
        """Verifies full 3-tier failover: Gemini fails -> OpenRouter fails -> Groq succeeds."""
        engine = GeminiAssistEngine(
            api_key="gemini_key",
            provider="gemini",
            openrouter_api_key="or_key",
            groq_api_key="groq_key",
        )

        with patch.object(engine, "_call_gemini_api", side_effect=RuntimeError("Gemini Service Unavailable")) as mock_gemini:
            with patch.object(engine, "_call_openrouter_api", side_effect=RuntimeError("OpenRouter Rate Limited")) as mock_or:
                with patch.object(engine, "_call_groq_api", return_value=(self.mock_json_response, "llama-3.3-70b-versatile")) as mock_groq:
                    result = engine.analyze_document(self.sample_doc)

                    mock_gemini.assert_called_once()
                    mock_or.assert_called_once()
                    mock_groq.assert_called_once()
                    self.assertFalse(result["degraded"])
                    self.assertEqual(result["provider"], "groq")
                    self.assertEqual(result["model"], "llama-3.3-70b-versatile")
                    self.assertEqual(len(result["flags"]), 1)

    def test_graceful_degradation_when_all_fail(self):
        """Verifies that when all providers fail, a structured degraded fallback response is returned."""
        engine = GeminiAssistEngine(
            api_key="gemini_key",
            provider="gemini",
            openrouter_api_key="or_key",
        )

        with patch.object(engine, "_call_gemini_api", side_effect=RuntimeError("Gemini Down")):
            with patch.object(engine, "_call_openrouter_api", side_effect=RuntimeError("OpenRouter Down")):
                result = engine.analyze_document(self.sample_doc)
                self.assertTrue(result["degraded"])
                self.assertEqual(result["provider"], "degraded_fallback")
                self.assertIn("category=", result["technical_error"])

    def test_openrouter_extract_text_variations(self):
        """Tests chat completion text extraction for standard string content and multi-part content list."""
        # Standard choice content string
        resp1 = {"choices": [{"message": {"content": "{\"summary\": \"Test\", \"flags\": []}"}}]}
        self.assertEqual(
            GeminiAssistEngine._extract_openrouter_text(resp1),
            "{\"summary\": \"Test\", \"flags\": []}",
        )

        # Multi-part list content
        resp2 = {"choices": [{"message": {"content": [{"text": "{\"summary\": \"Multi\""}]}}]}
        self.assertEqual(
            GeminiAssistEngine._extract_openrouter_text(resp2),
            "{\"summary\": \"Multi\"",
        )

        # Empty choices raises ValueError
        with self.assertRaises(ValueError):
            GeminiAssistEngine._extract_openrouter_text({"choices": []})

    def test_gemini_candidate_model_fallback_on_503(self):
        """Verifies that if primary Gemini model returns 503 or transient error, candidate models (e.g. gemini-2.5-flash) are tried."""
        import urllib.error
        engine = GeminiAssistEngine(api_key="gemini_key", provider="gemini")
        payload = {"contents": [{"parts": [{"text": "test"}]}]}

        def mock_execute(req, timeout=20):
            if "gemini-3.6-flash" in req.full_url:
                raise urllib.error.HTTPError(
                    url=req.full_url, code=503, msg="Service Unavailable", hdrs={}, fp=None
                )
            return {
                "candidates": [
                    {"content": {"parts": [{"text": self.mock_json_response}]}}
                ]
            }

        with patch("worker.ai.gemini_assist._execute_request_with_retry", side_effect=mock_execute):
            text, model = engine._call_gemini_api(payload)
            self.assertEqual(model, "gemini-2.5-flash")
            self.assertEqual(text, self.mock_json_response)


if __name__ == "__main__":
    unittest.main()
