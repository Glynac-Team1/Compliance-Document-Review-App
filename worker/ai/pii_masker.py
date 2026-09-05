import re
from typing import Dict, List, Tuple


class PIIMasker:
    """Mask document PII before text reaches an external AI provider."""

    # A single combined pattern instead of 5 separate ones. Alternatives are
    # tried left-to-right at each starting position, so ORDER = PRIORITY.
    # This matters in two places:
    #   - PHONE is listed before the bare-digit ACCOUNT pattern, so a
    #     10-13 digit phone-shaped run is claimed by PHONE first instead of
    #     being swallowed whole by the generic \d{9,12} account pattern.
    #   - EMAIL/CLIENT_NAME/SSN/ACC_PREFIX have distinctive leading tokens
    #     (@, a title word, digit-dash-digit, "ACC-") so they never really
    #     compete with each other, but listing them ahead of the generic
    #     digit patterns keeps that guaranteed.
    _COMBINED_PATTERN = re.compile(
        r"(?P<EMAIL>[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})"
        r"|(?P<CLIENT_NAME>\b(?:Client|Advisor|Investor|Mr\.|Ms\.|Mrs\.|Dr\.)\s+"
        r"(?P<CLIENT_VALUE>[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b)"
        r"|(?P<SSN>\b\d{3}-\d{2}-\d{4}\b)"
        r"|(?P<ACC_PREFIX>\bACC-\d{5,8}\b)"
        r"|(?P<PHONE>\b(?:\+?\d{1,3}[-.\s])?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b)"
        r"|(?P<ACC_BARE>\b\d{9,12}\b)"
        r"|(?P<CURRENCY>\$(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?)"
    )

    # Every named group above (except the CLIENT_VALUE sub-group) maps to
    # the placeholder category it should be masked as.
    _GROUP_TO_CATEGORY = {
        "EMAIL": "EMAIL",
        "CLIENT_NAME": "CLIENT",
        "SSN": "ACCOUNT",
        "ACC_PREFIX": "ACCOUNT",
        "PHONE": "PHONE",
        "ACC_BARE": "ACCOUNT",
        "CURRENCY": "AMOUNT",
    }

    _GENERIC_ROLE_WORDS = {
        "Investor", "Investors", "Client", "Clients", "Advisor", "Advisors",
        "Team", "All", "Colleague", "Colleagues", "Sir", "Madam",
        "Customer", "Customers", "Shareholder", "Shareholders"
    }

    def mask(self, text: str) -> Tuple[str, Dict[str, str]]:
        mapping: Dict[str, str] = {}
        value_to_placeholder: Dict[Tuple[str, str], str] = {}
        counters: Dict[str, int] = {}

        pieces: List[str] = []
        cursor = 0

        for match in self._COMBINED_PATTERN.finditer(text):
            gd = match.groupdict()
            group_name = next(
                name for name in self._GROUP_TO_CATEGORY if gd.get(name) is not None
            )
            category = self._GROUP_TO_CATEGORY[group_name]

            if group_name == "CLIENT_NAME":
                value = match.group("CLIENT_VALUE")
                # Skip generic non-individual salutations (e.g. "Dear Investor")
                if value in self._GENERIC_ROLE_WORDS:
                    continue
                # Mask only the name itself; leave the title/prefix visible in the output.
                span_start, span_end = match.span("CLIENT_VALUE")
            else:
                value = match.group()
                span_start, span_end = match.span()

            key = (category, value)
            placeholder = value_to_placeholder.get(key)
            if placeholder is None:
                counters[category] = counters.get(category, 0) + 1
                placeholder = f"[{category}_{counters[category]}]"
                value_to_placeholder[key] = placeholder
                mapping[placeholder] = value

            pieces.append(text[cursor:span_start])
            pieces.append(placeholder)
            cursor = span_end

        pieces.append(text[cursor:])
        masked_result = "".join(pieces)

        # Propagate known person entities across any subsequent bare mentions
        for placeholder, original in mapping.items():
            if placeholder.startswith("[CLIENT_") and original in masked_result:
                masked_result = re.sub(rf"\b{re.escape(original)}\b", placeholder, masked_result)

        return masked_result, mapping

    def unmask(self, text: str, mapping: Dict[str, str]) -> str:
        for placeholder, original in mapping.items():
            text = text.replace(placeholder, original)
        return text