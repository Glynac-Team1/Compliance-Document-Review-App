"""
AI Assist Engine for Compliance Document Review.
Supports Gemini (Google AI Studio), Groq, and OpenRouter LLMs with server-side PII masking,
structured Pydantic validation, multi-LLM fallback failover, missing-disclosure detection, and graceful degradation.
"""

import json
import logging
import os
import random
import re
import socket
import time
import urllib.error
import urllib.request
import sys
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple

try:
    from tenacity import (
        retry,
        stop_after_attempt,
        wait_random_exponential,
        retry_if_exception,
    )
    HAS_TENACITY = True
except ImportError:
    HAS_TENACITY = False

from .pii_masker import PIIMasker
from .rules_corpus import get_default_rules
from .schemas import AIAnalysisResult, ComplianceFlag

try:
    from app.core.analysis_errors import AnalysisErrorCode, get_user_facing_message
except ImportError:
    try:
        from backend.app.core.analysis_errors import AnalysisErrorCode, get_user_facing_message
    except ImportError:
        _backend_dir = Path(__file__).resolve().parent.parent.parent / "backend"
        if str(_backend_dir) not in sys.path:
            sys.path.insert(0, str(_backend_dir))
        from app.core.analysis_errors import AnalysisErrorCode, get_user_facing_message


logger = logging.getLogger(__name__)

DEFAULT_GEMINI_MODEL = "gemini-3.6-flash"
DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"
DEFAULT_OPENROUTER_MODEL = "google/gemini-2.5-flash"
SUPPORTED_PROVIDERS = {"gemini", "groq", "openrouter"}
DEFAULT_LLM_REQUEST_TIMEOUT_SECONDS = 20
DEFAULT_LLM_MAX_ATTEMPTS = 3
DEFAULT_LLM_RETRY_MIN_SECONDS = 1
DEFAULT_LLM_RETRY_MAX_SECONDS = 8


class LLMFailureCategory(str, Enum):
    TRANSIENT = "transient"
    RATE_LIMITED = "rate_limited"
    AUTHENTICATION = "authentication"
    INVALID_REQUEST = "invalid_request"
    MODEL_UNAVAILABLE = "model_unavailable"
    INVALID_RESPONSE = "invalid_response"
    CONFIGURATION = "configuration"
    APPLICATION = "application"


class LLMProviderError(Exception):
    """Safe, classified provider failure used to make fallback decisions."""

    def __init__(
        self,
        category: LLMFailureCategory,
        provider: str,
        model: Optional[str] = None,
        status_code: Optional[int] = None,
    ):
        self.category = category
        self.provider = provider
        self.model = model
        self.status_code = status_code
        super().__init__(self.safe_detail)

    @property
    def retryable(self) -> bool:
        return self.category in {
            LLMFailureCategory.TRANSIENT,
            LLMFailureCategory.RATE_LIMITED,
        }

    @property
    def safe_detail(self) -> str:
        details = [f"category={self.category.value}", f"provider={self.provider}"]
        if self.model:
            details.append(f"model={self.model}")
        if self.status_code is not None:
            details.append(f"status={self.status_code}")
        return ":".join(details)


def _positive_int_env(name: str, default: int) -> int:
    value = os.environ.get(name)
    if value is None:
        return default
    try:
        parsed = int(value)
    except ValueError:
        logger.warning("Invalid integer configuration; name=%s using_default=%s", name, default)
        return default
    return parsed if parsed > 0 else default


LLM_REQUEST_TIMEOUT_SECONDS = _positive_int_env(
    "LLM_REQUEST_TIMEOUT_SECONDS", DEFAULT_LLM_REQUEST_TIMEOUT_SECONDS
)
LLM_MAX_ATTEMPTS = _positive_int_env("LLM_MAX_ATTEMPTS", DEFAULT_LLM_MAX_ATTEMPTS)
LLM_RETRY_MIN_SECONDS = _positive_int_env(
    "LLM_RETRY_MIN_SECONDS", DEFAULT_LLM_RETRY_MIN_SECONDS
)
LLM_RETRY_MAX_SECONDS = max(
    LLM_RETRY_MIN_SECONDS,
    _positive_int_env("LLM_RETRY_MAX_SECONDS", DEFAULT_LLM_RETRY_MAX_SECONDS),
)


def _gemini_candidate_models() -> list[str]:
    configured_model = os.environ.get("GEMINI_MODEL", DEFAULT_GEMINI_MODEL)
    return list(dict.fromkeys([configured_model, DEFAULT_GEMINI_MODEL]))


def _is_retryable_http_error(exc: BaseException) -> bool:
    """Classify failures that may succeed when the same request is attempted later."""
    if isinstance(exc, urllib.error.HTTPError):
        return exc.code == 429 or 500 <= exc.code < 600
    if isinstance(exc, urllib.error.URLError):
        return True
    return isinstance(exc, (TimeoutError, socket.timeout, ConnectionError))


def _classify_provider_error(
    exc: BaseException,
    provider: str,
    model: Optional[str] = None,
) -> LLMProviderError:
    if isinstance(exc, LLMProviderError):
        return exc
    if isinstance(exc, urllib.error.HTTPError):
        if exc.code == 429:
            category = LLMFailureCategory.RATE_LIMITED
        elif 500 <= exc.code < 600:
            category = LLMFailureCategory.TRANSIENT
        elif exc.code in {401, 403}:
            category = LLMFailureCategory.AUTHENTICATION
        elif exc.code == 404:
            category = LLMFailureCategory.MODEL_UNAVAILABLE
        elif 400 <= exc.code < 500:
            category = LLMFailureCategory.INVALID_REQUEST
        else:
            category = LLMFailureCategory.APPLICATION
        return LLMProviderError(category, provider, model, exc.code)
    if isinstance(exc, (urllib.error.URLError, TimeoutError, socket.timeout, ConnectionError)):
        return LLMProviderError(LLMFailureCategory.TRANSIENT, provider, model)
    if isinstance(exc, (json.JSONDecodeError, KeyError, IndexError, TypeError, ValueError)):
        return LLMProviderError(LLMFailureCategory.INVALID_RESPONSE, provider, model)
    return LLMProviderError(LLMFailureCategory.APPLICATION, provider, model)


if HAS_TENACITY:
    @retry(
        reraise=True,
        stop=stop_after_attempt(LLM_MAX_ATTEMPTS),
        wait=wait_random_exponential(
            multiplier=1,
            min=LLM_RETRY_MIN_SECONDS,
            max=LLM_RETRY_MAX_SECONDS,
        ),
        retry=retry_if_exception(_is_retryable_http_error),
    )
    def _execute_request_with_retry(
        req: urllib.request.Request,
        timeout: int = LLM_REQUEST_TIMEOUT_SECONDS,
    ) -> Any:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
else:
    def _execute_request_with_retry(
        req: urllib.request.Request,
        timeout: int = LLM_REQUEST_TIMEOUT_SECONDS,
    ) -> Any:
        attempts = LLM_MAX_ATTEMPTS
        last_error = None
        for attempt in range(1, attempts + 1):
            try:
                with urllib.request.urlopen(req, timeout=timeout) as response:
                    return json.loads(response.read().decode("utf-8"))
            except Exception as e:
                last_error = e
                if attempt < attempts and _is_retryable_http_error(e):
                    lower = min(
                        LLM_RETRY_MAX_SECONDS,
                        LLM_RETRY_MIN_SECONDS * (2 ** (attempt - 1)),
                    )
                    time.sleep(random.uniform(lower, LLM_RETRY_MAX_SECONDS))
                    continue
                raise
        raise last_error or RuntimeError("Network request failed after retries.")


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
        "2. MISSING DISCLOSURES BY ABSENCE: Mandatory disclosure absence is detected upstream by vector analysis.\n"
        "   If missing disclosures are supplied in the prompt context under 'DISCLOSURES IDENTIFIED AS MISSING', or if the document\n"
        "   clearly discusses securities/performance without required disclaimers (e.g. 'Past performance is no guarantee of future results',\n"
        "   'Investments are subject to market risk, including possible loss of principal', fee schedules, or tax disclaimers),\n"
        "   orient the reviewer by explaining the regulatory gap and set 'passage' to '[MISSING MANDATORY DISCLOSURE]'.\n\n"
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
        openrouter_api_key: Optional[str] = None,
        fallback_providers: Optional[Sequence[str]] = None,
    ):
        configured_provider = (provider or os.environ.get("LLM_PROVIDER") or "gemini").strip().lower()
        self.provider = configured_provider if configured_provider in SUPPORTED_PROVIDERS else "gemini"
        
        generic_key = api_key or os.environ.get("LLM_API_KEY")

        self.gemini_api_key = (
            os.environ.get("GEMINI_API_KEY")
            or (generic_key if self.provider == "gemini" else None)
        )
        self.groq_api_key = (
            groq_api_key
            or os.environ.get("GROQ_API_KEY")
            or (generic_key if self.provider == "groq" else None)
        )
        self.openrouter_api_key = (
            openrouter_api_key
            or os.environ.get("OPENROUTER_API_KEY")
            or (generic_key if self.provider == "openrouter" else None)
        )

        # Legacy alias for callers of earlier single-key API
        if self.provider == "groq":
            self.api_key = self.groq_api_key
        elif self.provider == "openrouter":
            self.api_key = self.openrouter_api_key
        else:
            self.api_key = self.gemini_api_key

        if fallback_providers is not None:
            self.fallback_providers = [
                p.strip().lower() for p in fallback_providers if p.strip().lower() in SUPPORTED_PROVIDERS
            ]
        else:
            env_fallbacks = os.environ.get("LLM_FALLBACK_PROVIDERS")
            if env_fallbacks:
                self.fallback_providers = [
                    p.strip().lower() for p in env_fallbacks.split(",") if p.strip().lower() in SUPPORTED_PROVIDERS
                ]
            else:
                self.fallback_providers = None

        self.masker = PIIMasker()

    def _get_provider_key(self, provider: str) -> Optional[str]:
        """Returns the configured API key for the specified provider."""
        if provider == "gemini":
            return self.gemini_api_key
        elif provider == "groq":
            return self.groq_api_key
        elif provider == "openrouter":
            return self.openrouter_api_key
        return None

    def _get_fallback_chain(self) -> List[str]:
        """
        Determines the ordered chain of providers to attempt.
        Starts with self.provider, followed by explicit fallback_providers or all configured providers.
        """
        chain = [self.provider]
        if self.fallback_providers is not None:
            for p in self.fallback_providers:
                if p not in chain and p in SUPPORTED_PROVIDERS:
                    chain.append(p)
        else:
            default_preference = ["gemini", "openrouter", "groq"]
            for p in default_preference:
                if p not in chain and p in SUPPORTED_PROVIDERS:
                    chain.append(p)
        return chain

    def get_outbound_payload(
        self, document_text: str, rules_context: Optional[List[Dict[str, str]]] = None
    ) -> Tuple[Dict[str, Any], Dict[str, str]]:
        """
        Prepares the sanitized, PII-masked payload sent to the third-party LLM provider.
        Returns:
            payload: The sanitized JSON dictionary sent to the API.
            mapping: The server-side mapping of placeholders to original PII (retained locally).
        """
        if not isinstance(document_text, str):
            raise TypeError("document_text must be a string")
        masked_text, mapping = self.masker.mask(document_text)
        return self._build_payload(masked_text, rules_context), mapping

    def _build_payload(
        self,
        masked_text: str,
        rules_context: Optional[Sequence[Mapping[str, Any]]] = None,
        missing_disclosures: Optional[Sequence[Any]] = None,
        precedents: Optional[Sequence[Any]] = None,
        provider: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Build a provider-specific request from text already inside the privacy wall."""
        rules = list(rules_context) if rules_context else get_default_rules()
        sections = [
            f"=== COMPLIANCE RULES CORPUS ===\n{json.dumps(rules, indent=2)}",
        ]
        if missing_disclosures:
            sections.append(f"=== DISCLOSURES IDENTIFIED AS MISSING ===\n{json.dumps(list(missing_disclosures))}")
        if precedents:
            sections.append(f"=== SIMILAR PAST DECISIONS (REFERENCE ONLY) ===\n{json.dumps(list(precedents))}")
        sections.append(f"=== SUBMITTED DOCUMENT TEXT (PII SANITIZED) ===\n{masked_text}")
        user_prompt = "\n\n".join(sections)
        selected_provider = provider or self.provider

        if selected_provider in {"groq", "openrouter"}:
            if selected_provider == "openrouter":
                model_name = os.environ.get("OPENROUTER_MODEL", DEFAULT_OPENROUTER_MODEL)
            else:
                model_name = os.environ.get("GROQ_MODEL", DEFAULT_GROQ_MODEL)
            return {
                "model": model_name,
                "messages": [
                    {"role": "system", "content": self.SYSTEM_INSTRUCTION},
                    {"role": "user", "content": user_prompt},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.1,
            }
        return {
            "contents": [{"parts": [{"text": user_prompt}]}],
            "systemInstruction": {"parts": [{"text": self.SYSTEM_INSTRUCTION}]},
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.1,
            },
        }

    def _call_gemini_api(self, payload: Dict[str, Any]) -> Tuple[str, str]:
        """Calls Google AI Studio Gemini API with model fallback, secure headers, and exponential backoff."""
        if not self.gemini_api_key:
            raise ValueError("GEMINI_API_KEY / LLM_API_KEY is missing.")

        candidate_models = list(dict.fromkeys(
            _gemini_candidate_models() + ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
        ))

        last_error = None
        for model in candidate_models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            try:
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={
                        "Content-Type": "application/json",
                        "x-goog-api-key": self.gemini_api_key,
                    },
                )
                res_body = _execute_request_with_retry(req, timeout=LLM_REQUEST_TIMEOUT_SECONDS)
                return self._extract_gemini_text(res_body), model
            except urllib.error.HTTPError as e:
                last_error = e
                # If 404 (model not found), try next model in candidate list
                if e.code == 404:
                    continue
                raise
            except (json.JSONDecodeError, KeyError, IndexError, TypeError) as error:
                last_error = ValueError("Gemini returned an invalid response shape")
                raise last_error from error

        raise last_error or RuntimeError("All Gemini model endpoints failed.")

    def _call_groq_api(self, payload: Dict[str, Any]) -> Tuple[str, str]:
        """Calls Groq OpenAI-compatible Chat Completions API with exponential backoff."""
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
        res_body = _execute_request_with_retry(req, timeout=LLM_REQUEST_TIMEOUT_SECONDS)
        return self._extract_groq_text(res_body), payload.get("model", DEFAULT_GROQ_MODEL)

    def _call_openrouter_api(self, payload: Dict[str, Any]) -> Tuple[str, str]:
        """Calls OpenRouter OpenAI-compatible Chat Completions API with exponential backoff."""
        api_key = self.openrouter_api_key or self.api_key
        if not api_key:
            raise ValueError("OPENROUTER_API_KEY / LLM_API_KEY is missing.")

        url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "HTTP-Referer": os.environ.get("OPENROUTER_SITE_URL", "https://compliance-review.local"),
            "X-Title": os.environ.get("OPENROUTER_APP_NAME", "Compliance Document Review"),
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
        )
        res_body = _execute_request_with_retry(req, timeout=LLM_REQUEST_TIMEOUT_SECONDS)
        model = payload.get("model", os.environ.get("OPENROUTER_MODEL", DEFAULT_OPENROUTER_MODEL))
        return self._extract_openrouter_text(res_body), model

    @staticmethod
    def _extract_gemini_text(response: Mapping[str, Any]) -> str:
        candidates = response.get("candidates")
        if not isinstance(candidates, list) or not candidates:
            raise ValueError("Gemini response contained no candidates")
        parts = candidates[0].get("content", {}).get("parts")
        if not isinstance(parts, list):
            raise ValueError("Gemini response contained no content parts")
        text = "".join(part.get("text", "") for part in parts if isinstance(part, dict))
        if not text.strip():
            raise ValueError("Gemini response contained no text")
        return text

    @staticmethod
    def _extract_chat_completion_text(response: Mapping[str, Any], provider_name: str = "LLM") -> str:
        choices = response.get("choices")
        if not isinstance(choices, list) or not choices:
            raise ValueError(f"{provider_name} response contained no choices")
        content = choices[0].get("message", {}).get("content")
        if isinstance(content, str) and content.strip():
            return content
        if isinstance(content, list):
            text = "".join(
                part.get("text", "") for part in content if isinstance(part, dict)
            )
            if text.strip():
                return text
        raise ValueError(f"{provider_name} response contained no text")

    @classmethod
    def _extract_groq_text(cls, response: Mapping[str, Any]) -> str:
        return cls._extract_chat_completion_text(response, provider_name="Groq")

    @classmethod
    def _extract_openrouter_text(cls, response: Mapping[str, Any]) -> str:
        return cls._extract_chat_completion_text(response, provider_name="OpenRouter")

    @staticmethod
    def _clean_json_string(text: str) -> str:
        """Strips markdown code fences and extraneous wrapping from LLM output."""
        if not isinstance(text, str):
            raise TypeError("LLM response must be text")
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r"\s*```$", "", cleaned)
        cleaned = cleaned.strip()
        if not cleaned.startswith("{"):
            start = cleaned.find("{")
            if start >= 0:
                cleaned = cleaned[start:]
        if not cleaned.endswith("}"):
            end = cleaned.rfind("}")
            if end >= 0:
                cleaned = cleaned[: end + 1]
        return cleaned

    @classmethod
    def _validate_response(
        cls, raw_response_text: str, provider: str, model: Optional[str]
    ) -> AIAnalysisResult:
        parsed_data = json.loads(cls._clean_json_string(raw_response_text))
        if not isinstance(parsed_data, dict):
            raise ValueError("LLM response must be a JSON object")
        raw_flags = parsed_data.get("flags", [])
        if not isinstance(raw_flags, list):
            raise ValueError("LLM response field 'flags' must be a list")
        validated_flags = [ComplianceFlag.model_validate(flag) for flag in raw_flags]
        return AIAnalysisResult(
            summary=parsed_data.get("summary", ""),
            flags=validated_flags,
            degraded=False,
            provider=provider,
            model=model,
        )

    def _fallback_response(
        self,
        technical_error: str = "",
        retryable: bool = False,
    ) -> Dict[str, Any]:
        return {
            "summary": get_user_facing_message(AnalysisErrorCode.LLM_FAILED),
            "flags": [],
            "degraded": True,
            "provider": "degraded_fallback",
            "model": None,
            "error_code": AnalysisErrorCode.LLM_FAILED.value,
            "user_facing_error": get_user_facing_message(AnalysisErrorCode.LLM_FAILED),
            "technical_error": technical_error,
            "retryable": retryable,
        }

    def _call_provider(self, provider: str, payload: Dict[str, Any]) -> Tuple[str, str]:
        if provider == "groq":
            return self._call_groq_api(payload)
        elif provider == "openrouter":
            return self._call_openrouter_api(payload)
        return self._call_gemini_api(payload)

    def _analyze_masked(
        self,
        masked_text: str,
        mapping: Mapping[str, str],
        rules_context: Optional[Sequence[Mapping[str, Any]]] = None,
        missing_disclosures: Optional[Sequence[Any]] = None,
        precedents: Optional[Sequence[Any]] = None,
    ) -> Dict[str, Any]:
        if not isinstance(masked_text, str):
            raise TypeError("masked_text must be a string")
        fallback = self._fallback_response()
        if not masked_text.strip():
            logger.warning("Empty document text; returning degraded analysis")
            return fallback
        if not isinstance(mapping, Mapping):
            raise TypeError("mapping must be a mapping of placeholders to original values")

        fallback_chain = self._get_fallback_chain()
        active_providers = [p for p in fallback_chain if self._get_provider_key(p)]
        if not active_providers:
            logger.warning("No LLM API key configured for any provider; returning degraded analysis")
            return self._fallback_response("ConfigurationError: missing LLM API key")

        last_error: Optional[LLMProviderError] = None
        for index, provider in enumerate(active_providers):
            payload = None
            try:
                payload = self._build_payload(
                    masked_text, rules_context, missing_disclosures, precedents, provider
                )
                raw_text, model = self._call_provider(provider, payload)
                validated = self._validate_response(raw_text, provider, model)
                return {
                    "summary": self.masker.unmask(validated.summary, dict(mapping)),
                    "flags": [
                        {
                            "passage": self.masker.unmask(flag.passage, dict(mapping)),
                            "matched_rule_id": flag.matched_rule_id,
                            "severity": flag.severity.value,
                            "explanation": self.masker.unmask(flag.explanation, dict(mapping)),
                        }
                        for flag in validated.flags
                    ],
                    "degraded": False,
                    "provider": validated.provider,
                    "model": validated.model,
                }
            except Exception as error:
                model = payload.get("model") if isinstance(payload, dict) else None
                failure = _classify_provider_error(error, provider, model)
                last_error = failure
                if index < len(active_providers) - 1:
                    next_provider = active_providers[index + 1]
                    logger.warning(
                        "LLM provider '%s' failed (category=%s status=%s); falling back to '%s'",
                        provider,
                        failure.category.value,
                        failure.status_code or "none",
                        next_provider,
                    )
                else:
                    logger.error(
                        "All LLM providers in fallback chain failed. Last provider '%s' failed (category=%s status=%s retryable=%s)",
                        provider,
                        failure.category.value,
                        failure.status_code or "none",
                        failure.retryable,
                    )
        technical_error = "unknown"
        if last_error is not None:
            technical_error = last_error.safe_detail
        return self._fallback_response(
            technical_error,
            retryable=last_error.retryable if last_error is not None else False,
        )

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
        if not isinstance(document_text, str):
            raise TypeError("document_text must be a string")
        masked_text, mapping = self.masker.mask(document_text)
        return self._analyze_masked(masked_text, mapping, rules_context)

    def build_payload_from_masked(
        self,
        masked_text: str,
        rules_context: Optional[List[Dict[str, str]]] = None,
        missing_disclosures: Optional[List[Any]] = None,
        precedents: Optional[List[Any]] = None,
    ) -> Dict[str, Any]:
        if not isinstance(masked_text, str):
            raise TypeError("masked_text must be a string")
        return self._build_payload(masked_text, rules_context, missing_disclosures, precedents)

    def analyze_masked_document(
        self,
        masked_text: str,
        mapping: Mapping[str, str],
        rules_context: Optional[List[Dict[str, str]]] = None,
        missing_disclosures: Optional[List[Any]] = None,
        precedents: Optional[List[Any]] = None,
    ) -> Dict[str, Any]:
        return self._analyze_masked(
            masked_text,
            mapping,
            rules_context,
            missing_disclosures,
            precedents,
        )