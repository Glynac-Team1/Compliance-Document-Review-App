# AI Track Module - Compliance Document Review

This package contains the AI Assist Engine and PII Privacy Wall used by the worker.

## Components

- `pii_masker.py`: Masks client emails, phone numbers, account numbers, and dollar amounts before text reaches third-party providers or vector stores.
- `gemini_assist.py`: Calls Gemini with masked text and returns structured compliance analysis with graceful degradation.
- `test_pii_masker.py`: Unit tests for masking and unmasking behavior.

## Running Tests

From the repository root:

```bash
PYTHONPATH=. .venv/bin/python -m unittest discover -s worker/ai
```
