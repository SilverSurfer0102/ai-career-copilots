from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


class EvidencePackRequest(BaseModel):
    profile_id: str
    job_id: str
    top_k: int = 20
    overrides: dict = {}  # entity_id -> include/exclude


class EvidenceEntry(BaseModel):
    entity_type: str
    entity_id: str
    evidence_ids: list[str]
    relevance_score: float
    reasons: list[str]


class EvidencePackRead(BaseModel):
    profile_id: str
    job_id: str
    entries: list[EvidenceEntry]
    total_score: float
    retrieval_method: str = "keyword"
