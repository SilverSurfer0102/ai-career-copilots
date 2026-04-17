from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from database import get_session
from models import JobDescription
from schemas.job import JobCreate, JobRead, JobAnalyzeRequest
from services.job_analysis import analyze_job_description

router = APIRouter()


@router.post("/analyze", response_model=JobRead)
async def analyze_and_create_job(
    payload: JobAnalyzeRequest, session: Session = Depends(get_session)
):
    structured = await analyze_job_description(payload.raw_text)
    job = JobDescription(raw_text=payload.raw_text, **structured)
    session.add(job)
    session.commit()
    session.refresh(job)
    return job


@router.post("", response_model=JobRead, status_code=201)
def create_job(payload: JobCreate, session: Session = Depends(get_session)):
    job = JobDescription(**payload.model_dump())
    session.add(job)
    session.commit()
    session.refresh(job)
    return job


@router.get("", response_model=list[JobRead])
def list_jobs(session: Session = Depends(get_session)):
    return session.exec(select(JobDescription)).all()


@router.get("/{job_id}", response_model=JobRead)
def get_job(job_id: str, session: Session = Depends(get_session)):
    job = session.get(JobDescription, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.delete("/{job_id}", status_code=204)
def delete_job(job_id: str, session: Session = Depends(get_session)):
    job = session.get(JobDescription, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    session.delete(job)
    session.commit()
