from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from database import get_session
from models import GenerationRun, Application
from schemas.preflight import PreflightReport, ApplicationPreflightReport
from services.preflight import run_preflight, run_application_preflight
from services.diff_review import build_resume_diff

router = APIRouter()


@router.get("/runs/{run_id}", response_model=PreflightReport)
def preflight_run(run_id: str, session: Session = Depends(get_session)):
    run = session.get(GenerationRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Generation run not found")
    return run_preflight(run, session)


@router.get("/applications/{application_id}", response_model=ApplicationPreflightReport)
def preflight_application(application_id: str, session: Session = Depends(get_session)):
    if not session.get(Application, application_id):
        raise HTTPException(status_code=404, detail="Application not found")
    return run_application_preflight(application_id, session)


@router.get("/runs/{run_id}/diff")
def resume_diff(run_id: str, session: Session = Depends(get_session)):
    run = session.get(GenerationRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Generation run not found")
    if run.run_type not in ("resume", "resume_pool", "resume_compact"):
        raise HTTPException(status_code=400, detail="Diff view is only available for resume runs")
    return build_resume_diff(run, session)
