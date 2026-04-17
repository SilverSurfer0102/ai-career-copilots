from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from database import get_session
from models import CandidateProfile, JobDescription
from schemas.retrieval import EvidencePackRequest, EvidencePackRead
from services.retrieval import build_evidence_pack

router = APIRouter()


@router.post("/evidence-pack", response_model=EvidencePackRead)
async def get_evidence_pack(
    payload: EvidencePackRequest, session: Session = Depends(get_session)
):
    profile = session.get(CandidateProfile, payload.profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    job = session.get(JobDescription, payload.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    pack = await build_evidence_pack(
        profile_id=payload.profile_id,
        job=job,
        top_k=payload.top_k,
        overrides=payload.overrides,
        session=session,
    )
    return pack
