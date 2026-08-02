from typing import Optional
from pydantic import BaseModel


class PreflightCheck(BaseModel):
    code: str
    label: str
    status: str  # pass | warn | block
    detail: Optional[str] = None


class PreflightReport(BaseModel):
    run_id: str
    run_type: str
    overall: str  # pass | warn | block
    checks: list[PreflightCheck]


class ApplicationPreflightReport(BaseModel):
    application_id: str
    overall: str
    resume: Optional[PreflightReport] = None
    cover_letter: Optional[PreflightReport] = None
