import json
import unittest

from worker.ai.gemini_assist import GeminiAssistEngine
from worker.ai.pii_masker import PIIMasker
from worker.ai.rules_corpus import get_default_rules, COMPLIANCE_RULES_CORPUS


class TestPIIMasker(unittest.TestCase):
    def setUp(self):
        self.masker = PIIMasker()
        self.engine = GeminiAssistEngine(api_key=None)

    def test_email_masking(self):
        text = "Contact Jane Smith at jane.smith@example.com for details."
        masked, mapping = self.masker.mask(text)
        self.assertNotIn("jane.smith@example.com", masked)
        self.assertIn("[EMAIL_1]", masked)
        self.assertEqual(mapping.get("[EMAIL_1]"), "jane.smith@example.com")
        self.assertEqual(self.masker.unmask(masked, mapping), text)

    def test_phone_masking(self):
        text = "Call 555-123-4567 or +1 (800) 555-9999 today."
        masked, mapping = self.masker.mask(text)
        self.assertNotIn("555-123-4567", masked)
        self.assertIn("[PHONE_", masked)
        self.assertEqual(self.masker.unmask(masked, mapping), text)

    def test_account_and_ssn_masking(self):
        text = "Account ACC-987654 and SSN 123-45-6789 need review."
        masked, mapping = self.masker.mask(text)
        self.assertNotIn("ACC-987654", masked)
        self.assertNotIn("123-45-6789", masked)
        self.assertIn("[ACCOUNT_", masked)
        self.assertEqual(self.masker.unmask(masked, mapping), text)

    def test_currency_amount_masking(self):
        text = "Transfer amount of $250,000.00 is requested."
        masked, mapping = self.masker.mask(text)
        self.assertNotIn("$250,000.00", masked)
        self.assertIn("[AMOUNT_1]", masked)
        self.assertEqual(self.masker.unmask(masked, mapping), text)

    def test_client_name_masking(self):
        text = "Client Jane Smith has requested an account update."
        masked, mapping = self.masker.mask(text)
        self.assertNotIn("Jane Smith", masked)
        self.assertIn("[CLIENT_1]", masked)

    def test_outbound_payload_privacy_proof(self):
        """Verifies that the outbound API payload carries 0 real PII values."""
        sample_doc = (
            "Client John Doe (john.doe@northstar.com, 555-987-6543) guarantees "
            "a 15% return on Account ACC-54321 with $500,000.00 invested."
        )
        payload, mapping = self.engine.get_outbound_payload(sample_doc)
        payload_str = json.dumps(payload)

        # Assert no real PII appears in the outbound JSON
        self.assertNotIn("john.doe@northstar.com", payload_str)
        self.assertNotIn("555-987-6543", payload_str)
        self.assertNotIn("ACC-54321", payload_str)
        self.assertNotIn("$500,000.00", payload_str)
        self.assertIn("[CLIENT_1]", payload_str)
        self.assertIn("[EMAIL_1]", payload_str)
        self.assertIn("[PHONE_1]", payload_str)
        self.assertIn("[ACCOUNT_1]", payload_str)
        self.assertIn("[AMOUNT_1]", payload_str)

    def test_graceful_degradation(self):
        """Verifies that with missing API key, the assist engine degrades gracefully."""
        res = self.engine.analyze_document("Sample text without LLM API key.")
        self.assertTrue(res.get("degraded"))
        self.assertIn("unavailable", res.get("summary", ""))

    def test_repeated_entity_consistency(self):
        """Verifies that the same PII entity receives the same placeholder consistently."""
        text = "Advisor Alice Wonder met with Client Bob Hope. Later, Client Bob Hope called Advisor Alice Wonder."
        masked, mapping = self.masker.mask(text)
        self.assertEqual(masked.count("[CLIENT_1]"), 2)
        self.assertEqual(masked.count("[CLIENT_2]"), 2)
        unmasked = self.masker.unmask(masked, mapping)
        self.assertEqual(unmasked, text)

    def test_multiple_distinct_entities(self):
        """Verifies numbering increments for distinct entities."""
        text = "Emails: alice@firm.com, bob@client.com, charlie@advisory.org"
        masked, mapping = self.masker.mask(text)
        self.assertIn("[EMAIL_1]", masked)
        self.assertIn("[EMAIL_2]", masked)
        self.assertIn("[EMAIL_3]", masked)
        self.assertEqual(len(mapping), 3)

    def test_structured_flag_schema_validation(self):
        """Verifies that flag format strictly adheres to traceable flag requirements."""
        flag = {
            "passage": "We guarantee 20% annual returns.",
            "matched_rule_id": "RULE_FINRA_2210_NO_GUARANTEES",
            "severity": "HIGH",
            "explanation": "Guarantees of investment returns are prohibited under FINRA Rule 2210."
        }
        self.assertIn("passage", flag)
        self.assertIn("matched_rule_id", flag)
        self.assertIn("severity", flag)
        self.assertIn("explanation", flag)
        self.assertIn(flag["severity"], ["HIGH", "MEDIUM", "LOW"])


if __name__ == "__main__":
    unittest.main()

