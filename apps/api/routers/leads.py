import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from database import get_session
from models import JobLead, JobDescription, Application, CandidateProfile
from schemas.job_lead import (
    LeadSearchRequest, LeadPasteRequest, LeadStatusUpdate, JobLeadRead, LeadConvertResponse,
)
from services.sources import bundesagentur
from services.sources.bundesagentur import dedupe_hash
from services.job_analysis import analyze_job_description

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/search-bundesagentur", response_model=list[JobLeadRead])
async def search_bundesagentur(payload: LeadSearchRequest, session: Session = Depends(get_session)):
    found = await bundesagentur.search_jobs(
        query=payload.query, location=payload.location,
        radius_km=payload.radius_km, size=payload.size,
    )
    existing_hashes = set(session.exec(select(JobLead.dedupe_hash)).all())
    created = []
    for lead in found:
        if lead["dedupe_hash"] in existing_hashes:
            continue
        obj = JobLead(source="bundesagentur", status="new", raw_text="", **lead)
        session.add(obj)
        created.append(obj)
        existing_hashes.add(lead["dedupe_hash"])
    session.commit()
    for obj in created:
        session.refresh(obj)
    return created


@router.post("/paste", response_model=JobLeadRead, status_code=201)
def paste_lead(payload: LeadPasteRequest, session: Session = Depends(get_session)):
    title = payload.title or (payload.raw_text.splitlines()[0][:120] if payload.raw_text else "Unbenannte Stelle")
    dhash = dedupe_hash(payload.company, title, payload.location)
    obj = JobLead(
        source="paste", title=title, company=payload.company, location=payload.location,
        url=payload.url, raw_text=payload.raw_text, status="new", dedupe_hash=dhash,
    )
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.get("", response_model=list[JobLeadRead])
def list_leads(
    status: str | None = Query(default="new"),
    session: Session = Depends(get_session),
):
    stmt = select(JobLead).order_by(JobLead.created_at.desc())
    if status:
        stmt = stmt.where(JobLead.status == status)
    return session.exec(stmt).all()


@router.patch("/{lead_id}", response_model=JobLeadRead)
def update_lead_status(lead_id: str, payload: LeadStatusUpdate, session: Session = Depends(get_session)):
    lead = session.get(JobLead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    lead.status = payload.status
    session.add(lead)
    session.commit()
    session.refresh(lead)
    return lead


@router.post("/{lead_id}/convert", response_model=LeadConvertResponse)
async def convert_lead(lead_id: str, profile_id: str, session: Session = Depends(get_session)):
    """Turns a liked lead into a real JobDescription + draft Application.
    This is the moment the swipe queue hands off into the existing,
    already-working generation pipeline — nothing about it changes."""
    lead = session.get(JobLead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if not session.get(CandidateProfile, profile_id):
        raise HTTPException(status_code=404, detail="Profile not found")

    raw_text = lead.raw_text
    if not raw_text and lead.source == "bundesagentur" and lead.external_id:
        raw_text = await bundesagentur.fetch_job_description(lead.external_id)
    if not raw_text:
        raw_text = f"{lead.title}\n{lead.company or ''}\n{lead.location or ''}\n\nSiehe: {lead.url or '(keine URL)'}"

    structured = await analyze_job_description(raw_text)
    structured.setdefault("title", lead.title)
    structured.setdefault("company", lead.company)
    structured.setdefault("location", lead.location)
    job = JobDescription(raw_text=raw_text, **structured)
    session.add(job)

    lead.status = "liked"
    session.add(lead)
    session.commit()
    session.refresh(job)

    application = Application(profile_id=profile_id, job_id=job.id, status="draft")
    session.add(application)
    session.commit()
    session.refresh(application)

    return LeadConvertResponse(job_id=job.id, application_id=application.id)


@router.delete("/{lead_id}", status_code=204)
def delete_lead(lead_id: str, session: Session = Depends(get_session)):
    lead = session.get(JobLead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    session.delete(lead)
    session.commit()
