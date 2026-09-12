"""
AI Assist Engine for Compliance Document Review.
Supports Gemini (Google AI Studio) and Groq LLMs with server-side PII masking,
structured Pydantic validation, missing-disclosure detection, and graceful degradation.
"""

import json
import os
import re
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

from .pii_masker import PIIMasker
from .rules_corpus import get_default_rules
from .schemas import AIAnalysisResult, ComplianceFlag


class GeminiAssistEngine:
    """
    Analyze PII-masked document text against compliance rules using Gemini or Groq.
    Enforces strict zero-PII privacy boundaries and graceful degradation on API failure.
    """

    SYSTEM_INSTRUCTION = (
        "You are a Senior Compliance Officer AI Assistant for Northstar Advisory Partners.\n"
        "Your role is to orient the human compliance reviewer by identifying potential regulatory issues.\n"
        "The human compliance officer always makes the final decision; you never make verdicts.\n\n"
        "Analyze the provided document text against the provided compliance rules.\n"
        "You must evaluate two types of compliance concerns:\n"
        "1. PROHIBITED CLAIMS: Identify exact statements that violate rules (e.g. guarantees, exaggerated returns, risk-free claims).\n"
        "   For these, set 'passage' to the exact excerpt from the document.\n"
        "2. MISSING DISCLOSURES BY ABSENCE: If the document discusses securities, investment performance, portfolio strategies, "
        "   or tax/legal matters, check whether mandatory disclosures (e.g., 'Past performance is no guarantee of future results', "
        "   'Investments are subject to market risk, including possible loss of principal', fee schedules, or tax disclaimers) are ABSENT.\n"
        "   If a required disclosure is missing, set 'passage' to '[MISSING MANDATORY DISCLOSURE]'.\n\n"
        "Return ONLY a valid JSON object matching this exact schema:\n"
        "{\n"
        "  \"summary\": \"2-3 sentence overview of the submission, its topic, and general compliance posture.\",\n"
        "  \"flags\": [\n"
        "    {\n"
        "      \"passage\": \"exact excerpt from document or [MISSING MANDATORY DISCLOSURE]\",\n"
        "      \"matched_rule_id\": \"applicable rule ID from the rules list (e.g. RULE_FINRA_2210_NO_GUARANTEES)\",\n"
        "      \"severity\": \"HIGH\" or \"MEDIUM\" or \"LOW\",\n"
        "      \"explanation\": \"one-line clear explanation of why this is a violation or missing requirement.\"\n"
        "    }\n"
        "  ]\n"
        "}\n"
        "Do NOT invent extra fields or wrap in markdown backticks. Output valid JSON only."
    )

    def __init__(
        self,
        api_key: Optional[str] = None,
        provider: Optional[str] = None,
        groq_api_key: Optional[str] = None,
    ):
        self.provider = (provider or os.environ.get("LLM_PROVIDER") or "gemini").lower()
        self.gemini_api_key = (
            api_key
            or os.environ.get("GEMINI_API_KEY")
            or os.environ.get("LLM_API_KEY")
        )
        self.groq_api_key = (
            groq_api_key
            or os.environ.get("GROQ_API_KEY")
            or (self.gemini_api_key if self.provider == "groq" else None)
        )
        self.masker = PIIMasker()

    def get_outbound_payload(
        self, document_text: str, rules_context: Optional[List[Dict[str, str]]] = None
    ) -> Tuple[Dict[str, Any], Dict[str, str]]:
        """
        Prepares the sanitized, PII-masked payload sent to the third-party LLM provider.
        Returns:
            payload: The sanitized JSON dictionary sent to the API.
            mapping: The server-side mapping of placeholders to original PII (retained locally).
        """
        masked_text, mapping = self.masker.mask(document_text)
        rules = rules_context or get_default_rules()
        rules_str = json.dumps(rules, indent=2)

        user_prompt = (
            f"=== COMPLIANCE RULES CORPUS ===\n{rules_str}\n\n"
            f"=== SUBMITTED DOCUMENT TEXT (PII SANITIZED) ===\n{masked_text}"
        )
        
        if self.provider == "groq":
            payload = {
                "model": os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile"),
                "messages": [
                    {"role": "system", "content": self.SYSTEM_INSTRUCTION},
                    {"role": "user", "content": user_prompt},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.1,
            }
        else:
            payload = {
                "contents": [{"parts": [{"text": user_prompt}]}],
                "systemInstruction": {"parts": [{"text": self.SYSTEM_INSTRUCTION}]},
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "temperature": 0.1,
                },
            }

        return payload, mapping

    def _call_gemini_api(self, payload: Dict[str, Any]) -> Tuple[str, str]:
        """Calls Google AI Studio Gemini API with model fallback."""
        if not self.gemini_api_key:
            raise ValueError("GEMINI_API_KEY / LLM_API_KEY is missing.")

        candidate_models = [
            os.environ.get("GEMINI_MODEL", "gemini-1.5-flash"),
            "gemini-2.0-flash",
            "gemini-2.5-flash",
        ]

        last_error = None
        for model in candidate_models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.gemini_api_key}"
            try:
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                )
                with urllib.request.urlopen(req, timeout=20) as response:
                    res_body = json.loads(response.read().decode("utf-8"))
                    raw_text = res_body["candidates"][0]["content"]["parts"][0]["text"]
                    return raw_text, model
            except urllib.error.HTTPError as e:
                last_error = e
                # If 404 (model not found), try next model in candidate list
                if e.code == 404:
                    continue
                raise
            except Exception as e:
                last_error = e
                raise

        raise last_error or RuntimeError("All Gemini model endpoints failed.")

    def _call_groq_api(self, payload: Dict[str, Any]) -> Tuple[str, str]:
        """Calls Groq OpenAI-compatible Chat Completions API."""
        api_key = self.groq_api_key or self.gemini_api_key
        if not api_key:
            raise ValueError("GROQ_API_KEY / LLM_API_KEY is missing.")

        url = "https://api.groq.com/openai/v1/chat/completions"
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
        )
        with urllib.request.urlopen(req, timeout=20) as response:
            res_body = json.loads(response.read().decode("utf-8"))
            raw_text = res_body["choices"][0]["message"]["content"]
            return raw_text, payload.get("model", "llama-3.3-70b-versatile")

    @staticmethod
    def _clean_json_string(text: str) -> str:
        """Strips markdown code fences and extraneous wrapping from LLM output."""
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)
        return cleaned.strip()

    def analyze_document(
        self, document_text: str, rules_context: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Main pipeline entry point:
        1. Masks all PII entities into server-side placeholders.
        2. Calls LLM (Gemini with Groq failover, or vice versa).
        3. Parses and validates response with Pydantic.
        4. Restores/unmasks original client entities into the output for officer review.
        5. Degrades gracefully if offline, unconfigured, or rate-limited.
        """
        payload, mapping = self.get_outbound_payload(document_text, rules_context)

        fallback_response: Dict[str, Any] = {
            "summary": "AI Assist unavailable (API Key missing, rate-limited, or service degraded). Officer manual review required.",
            "flags": [],
            "degraded": True,
            "provider": "degraded_fallback",
            "model": None,
        }

        # Check credentials
        has_key = bool(self.gemini_api_key or self.groq_api_key)
        if not has_key:
            print("[WARN] No LLM API key configured. Returning graceful fallback response.")
            return fallback_response

        raw_response_text = None
        used_provider = self.provider
        used_model = None

        # Attempt primary provider
        try:
            if self.provider == "groq":
                raw_response_text, used_model = self._call_groq_api(payload)
            else:
                raw_response_text, used_model = self._call_gemini_api(payload)
        except Exception as primary_err:
            print(f"[WARN] Primary LLM ({self.provider}) call failed: {primary_err}")
            # Try secondary provider fallback if credentials exist
            try:
                if self.provider == "gemini" and self.groq_api_key:
                    print("[INFO] Attempting failover to Groq...")
                    self.provider = "groq"
                    groq_payload, _ = self.get_outbound_payload(document_text, rules_context)
                    raw_response_text, used_model = self._call_groq_api(groq_payload)
                    used_provider = "groq"
                elif self.provider == "groq" and self.gemini_api_key:
                    print("[INFO] Attempting failover to Gemini...")
                    self.provider = "gemini"
                    gemini_payload, _ = self.get_outbound_payload(document_text, rules_context)
                    raw_response_text, used_model = self._call_gemini_api(gemini_payload)
                    used_provider = "gemini"
                else:
                    return fallback_response
            except Exception as secondary_err:
                print(f"[ERROR] Failover LLM call also failed: {secondary_err}")
                return fallback_response

        # Parse & validate with Pydantic
        try:
            cleaned_json = self._clean_json_string(raw_response_text)
            parsed_data = json.loads(cleaned_json)
            validated = AIAnalysisResult(
                summary=parsed_data.get("summary", ""),
                flags=[
                    ComplianceFlag.model_validate(f)
                    for f in parsed_data.get("flags", [])
                ],
                degraded=False,
                provider=used_provider,
                model=used_model,
            )
        except Exception as parse_err:
            print(f"[ERROR] Failed to parse or validate LLM JSON: {parse_err}. Content was:\n{raw_response_text}")
            return fallback_response

        # Unmask placeholders back into original entity values for officer display
        unmasked_summary = self.masker.unmask(validated.summary, mapping)
        unmasked_flags: List[Dict[str, Any]] = []
        for flag in validated.flags:
            unmasked_flags.append({
                "passage": self.masker.unmask(flag.passage, mapping),
                "matched_rule_id": flag.matched_rule_id,
                "severity": flag.severity.value,
                "explanation": self.masker.unmask(flag.explanation, mapping),
            })

        return {
            "summary": unmasked_summary,
            "flags": unmasked_flags,
            "degraded": False,
            "provider": validated.provider,
            "model": validated.model,
        }
        def build_payload_from_masked(
        self,
        masked_text: str,
        rules_context: list,
        missing_disclosures: list | None = None,
        precedents: list | None = None,
    ) -> dict:
        """Like get_outbound_payload, but for text ALREADY masked
        upstream by the pipeline (before chunking/embedding), instead
        of masking it here. Masking happens exactly once per document,
        at the top of the pipeline — see worker/ai/pipeline.py."""
        system_instruction = (
            "You are a Compliance Officer AI Assistant. Analyze the provided document text "
            "against compliance rules, missing disclosures, and similar past decisions. "
            "Return ONLY a JSON object with two fields:\n"
            "1. 'summary': A 2-3 sentence overview of the submission.\n"
            "2. 'flags': A list of compliance flags, where each flag contains:\n"
            "   - 'passage': exact excerpt from document\n"
            "   - 'matched_rule_id': applicable rule ID from RULES or DISCLOSURES below\n"
            "   - 'severity': 'HIGH', 'MEDIUM', or 'LOW'\n"
            "   - 'explanation': one-line reason why the passage violates the rule.\n"
            "Only cite a matched_rule_id that actually appears in RULES or DISCLOSURES below — "
            "never invent a rule ID. Do NOT invent extra fields. Output valid JSON only."
        )

        parts = [f"RULES:\n{json.dumps(rules_context)}"]
        if missing_disclosures:
            parts.append(f"DISCLOSURES CURRENTLY MISSING FROM THIS DOCUMENT:\n{json.dumps(missing_disclosures)}")
        if precedents:
            parts.append(f"SIMILAR PAST DECISIONS (for consistency reference):\n{json.dumps(precedents)}")
        parts.append(f"DOCUMENT TEXT:\n{masked_text}")

        return {
            "contents": [{"parts": [{"text": "\n\n".join(parts)}]}],
            "systemInstruction": {"parts": [{"text": system_instruction}]},
            "generationConfig": {"responseMimeType": "application/json"},
        }

    def analyze_masked_document(
        self,
        masked_text: str,
        mapping: dict[str, str],
        rules_context: list,
        missing_disclosures: list | None = None,
        precedents: list | None = None,
    ) -> dict:
        """Entry point for the wired pipeline. Unlike analyze_document(),
        does NOT mask internally — the caller already masked once,
        upstream, and passes the resulting mapping through for
        unmasking the response at the end."""
        payload = self.build_payload_from_masked(masked_text, rules_context, missing_disclosures, precedents)
        fallback_response = {
            "summary": "AI Assist unavailable (API Key missing or service degraded). Officer manual review required.",
            "flags": [],
            "degraded": True,
        }

        if not self.api_key:
            print("[WARN] No LLM_API_KEY set. Gracefully degrading AI assist.")
            return fallback_response

        url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
        try:
            request = urllib.request.Request(
                f"{url}?key={self.api_key}",
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(request, timeout=20) as response:
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