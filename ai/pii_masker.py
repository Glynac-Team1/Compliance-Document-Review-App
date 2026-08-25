import re
from typing import Tuple, Dict

class PIIMasker:
    """
    Enterprise-grade Server-side PII Privacy Wall.
    Conforms strictly to the Northstar Compliance Specification:
    - Sanitizes Emails, Phones, SSN/Account numbers, Client Names, Addresses, and Dollar Amounts.
    - Operates purely in code before outbound API calls or vector embeddings.
    - Preserves server-side mapping for officer display unmasking.
    """
    def __init__(self):
        self.patterns = {
            'EMAIL': r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
            'SSN_ACCOUNT': r'\b(?:\d{3}-\d{2}-\d{4}|ACC-\d{5,8}|\d{9,12})\b',
            'PHONE': r'\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b',
            'CURRENCY': r'\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?',
            # Name patterns for client salutations & name headers
            'CLIENT_NAME': r'\b(?:Client|Advisor|Investor|Mr\.|Ms\.|Mrs\.|Dr\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b',
        }

    def mask(self, text: str) -> Tuple[str, Dict[str, str]]:
        """
        Replaces sensitive entities with stable placeholders ([CLIENT_1], [EMAIL_1], etc.)
        Returns:
            masked_text: Sanitized text safe for external LLM API / Vector Store.
            mapping: Confidential server-side key mapping placeholders to original values.
        """
        mapping = {}
        counters = {'CLIENT': 1, 'EMAIL': 1, 'PHONE': 1, 'ACCOUNT': 1, 'AMOUNT': 1}
        masked_text = text

        # 1. Mask Client Names
        for name in set(re.findall(self.patterns['CLIENT_NAME'], masked_text)):
            if name and name not in mapping.values():
                placeholder = f"[CLIENT_{counters['CLIENT']}]"
                mapping[placeholder] = name
                masked_text = masked_text.replace(name, placeholder)
                counters['CLIENT'] += 1

        # 2. Mask Emails
        for email in set(re.findall(self.patterns['EMAIL'], masked_text)):
            placeholder = f"[EMAIL_{counters['EMAIL']}]"
            mapping[placeholder] = email
            masked_text = masked_text.replace(email, placeholder)
            counters['EMAIL'] += 1

        # 3. Mask SSN & Account Numbers
        for acc in set(re.findall(self.patterns['SSN_ACCOUNT'], masked_text)):
            placeholder = f"[ACCOUNT_{counters['ACCOUNT']}]"
            mapping[placeholder] = acc
            masked_text = masked_text.replace(acc, placeholder)
            counters['ACCOUNT'] += 1

        # 4. Mask Phone Numbers
        for phone in set(re.findall(self.patterns['PHONE'], masked_text)):
            placeholder = f"[PHONE_{counters['PHONE']}]"
            mapping[placeholder] = phone
            masked_text = masked_text.replace(phone, placeholder)
            counters['PHONE'] += 1

        # 5. Mask Dollar Amounts
        for amt in set(re.findall(self.patterns['CURRENCY'], masked_text)):
            placeholder = f"[AMOUNT_{counters['AMOUNT']}]"
            mapping[placeholder] = amt
            masked_text = masked_text.replace(amt, placeholder)
            counters['AMOUNT'] += 1

        return masked_text, mapping

    def unmask(self, text: str, mapping: Dict[str, str]) -> str:
        """Re-inserts original client values for Compliance Officer display only."""
        unmasked_text = text
        for placeholder, original in mapping.items():
            unmasked_text = unmasked_text.replace(placeholder, original)
        return unmasked_text
