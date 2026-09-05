# AI Engineering Track — Compliance Document Review

**Engineer:** Basamsetti Venkata Vamsi  
**Track:** AI Engineering  
**Scope:** Server-Side PII Masker, Gemini & Groq Assist Engine with Failover, Strict Pydantic JSON Output Schemas, Traceable Flag Generation, Missing-Disclosure Detection by Absence, Reverse Unmasking for Display, and Outbound Privacy Payload Auditing.

---

## 1. Architecture Overview

The AI feature runs against free-tier third-party LLM providers (**Gemini 1.5/2.0 Flash** via Google AI Studio and **Groq LLaMA-3.3-70B** as automatic fallback). Per the project privacy wall requirement, **raw client data never leaves the application perimeter**.

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
   │  Outbound AI Payload  │ ───► Gemini 1.5 Flash API (Primary)
   │ (Masked Text + Rules) │      └── Failover: Groq LLaMA-3.3-70B
   └───────────────────────┘
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

- **Primary Provider:** Google AI Studio Gemini (`gemini-1.5-flash` / `gemini-2.0-flash`).
- **Failover Provider:** Groq (`llama-3.3-70b-versatile` via OpenAI-compatible endpoint).
- **Missing-Disclosure Detection by Absence:** Evaluates whether mandatory disclaimers (*"Past performance is no guarantee of future results"*, *"Loss of principal risk"*, fee schedules) are absent when securities/performance are discussed, producing `[MISSING MANDATORY DISCLOSURE]` flags.
- **Strict Pydantic Schema Validation:** Validates output against `AIAnalysisResult` and `ComplianceFlag` models (`passage`, `matched_rule_id`, `severity` [HIGH/MEDIUM/LOW], `explanation`).
- **Zero AI Verdicts:** The AI assistant only provides orientation flags; it **never** sets or pre-fills the final review status.
- **Graceful Degradation:** When `LLM_API_KEY` is missing or rate limits are exceeded, the engine returns a clean degraded status banner rather than crashing the review queue.

---

## 5. Privacy Wall Inspection & Audit Tool

Per the project rubric:
> *"Submit a document seeded with a fake client name, email, and account number, then show the exact payload sent to the vendor — the real values are absent."*

Run the automated inspection tool:

```bash
python scripts/inspect_outbound_payload.py fixtures/sample_docs/04_high_pii_client_agreement.txt
```

The script prints the raw text, local reverse mapping table, the exact HTTP JSON payload sent outbound, and runs automated assertions asserting zero raw PII leakage.

---

## 6. Verification & Test Suite

Run the full AI test suite:

```bash
python -m pytest worker/ai/test_pii_masker.py -v
```

All 15 test cases verify:
- Individual and multiple entity placeholder replacement.
- Server-side reverse mapping and round-trip unmasking.
- Groq & Gemini outbound payload formatting.
- Pydantic schema normalization & validation.
- Missing disclosure flag validation.
- Markdown fence stripping from LLM outputs.
- Outbound privacy wall proof across all synthetic document fixtures (`fixtures/sample_docs/*.txt`).
- Graceful degradation when offline or unconfigured.
