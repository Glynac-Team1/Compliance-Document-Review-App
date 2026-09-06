"""
Pydantic schemas for the Compliance Document Review AI Assist Engine.
Enforces strict typing and JSON validation for summaries and traceable flags.
"""

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class Severity(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class ComplianceFlag(BaseModel):
    passage: str = Field(
        description="Exact excerpt from document or '[MISSING MANDATORY DISCLOSURE]'"
    )
    matched_rule_id: str = Field(
        description="Applicable rule ID from compliance corpus (e.g. RULE_FINRA_2210_NO_GUARANTEES)"
    )
    severity: Severity = Field(
        description="Severity level: HIGH, MEDIUM, or LOW"
    )
    explanation: str = Field(
        description="Clear, one-line rationale explaining why the passage conflicts with the rule or why disclosure is required"
    )

    @field_validator("severity", mode="before")
    @classmethod
    def normalize_severity(cls, v: str) -> Severity:
        if isinstance(v, str):
            v_upper = v.strip().upper()
            if v_upper in ("HIGH", "MEDIUM", "LOW"):
                return Severity(v_upper)
        return Severity.MEDIUM


class AIAnalysisResult(BaseModel):
    summary: str = Field(
        description="2-3 sentence overview of the submission"
    )
    flags: List[ComplianceFlag] = Field(
        default_factory=list,
        description="List of traceable compliance flags"
    )
    degraded: bool = Field(
        default=False,
        description="Whether analysis was performed in fallback/degraded mode"
    )
    provider: Optional[str] = Field(
        default=None,
        description="LLM provider used (e.g. 'gemini', 'groq', 'degraded_fallback')"
    )
    model: Optional[str] = Field(
        default=None,
        description="Model identifier used for analysis"
    )
