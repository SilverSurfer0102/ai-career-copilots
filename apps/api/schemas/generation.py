from __future__ import annotations
from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class GenerationRequest(BaseModel):
    profile_id: str
    job_id: str
    selected_evidence_ids: list[str] = []
    options: dict = {}  # e.g. {"language": "de", "tone": "formal"}


class GenerationRunRead(BaseModel):
    id: str
    profile_id: str
    job_description_id: str
    run_type: str
    status: str
    selected_evidence_ids: list
    generation_inputs: dict
    generation_outputs: dict
    intermediate_repr: dict
    validation_report: dict
    model_name: Optional[str] = None
    prompt_version: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
