from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from database import get_session
from models import CandidateProfile, JobDescription, GenerationRun
from schemas.generation import GenerationRequest, GenerationRunRead
from services.generation.resume import generate_resume
from services.generation.cover_letter import generate_cover_letter
from services.generation.match_analysis import generate_match_analysis

router = APIRouter()


@router.post("/resume", response_model=GenerationRunRead)
async def run_resume_generation(
    payload: GenerationRequest, session: Session = Depends(get_session)
):
    _validate_ids(payload, session)
    run = await generate_resume(payload, session)
    return run


@router.post("/cover-letter", response_model=GenerationRunRead)
async def run_cover_letter_generation(
    payload: GenerationRequest, session: Session = Depends(get_session)
):
    _validate_ids(payload, session)
    run = await generate_cover_letter(payload, session)
    return run


@router.post("/match-analysis", response_model=GenerationRunRead)
async def run_match_analysis(
    payload: GenerationRequest, session: Session = Depends(get_session)
):
    _validate_ids(payload, session)
    run = await generate_match_analysis(payload, session)
    return run


@router.get("/runs/{run_id}", response_model=GenerationRunRead)
def get_run(run_id: str, session: Session = Depends(get_session)):
    run = session.get(GenerationRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Generation run not found")
    return run


def _validate_ids(payload: GenerationRequest, session: Session) -> None:
    if not session.get(CandidateProfile, payload.profile_id):
        raise HTTPException(status_code=404, detail="Profile not found")
    if not session.get(JobDescription, payload.job_id):
        raise HTTPException(status_code=404, detail="Job not found")
