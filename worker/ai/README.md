# AI Engineering Track — Compliance Document Review

**Engineer:** Basamsetti Venkata Vamsi  
**Track:** AI Engineering  
**Scope:** Server-Side PII Masker, Gemini 2.5 Flash Assist Engine, Prompt Engineering & Structured Output Schemas, Traceable Flag Generation, Reverse Unmasking for Display, and Outbound Privacy Payload Auditing.

---

## 1. Architecture Overview

The AI feature runs against free-tier third-party LLM providers (**Gemini 2.5 Flash** via Google AI Studio). Per the project privacy wall requirement, **raw client data never leaves the application perimeter**.

```
  Uploaded Document Text (Raw)
               │
               ▼
   ┌───────────────────────┐
   │    PIIMasker Engine   │ ───► Store Reverse Mapping Server-Side
   │  (Presidio + Regex)   │      (e.g., [CLIENT_1] -> "Jane Doe")
   └───────────────────────┘
               │
               ▼  (Zero raw PII leaves perimeter)
   ┌───────────────────────┐
   │  Outbound AI Payload  │ ───► Gemini 2.5 Flash API (Free Tier)
   │ (Masked Text + Rules) │
   └───────────────────────┘
               │
               ▼  (Structured JSON: summary + flags)
   ┌───────────────────────┐
   │   Response Unmasker   │ ───► Display Unmasked Output to Officer
   └───────────────────────┘
```

---

## 2. PII Masking Implementation (`pii_masker.py`)

The `PIIMasker` utilizes an ordered single-pass regex engine supplemented with Presidio entity extractors.

### Masked Entity Types & Placeholders:
| Entity Type | Example Input | Placeholder Format | Description |
|---|---|---|---|
| **Client / Person Name** | `Client Jane Smith`, `Dr. John Doe` | `[CLIENT_1]` | Contextual name detection following honorifics and relational tokens. |
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
- Client and advisor names preceded by common titles/roles (`Client`, `Advisor`, `Investor`, `Mr.`, `Ms.`, `Mrs.`, `Dr.`, `for`, `to`, `Dear`, `by`).
- Currency amounts with commas and decimals (`$10,000.00`).

### ⚠️ Documented Known Limitations:
1. **Unusual / Non-English Name Formats**: Single-word names without contextual prefix (e.g., `"Spoke with Aristotle yesterday"`) will not be recognized as names to prevent masking common nouns.
2. **Ambiguous Numeric Sequences**: Dates like `20241024` or ZIP codes might be classified as account numbers if they match 9-digit criteria without context.
3. **Written-out Currency**: Phrases like *"ten million dollars"* are not parsed as monetary figures by regex (numerical `$10,000,000` is required).

---

## 4. Gemini 2.5 Flash Assist Engine (`gemini_assist.py`)

- **Model:** `gemini-2.5-flash`
- **Structured JSON Output:** Returns `summary` (2-3 sentence overview) and `flags` (list of `{passage, matched_rule_id, severity, explanation}`).
- **Zero AI Verdicts:** The AI assistant only provides orientation flags; it **never** sets or pre-fills the final review status.
- **Graceful Degradation:** When `LLM_API_KEY` is not provided or rate limits are exceeded, the engine catches exceptions and returns a degraded status banner rather than crashing the application.

---

## 5. Verification & Unit Tests

Run the dedicated AI test suite:

```bash
python -m pytest worker/ai/test_pii_masker.py -v
```

All test cases verify:
- Entity placeholder replacement.
- Server-side reverse mapping and round-trip unmasking.
- Outbound payload privacy proof (asserting 0 raw PII in JSON body).
- Graceful degradation when offline or unconfigured.
