"""
Standard Compliance Rules & Disclosures Corpus for Northstar Advisory.
Conforms to FINRA / SEC style advertising and communication standards.
Provides realistic compliance rules for the AI assist engine.
"""

from typing import List, Dict

COMPLIANCE_RULES_CORPUS: List[Dict[str, str]] = [
    # 1. Prohibited Performance & Guarantee Claims
    {
        "id": "RULE_FINRA_2210_NO_GUARANTEES",
        "category": "PROHIBITED_CLAIM",
        "text": "Statements promising or guaranteeing specific investment returns, yields, or protection against loss are strictly prohibited."
    },
    {
        "id": "RULE_SEC_206_4_EXAGGERATED_CLAIMS",
        "category": "PROHIBITED_CLAIM",
        "text": "Communications must not make promissory, exaggerated, unwarranted, or misleading claims regarding advisor capabilities or performance."
    },
    {
        "id": "RULE_FINRA_2210_RISK_FREE",
        "category": "PROHIBITED_CLAIM",
        "text": "Any claim describing an investment or equity strategy as 'risk-free', 'fail-safe', or 'guaranteed safe' is strictly prohibited."
    },
    {
        "id": "RULE_FINRA_2210_SUPERLATIVES",
        "category": "PROHIBITED_CLAIM",
        "text": "Unsubstantiated superlatives such as 'top-ranked', 'the best performance in the country', or 'unmatched returns' without clear third-party source citations are prohibited."
    },

    # 2. Required Risk & Past Performance Disclosures
    {
        "id": "RULE_DISCLOSURE_PAST_PERFORMANCE",
        "category": "REQUIRED_DISCLOSURE",
        "text": "Any document mentioning past investment performance must prominently state: 'Past performance is no guarantee of future results.'"
    },
    {
        "id": "RULE_DISCLOSURE_PRINCIPAL_RISK",
        "category": "REQUIRED_DISCLOSURE",
        "text": "All marketing materials discussing securities must disclose: 'Investments are subject to market risk, including possible loss of principal.'"
    },
    {
        "id": "RULE_DISCLOSURE_FEE_SCHEDULE",
        "category": "REQUIRED_DISCLOSURE",
        "text": "Communications referencing portfolio management services must state whether advisory fees and transaction expenses are deducted or included."
    },
    {
        "id": "RULE_DISCLOSURE_TAX_LEGAL",
        "category": "REQUIRED_DISCLOSURE",
        "text": "Materials discussing estate planning or tax strategies must include: 'Northstar Advisory does not provide legal or tax advice. Consult a qualified professional.'"
    },
    {
        "id": "RULE_DISCLOSURE_HYPOTHETICAL_BACKTEST",
        "category": "REQUIRED_DISCLOSURE",
        "text": "Hypothetical or backtested performance models must be clearly identified as non-actual and disclose all underlying calculation assumptions."
    },

    # 3. Performance Presentation Standards
    {
        "id": "RULE_PERF_NET_OF_FEES",
        "category": "PERFORMANCE_STANDARD",
        "text": "Historical returns must be presented net of advisory and management fees, or clearly reflect the effect of gross vs net fee deductions."
    },
    {
        "id": "RULE_PERF_BENCHMARK_COMPARISON",
        "category": "PERFORMANCE_STANDARD",
        "text": "Comparisons to an index (e.g. S&P 500) must identify the benchmark, state whether dividends are reinvested, and disclose volatility differences."
    },
    {
        "id": "RULE_PERF_TIMEFRAME_STANDARDS",
        "category": "PERFORMANCE_STANDARD",
        "text": "Performance claims must reflect multi-year periods (e.g. 1-year, 5-year, 10-year or since inception) rather than selective cherry-picked quarters."
    },

    # 4. Mandatory Approval & Formatting Disclosures
    {
        "id": "RULE_FORM_SUPERVISORY_APPROVAL",
        "category": "FORMATTING_OBLIGATION",
        "text": "All client-facing newsletters and brochures must include the compliance approval identifier and publication date."
    },
    {
        "id": "RULE_FORM_ADVISORY_AFFILIATION",
        "category": "FORMATTING_OBLIGATION",
        "text": "Materials must state: 'Advisory services offered through Northstar Advisory Partners, an SEC-registered investment adviser.'"
    },
    {
        "id": "RULE_FORM_SIGNATURE_FIELD",
        "category": "FORMATTING_OBLIGATION",
        "text": "Client onboarding and account mandate documents must include designated client acknowledgment and advisor signature fields."
    }
]


def get_default_rules() -> List[Dict[str, str]]:
    """Returns the standard seeded compliance rules corpus."""
    return COMPLIANCE_RULES_CORPUS
