from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class LeadSearchRequest(BaseModel):
    query: str
    location: str = ""
    radius_km: int = 25
    size: int = 25
    exclude_senior: bool = True
    max_age_weeks: Optional[int] = 5


class LeadPasteRequest(BaseModel):
    url: Optional[str] = None
    raw_text: str
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None


class LeadStatusUpdate(BaseModel):
    status: str  # "new" | "liked" | "passed" | "applied"


class JobLeadRead(BaseModel):
    id: str
    source: str
    external_id: Optional[str] = None
    title: str
    company: Optional[str] = None
    location: Optional[str] = None
    url: Optional[str] = None
    raw_text: str
    posted_at: Optional[str] = None
    starts_at: Optional[str] = None
    status: str
    score: Optional[float] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class LeadConvertResponse(BaseModel):
    job_id: str
    application_id: str
