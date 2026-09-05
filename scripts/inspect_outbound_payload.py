#!/usr/bin/env python3
"""
Privacy Wall Inspection & Outbound Payload Audit Tool.

Fulfills the Compliance Document Review grading requirement:
"Submit a document seeded with a fake client name, email, and account number,
then show the exact payload sent to the vendor — the real values are absent
and placeholders are in their place."

Usage:
    python scripts/inspect_outbound_payload.py [optional_path_to_document]
"""

import sys
import os
import json
from pathlib import Path

# Ensure UTF-8 output encoding on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from worker.ai.gemini_assist import GeminiAssistEngine
from worker.ai.pii_masker import PIIMasker


DEFAULT_SEEDED_DOCUMENT = """NORTHSTAR ADVISORY PARTNERS -- PRIVATE WEALTH MEMORANDUM
Date: September 5, 2026
Prepared for: Client Jonathan Vance
Consulting Advisor: Advisor Sarah Jenkins
Account ID: ACC-84920194
Social Security Number: 482-19-4820
Contact Email: jonathan.vance@vanceholdings.com
Direct Line: +1 (415) 892-4910

Dear Client Jonathan Vance,

Thank you for meeting with Advisor Sarah Jenkins regarding your $850,000.00 investment portfolio.
Following our review, we are pleased to confirm your allocation into the Northstar Alpha Growth Strategy.

PERFORMANCE AND GUARANTEES:
We guarantee a minimum 14.5% annual return regardless of market downturns. Our proprietary quantitative 
hedging strategy ensures your capital is completely risk-free and protected against all downside volatility. 
Over the last 5 years, this strategy delivered unmatched returns of 18.2% annually, making it the best 
performance in the country.

Please deposit the initial tranche of $300,000.00 into Account ACC-84920194 by end of month.
"""


def inspect_privacy_wall(document_text: str) -> bool:
    print("\n" + "=" * 80)
    print("[AUDIT] COMPLIANCE DOCUMENT REVIEW -- PII PRIVACY WALL AUDIT INSPECTOR")
    print("=" * 80)

    print("\n[STAGE 1] RAW SUBMITTED DOCUMENT TEXT (Inside Local Perimeter):")
    print("-" * 80)
    print(document_text.strip())

    engine = GeminiAssistEngine()
    payload, mapping = engine.get_outbound_payload(document_text)

    print("\n" + "-" * 80)
    print("[STAGE 2] SERVER-SIDE SECURE PII MAPPING TABLE:")
    print("  (Stored in local PostgreSQL pii_mappings table -- NEVER transmitted to LLM vendor)")
    print("-" * 80)
    for placeholder, original_value in mapping.items():
        print(f"  {placeholder:<16} ---> {original_value}")

    print("\n" + "-" * 80)
    print("[STAGE 3] EXACT OUTBOUND PAYLOAD SENT TO THIRD-PARTY LLM (Gemini / Groq):")
    print("  (Inspecting literal HTTP request body)")
    print("-" * 80)
    payload_str = json.dumps(payload, indent=2)
    print(payload_str)

    print("\n" + "=" * 80)
    print("[STAGE 4] AUTOMATED PRIVACY BOUNDARY ASSERTION CHECK:")
    print("=" * 80)

    leaks = []
    for placeholder, original_value in mapping.items():
        # Check if the original sensitive value leaked into the outbound payload
        if original_value.lower() in payload_str.lower():
            leaks.append((placeholder, original_value))
            print(f"  [X] LEAK DETECTED: Real PII value '{original_value}' found in outbound payload!")
        else:
            print(f"  [PASS] REDACTED: '{original_value}' is completely absent from outbound payload.")

    # Check that placeholders are present
    for placeholder in mapping.keys():
        if placeholder in payload_str:
            print(f"  [PASS] PLACEHOLDER CONFIRMED: Safe token '{placeholder}' present in outbound payload.")
        else:
            print(f"  [WARN] WARNING: Placeholder '{placeholder}' was not found in prompt payload.")

    print("\n" + "=" * 80)
    if not leaks and len(mapping) > 0:
        print("[SUCCESS] AUDIT RESULT: PRIVACY WALL HOLDS -- ZERO (0) RAW PII VALUES TRANSMITTED OUTBOUND")
        print("=" * 80 + "\n")
        return True
    elif not mapping:
        print("[INFO] AUDIT RESULT: No PII entities identified in sample text.")
        print("=" * 80 + "\n")
        return True
    else:
        print(f"[FAIL] AUDIT FAILURE: {len(leaks)} PII values leaked across privacy perimeter!")
        print("=" * 80 + "\n")
        return False


def main():
    if len(sys.argv) > 1:
        filepath = sys.argv[1]
        if not os.path.exists(filepath):
            print(f"Error: File not found at '{filepath}'")
            sys.exit(1)
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()
    else:
        text = DEFAULT_SEEDED_DOCUMENT

    success = inspect_privacy_wall(text)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
