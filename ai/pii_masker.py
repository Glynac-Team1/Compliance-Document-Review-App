import re

class PIIMasker:
    """
    Server-side PII Masker required by the Compliance Review specification.
    Ensures zero client PII (names, emails, phone numbers, account numbers, amounts) 
    reaches third-party LLM vendors or vector stores.
    """
    def __init__(self):
        self.patterns = {
            'EMAIL': r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
            'SSN_ACCOUNT': r'\b(?:\d{3}-\d{2}-\d{4}|ACC-\d{5,8}|\d{9,12})\b',
            'PHONE': r'\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b',
            'CURRENCY': r'\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?',
        }

    def mask(self, text: str):
        """
        Replaces PII with stable placeholders ([EMAIL_1], [ACCOUNT_1], etc.)
        Returns:
            masked_text (str): Sanitized text ready for LLM/Vector store.
            mapping (dict): Server-side dictionary mapping placeholders to original values.
        """
        mapping = {}
        counters = {'EMAIL': 1, 'PHONE': 1, 'ACCOUNT': 1, 'AMOUNT': 1}
        masked_text = text

        # 1. Mask Emails
        for email in set(re.findall(self.patterns['EMAIL'], masked_text)):
            placeholder = f"[EMAIL_{counters['EMAIL']}]"
            mapping[placeholder] = email
            masked_text = masked_text.replace(email, placeholder)
            counters['EMAIL'] += 1

        # 2. Mask SSN & Account Numbers
        for acc in set(re.findall(self.patterns['SSN_ACCOUNT'], masked_text)):
            placeholder = f"[ACCOUNT_{counters['ACCOUNT']}]"
            mapping[placeholder] = acc
            masked_text = masked_text.replace(acc, placeholder)
            counters['ACCOUNT'] += 1

        # 3. Mask Phone Numbers
        for phone in set(re.findall(self.patterns['PHONE'], masked_text)):
            placeholder = f"[PHONE_{counters['PHONE']}]"
            mapping[placeholder] = phone
            masked_text = masked_text.replace(phone, placeholder)
            counters['PHONE'] += 1

        # 4. Mask Dollar Amounts
        for amt in set(re.findall(self.patterns['CURRENCY'], masked_text)):
            placeholder = f"[AMOUNT_{counters['AMOUNT']}]"
            mapping[placeholder] = amt
            masked_text = masked_text.replace(amt, placeholder)
            counters['AMOUNT'] += 1

        return masked_text, mapping

    def unmask(self, text: str, mapping: dict) -> str:
        """Re-inserts original values for officer display only."""
        unmasked_text = text
        for placeholder, original in mapping.items():
            unmasked_text = unmasked_text.replace(placeholder, original)
        return unmasked_text
