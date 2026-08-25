from enum import Enum
from typing import List, Dict, Optional
from pydantic import BaseModel, Field

class SeverityLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"

class FlagResult(BaseModel):
    passage: str = Field(..., description="Exact passage excerpt from the document triggering the flag")
    matched_rule_id: str = Field(..., description="The ID of the compliance rule or disclosure rule matched")
    severity: SeverityLevel = Field(..., description="Severity rating: LOW, MEDIUM, or HIGH")
    explanation: str = Field(..., description="One-line clear explanation of why the passage conflicts with the rule")

class AnalysisResult(BaseModel):
    summary: str = Field(..., description="2-3 sentence overview of the submitted document")
    flags: List[FlagResult] = Field(default_factory=list, description="List of rule-linked compliance flags")
    degraded: bool = Field(default=False, description="True if AI assist ran in fallback/degraded mode")

class OutboundPayloadProof(BaseModel):
    original_text_sample: str
    masked_text: str
    placeholders_detected: Dict[str, str]
    outbound_json_payload: str
    pii_leak_detected: bool = False
