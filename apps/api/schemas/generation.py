from __future__ import annotations
from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class GenerationRequest(BaseModel):
    profile_id: str
    job_id: str
    selected_evidence_ids: list[str] = []
    options: dict = {}  # e.g. {"language": "de", "tone": "formal"}
    application_id: Optional[str] = None
    pool_run_id: Optional[str] = None


class PoolResumeRequest(BaseModel):
    profile_id: str
    options: dict = {}


class GenerationRunRead(BaseModel):
    id: str
    profile_id: str
    job_description_id: Optional[str] = None
    application_id: Optional[str] = None
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


class OutputPatch(BaseModel):
    path: str  # dot-notation path e.g. "sections.0.items.0.bullets.1.text"
    value: object = None
    op: str = "set"  # "set" | "append" | "delete"
