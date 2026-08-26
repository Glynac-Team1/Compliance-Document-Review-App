import unittest

from worker.ai.pii_masker import PIIMasker


class TestPIIMasker(unittest.TestCase):
    def setUp(self):
        self.masker = PIIMasker()

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


if __name__ == "__main__":
    unittest.main()
