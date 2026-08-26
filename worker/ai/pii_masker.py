import re


class PIIMasker:
    """Mask document PII before text reaches an external AI provider."""

    def __init__(self):
        self.patterns = {
            "EMAIL": r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
            "SSN_ACCOUNT": r"\b(?:\d{3}-\d{2}-\d{4}|ACC-\d{5,8}|\d{9,12})\b",
            "PHONE": r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b",
            "CURRENCY": r"\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?",
        }

    def mask(self, text: str) -> tuple[str, dict[str, str]]:
        mapping: dict[str, str] = {}
        counters = {"EMAIL": 1, "PHONE": 1, "ACCOUNT": 1, "AMOUNT": 1}
        masked_text = text

        for email in set(re.findall(self.patterns["EMAIL"], masked_text)):
            placeholder = f"[EMAIL_{counters['EMAIL']}]"
            mapping[placeholder] = email
            masked_text = masked_text.replace(email, placeholder)
            counters["EMAIL"] += 1

        for account in set(re.findall(self.patterns["SSN_ACCOUNT"], masked_text)):
            placeholder = f"[ACCOUNT_{counters['ACCOUNT']}]"
            mapping[placeholder] = account
            masked_text = masked_text.replace(account, placeholder)
            counters["ACCOUNT"] += 1

        for phone in set(re.findall(self.patterns["PHONE"], masked_text)):
            placeholder = f"[PHONE_{counters['PHONE']}]"
            mapping[placeholder] = phone
            masked_text = masked_text.replace(phone, placeholder)
            counters["PHONE"] += 1

        for amount in set(re.findall(self.patterns["CURRENCY"], masked_text)):
            placeholder = f"[AMOUNT_{counters['AMOUNT']}]"
            mapping[placeholder] = amount
            masked_text = masked_text.replace(amount, placeholder)
            counters["AMOUNT"] += 1

        return masked_text, mapping

    def unmask(self, text: str, mapping: dict[str, str]) -> str:
        for placeholder, original in mapping.items():
            text = text.replace(placeholder, original)
        return text
