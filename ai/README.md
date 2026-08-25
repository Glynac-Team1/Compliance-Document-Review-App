# AI Track Module — Compliance Document Review

This directory contains the AI Assist Engine and PII Privacy Wall.

## Components
- **`pii_masker.py`**: Server-side regex and heuristic PII Masker. Strips client emails, phone numbers, account numbers, and dollar amounts before payloads reach third-party LLM APIs or vector stores.
- **`gemini_assist.py`**: Interacts with the Gemini API (via Google AI Studio) to generate document summaries and rule-traceable compliance flags with graceful degradation fallback.
- **`test_pii_masker.py`**: Pytest / unittest suite for the PII masker.

## Running Tests
From the root directory:
```bash
python -m unittest discover -s ai
```
