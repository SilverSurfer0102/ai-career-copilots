from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


class ValidationRequest(BaseModel):
    run_id: str


class ClaimValidation(BaseModel):
    claim: str
    supported: bool
    evidence_ids: list[str]
    risk_level: str  # none, low, medium, high
    reason: Optional[str] = None


class ValidationReportRead(BaseModel):
    run_id: str
    overall_supported: bool
    unsupported_count: int
    high_risk_count: int
    claims: list[ClaimValidation]
    summary: str
