import os
import json
import urllib.request
import urllib.error
from .pii_masker import PIIMasker

class GeminiAssistEngine:
    """
    AI Assist Engine for Compliance Document Review.
    - Uses PII Masker to sanitize text before API calls.
    - Prompts Gemini API for document summary and traceable compliance flags.
    - Implements Graceful Degradation (if API key missing or fails, review panel still loads).
    """
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("LLM_API_KEY")
        self.masker = PIIMasker()

    def analyze_document(self, document_text: str, rules_context: list = None):
        """
        Analyzes document text and returns structured summary and flags.
        """
        # 1. Mask PII before payload reaches external vendor
        masked_text, mapping = self.masker.mask(document_text)

        # Default Fallback for Graceful Degradation if API Key is missing or API fails
        fallback_response = {
            "summary": "AI Assist unavailable (API Key missing or service degraded). Officer manual review required.",
            "flags": [],
            "degraded": True
        }

        if not self.api_key:
            print("[WARN] No GEMINI_API_KEY set. Gracefully degrading AI assist.")
            return fallback_response

        # 2. Build structured prompt for Gemini
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

        rules_str = json.dumps(rules_context or [
            {"id": "RULE_DISCLOSURE_REQUIRED", "text": "All performance claims must include standard risk disclosures."},
            {"id": "RULE_NO_GUARANTEES", "text": "Guaranteed or promised investment returns are strictly prohibited."}
        ])

        prompt = f"RULES:\n{rules_str}\n\nDOCUMENT TEXT:\n{masked_text}"

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self.api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "systemInstruction": {"parts": [{"text": system_instruction}]},
            "generationConfig": {"responseMimeType": "application/json"}
        }

        try:
            req = urllib.request.Request(
                url, 
                data=json.dumps(payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                result = json.loads(resp.read().decode('utf-8'))
                raw_json = result['candidates'][0]['content']['parts'][0]['text']
                analysis = json.loads(raw_json)
                
                # Unmask placeholders for display back to officer
                analysis['summary'] = self.masker.unmask(analysis.get('summary', ''), mapping)
                for flag in analysis.get('flags', []):
                    flag['passage'] = self.masker.unmask(flag.get('passage', ''), mapping)
                    flag['explanation'] = self.masker.unmask(flag.get('explanation', ''), mapping)
                
                analysis['degraded'] = False
                return analysis

        except Exception as e:
            print(f"[ERROR] API Call Failed: {e}. Falling back gracefully.")
            return fallback_response
