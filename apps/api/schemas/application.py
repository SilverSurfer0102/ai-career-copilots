from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class ApplicationCreate(BaseModel):
    profile_id: str
    job_id: str
    label: Optional[str] = None
    notes: Optional[str] = None


class ApplicationUpdate(BaseModel):
    status: Optional[str] = None
    label: Optional[str] = None
    notes: Optional[str] = None
    submitted_at: Optional[datetime] = None


class ApplicationRead(BaseModel):
    id: str
    profile_id: str
    job_id: str
    status: str
    label: Optional[str]
    notes: Optional[str]
    submitted_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    # Enriched fields joined at query time
    profile_name: Optional[str] = None
    job_title: Optional[str] = None
    job_company: Optional[str] = None

    model_config = {"from_attributes": True}


class RunSummary(BaseModel):
    id: str
    run_type: str
    status: str
    created_at: datetime
    completed_at: Optional[datetime]

    model_config = {"from_attributes": True}


class ApplicationDetail(ApplicationRead):
    runs: list[RunSummary] = []
