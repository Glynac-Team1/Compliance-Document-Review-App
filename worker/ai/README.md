# AI Engineering Track — Compliance Document Review

**Engineer:** Basamsetti Venkata Vamsi  
**Track:** AI Engineering  
**Scope:** Server-Side PII Masker, Gemini, Groq & OpenRouter Assist Engine with Dynamic Failover, Strict Pydantic JSON Output Schemas, Traceable Flag Generation, Missing-Disclosure Detection by Absence, Reverse Unmasking for Display, and Outbound Privacy Payload Auditing.

---

## 1. Architecture Overview

The AI feature runs against third-party LLM providers (**Gemini `gemini-3.6-flash`** via Google AI Studio, **OpenRouter `google/gemini-2.5-flash`**, and **Groq `llama-3.3-70b-versatile`** when configured). `GEMINI_MODEL`, `OPENROUTER_MODEL`, and `GROQ_MODEL` can override defaults. An automatic failover chain (`LLM_FALLBACK_PROVIDERS`) makes the analysis resilient against rate limits and upstream outages. Per the project privacy wall requirement, **raw client data never leaves the application perimeter**.

```
  Uploaded Document Text (Raw)
               │
               ▼
   ┌───────────────────────┐
   │    PIIMasker Engine   │ ───► Store Reverse Mapping Server-Side
   │  (Single-pass Regex)  │      (e.g., [CLIENT_1] -> "Jane Doe")
   └───────────────────────┘
               │
               ▼  (Zero raw PII leaves perimeter)
   ┌───────────────────────┐
  │  Outbound AI Payload  │ ───► Gemini 3.6 Flash API (Primary)
   │ (Masked Text + Rules) │      ├── Failover 1: OpenRouter (Multi-Model Gateway)
   └───────────────────────┘      └── Failover 2: Groq LLaMA-3.3-70B
               │
               ▼  (Structured JSON: summary + traceable flags)
   ┌───────────────────────┐
   │  Pydantic Validator   │ ───► Strict Schema Enforcement (worker/ai/schemas.py)
   └───────────────────────┘
               │
               ▼
   ┌───────────────────────┐
   │   Response Unmasker   │ ───► Display Unmasked Output to Officer in Review Panel
   └───────────────────────┘
```

---

## 2. PII Masking Implementation (`pii_masker.py`)

The `PIIMasker` utilizes an ordered single-pass regex engine with discovered entity propagation to prevent trailing mentions from leaking.

### Masked Entity Types & Placeholders:
| Entity Type | Example Input | Placeholder Format | Description |
|---|---|---|---|
| **Client / Person Name** | `Client Jane Smith`, `Advisor Robert`, `Dr. John Doe` | `[CLIENT_1]` | Contextual name detection following honorifics/roles with whole-document propagation. |
| **Email Address** | `jane.smith@example.com` | `[EMAIL_1]` | Standard RFC-compliant email regex. |
| **Phone Number** | `555-123-4567`, `+1 (800) 555-9999` | `[PHONE_1]` | US and international phone formats. |
| **Account / SSN** | `ACC-987654`, `123-45-6789` | `[ACCOUNT_1]` | Fixed prefix account IDs and SSN structures. |
| **Monetary Amount** | `$250,000.00`, `$15,000` | `[AMOUNT_1]` | Currency figures tied to transactions or investments. |

---

## 3. Honest Notes on Masker Scope & Known Limitations

Per the project evaluation criteria, the masker is intentionally focused and documented regarding what it handles versus known boundary cases:

### ✅ What It Catches Reliably:
- Standard US SSNs (`\d{3}-\d{2}-\d{4}`) and account numbers (`ACC-\d+` or 9–12 digit runs).
- Standard emails and phone numbers with country codes or parenthesis formatting.
- Client and advisor names preceded by common titles/roles (`Client`, `Advisor`, `Investor`, `Mr.`, `Ms.`, `Mrs.`, `Dr.`, `for`, `to`, `Dear`, `Contact`, `by`).
- Repeated mentions of any discovered individual throughout the entire document text.
- Currency amounts with commas and decimals (`$10,000.00`).
- Exclusion of generic non-individual salutations (e.g., `"Dear Investor"`, `"Dear Client"`).

### ⚠️ Documented Known Limitations:
1. **Unusual / Non-English Name Formats**: Single-word names without contextual prefix (e.g., `"Spoke with Aristotle yesterday"`) will not be recognized as names to prevent masking common nouns.
2. **Ambiguous Numeric Sequences**: Dates like `20241024` or ZIP codes might be classified as account numbers if they match 9-digit criteria without context.
3. **Written-out Currency**: Phrases like *"ten million dollars"* are not parsed as monetary figures by regex (numerical `$10,000,000` is required).

---

## 4. Multi-Provider Assist Engine (`gemini_assist.py`)

- **Primary Provider:** Google AI Studio Gemini (`gemini-3.6-flash` by default; `GEMINI_MODEL` override supported).
- **OpenRouter Gateway:** OpenAI-compatible completions via OpenRouter (`google/gemini-2.5-flash` default; `OPENROUTER_MODEL` override supported) when `OPENROUTER_API_KEY` is present.
- **Groq Provider:** Groq ultra-low-latency endpoint (`llama-3.3-70b-versatile` via OpenAI-compatible API; `GROQ_MODEL` override supported) when `GROQ_API_KEY` is present.
- **Configurable Dynamic Failover:** Automatically switches from primary to fallbacks (`LLM_FALLBACK_PROVIDERS="openrouter,groq"`) upon retry exhaustion or rate limits (HTTP 429 / 5xx).
- **Missing-Disclosure Detection by Absence:** Evaluates whether mandatory disclaimers (*"Past performance is no guarantee of future results"*, *"Loss of principal risk"*, fee schedules) are absent when securities/performance are discussed, producing `[MISSING MANDATORY DISCLOSURE]` flags.
- **Strict Pydantic Schema Validation:** Validates output against `AIAnalysisResult` and `ComplianceFlag` models (`passage`, `matched_rule_id`, `severity` [HIGH/MEDIUM/LOW], `explanation`).
- **Zero AI Verdicts:** The AI assistant only provides orientation flags; it **never** sets or pre-fills the final review status.
- **Structured failure handling:** Missing keys, provider failures, invalid responses, and exhausted retries return a degraded result with `LLM_FAILED`; the worker persists the safe user message and technical error separately.

---

## 5. Privacy Wall Inspection & Audit Tool

Per the project rubric:
> *"Submit a document seeded with a fake client name, email, and account number, then show the exact payload sent to the vendor — the real values are absent."*

Run the automated inspection tool:

```bash
python scripts/inspect_outbound_payload.py fixtures/sample_docs/04_high_pii_client_agreement.txt
```

The backend container owns Alembic migrations. The worker waits for the healthy
backend, then runs idempotent rules and synthetic precedent seeding before Celery
starts. The worker does not run migrations.

Disclosure thresholds can be evaluated with labeled examples using
`worker.data_eng.evaluate_disclosure_threshold`. F1 is used to balance missed
disclosures against false alarms; a small example set is calibration evidence,
not a statistically significant quality estimate.

The script prints the raw text, local reverse mapping table, the exact HTTP JSON payload sent outbound, and runs automated assertions asserting zero raw PII leakage.

---

## 6. Verification & Test Suite

Run the full AI test suite:

```bash
python -m pytest worker/ai/test_pii_masker.py worker/ai/test_llm_fallback.py -v
```

All 23 test cases verify:
- Individual and multiple entity placeholder replacement.
- Server-side reverse mapping and round-trip unmasking.
- Groq, OpenRouter & Gemini outbound payload formatting conforming to OpenAI and Google specifications.
- Multi-tier automatic LLM failover resilience (Gemini -> OpenRouter -> Groq).
- Custom `LLM_FALLBACK_PROVIDERS` provider sequencing.
- Pydantic schema normalization & validation.
- Missing disclosure flag validation.
- Markdown fence stripping from LLM outputs.
- Outbound privacy wall proof across all synthetic document fixtures (`fixtures/sample_docs/*.txt`).
- Graceful degradation when offline or unconfigured.
