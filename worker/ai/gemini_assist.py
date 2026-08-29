import json
import os
import urllib.error
import urllib.request

from .pii_masker import PIIMasker


class GeminiAssistEngine:
    """Analyze masked document text with Gemini and gracefully degrade on failure."""

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("LLM_API_KEY")
        self.masker = PIIMasker()

    def get_outbound_payload(self, document_text: str, rules_context: list | None = None) -> tuple[dict, dict[str, str]]:
        """
        Prepares the exact masked payload sent to the third-party LLM provider.
        Returns:
            payload: The sanitized JSON dictionary sent to the API.
            mapping: The server-side mapping of placeholders to original PII.
        """
        masked_text, mapping = self.masker.mask(document_text)
        system_instruction = (
            "You are a Compliance Officer AI Assistant. Analyze the provided document text "
            "against compliance rules. Return ONLY a JSON object with two fields:\n"
            "1. 'summary': A 2-3 sentence overview of the submission.\n"
            "2. 'flags': A list of compliance flags, where each flag contains:\n"
            "   - 'passage': exact excerpt from document\n"
            "   - 'matched_rule_id': applicable rule ID\n"
            "   - 'severity': 'HIGH', 'MEDIUM', or 'LOW'\n"
            "   - 'explanation': one-line reason why the passage violates the rule.\n"
            "Do NOT invent extra fields. Output valid JSON only."
        )
        rules = rules_context or [
            {"id": "RULE_DISCLOSURE_REQUIRED", "text": "All performance claims must include standard risk disclosures."},
            {"id": "RULE_NO_GUARANTEES", "text": "Guaranteed or promised investment returns are strictly prohibited."},
        ]
        prompt = f"RULES:\n{json.dumps(rules)}\n\nDOCUMENT TEXT:\n{masked_text}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "systemInstruction": {"parts": [{"text": system_instruction}]},
            "generationConfig": {"responseMimeType": "application/json"},
        }
        return payload, mapping

    def analyze_document(self, document_text: str, rules_context: list | None = None) -> dict:
        payload, mapping = self.get_outbound_payload(document_text, rules_context)
        fallback_response = {
            "summary": "AI Assist unavailable (API Key missing or service degraded). Officer manual review required.",
            "flags": [],
            "degraded": True,
        }

        if not self.api_key:
            print("[WARN] No LLM_API_KEY set. Gracefully degrading AI assist.")
            return fallback_response

        url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

        try:
            request = urllib.request.Request(
                f"{url}?key={self.api_key}",
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(request, timeout=10) as response:
                result = json.loads(response.read().decode("utf-8"))
                analysis = json.loads(result["candidates"][0]["content"]["parts"][0]["text"])
                analysis["summary"] = self.masker.unmask(analysis.get("summary", ""), mapping)
                for flag in analysis.get("flags", []):
                    flag["passage"] = self.masker.unmask(flag.get("passage", ""), mapping)
                    flag["explanation"] = self.masker.unmask(flag.get("explanation", ""), mapping)
                analysis["degraded"] = False
                return analysis
        except (OSError, ValueError, KeyError, urllib.error.URLError) as error:
            print(f"[ERROR] API call failed: {error}. Falling back gracefully.")
            return fallback_response
