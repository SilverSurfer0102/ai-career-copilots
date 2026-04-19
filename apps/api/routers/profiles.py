import logging
import os
import shutil
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlmodel import Session, select

from database import get_session
from models import (
    CandidateProfile, Experience, Project, Skill, LanguageSkill,
    Education, Publication, Certification, Achievement, EvidenceItem,
)
from schemas.profile import (
    ProfileCreate, ProfileUpdate, ProfileRead,
    ProfileBlocksRead,
)
from services.ingestion import ingest_document
from config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("", response_model=ProfileRead, status_code=201)
def create_profile(payload: ProfileCreate, session: Session = Depends(get_session)):
    profile = CandidateProfile(**payload.model_dump())
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


@router.get("", response_model=list[ProfileRead])
def list_profiles(session: Session = Depends(get_session)):
    return session.exec(select(CandidateProfile)).all()


@router.get("/{profile_id}", response_model=ProfileRead)
def get_profile(profile_id: str, session: Session = Depends(get_session)):
    profile = session.get(CandidateProfile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.patch("/{profile_id}", response_model=ProfileRead)
def update_profile(
    profile_id: str, payload: ProfileUpdate, session: Session = Depends(get_session)
):
    profile = session.get(CandidateProfile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(profile, key, value)
    profile.updated_at = datetime.utcnow()
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


@router.delete("/{profile_id}", status_code=204)
def delete_profile(profile_id: str, session: Session = Depends(get_session)):
    profile = session.get(CandidateProfile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    session.delete(profile)
    session.commit()


@router.post("/{profile_id}/import")
async def import_document(
    profile_id: str,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    profile = session.get(CandidateProfile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    upload_dir = os.path.join(settings.upload_dir, profile_id)
    os.makedirs(upload_dir, exist_ok=True)

    file_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename or "")[1].lower()
    dest_path = os.path.join(upload_dir, f"{file_id}{ext}")

    with open(dest_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    result = await ingest_document(
        profile_id=profile_id,
        file_path=dest_path,
        source_name=file.filename or "upload",
        session=session,
    )
    return result


@router.post("/{profile_id}/import-batch")
async def import_documents_batch(
    profile_id: str,
    files: List[UploadFile] = File(...),
    session: Session = Depends(get_session),
):
    profile = session.get(CandidateProfile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    upload_dir = os.path.join(settings.upload_dir, profile_id)
    os.makedirs(upload_dir, exist_ok=True)

    results = []
    for file in files:
        file_id = str(uuid.uuid4())
        ext = os.path.splitext(file.filename or "")[1].lower()
        dest_path = os.path.join(upload_dir, f"{file_id}{ext}")

        with open(dest_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        try:
            result = await ingest_document(
                profile_id=profile_id,
                file_path=dest_path,
                source_name=file.filename or "upload",
                session=session,
            )
            results.append({"filename": file.filename, **result})
        except Exception as exc:
            logger.error("Batch ingest failed for %s: %s", file.filename, exc)
            session.rollback()
            results.append({"filename": file.filename, "status": "error", "message": str(exc)})

    return {"results": results}


@router.post("/{profile_id}/freetext")
async def add_freetext_block(
    profile_id: str,
    text: str = Form(...),
    label: str = Form(default="Manual Entry"),
    session: Session = Depends(get_session),
):
    """Accept raw freetext from the user and run it through the ingestion pipeline."""
    from services.ingestion import ingest_freetext
    profile = session.get(CandidateProfile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    result = await ingest_freetext(
        profile_id=profile_id,
        text=text,
        source_name=label,
        session=session,
    )
    return result


@router.get("/{profile_id}/blocks", response_model=ProfileBlocksRead)
def get_profile_blocks(profile_id: str, session: Session = Depends(get_session)):
    profile = session.get(CandidateProfile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    return ProfileBlocksRead(
        profile=profile,
        experiences=session.exec(
            select(Experience).where(Experience.profile_id == profile_id)
        ).all(),
        projects=session.exec(
            select(Project).where(Project.profile_id == profile_id)
        ).all(),
        skills=session.exec(
            select(Skill).where(Skill.profile_id == profile_id)
        ).all(),
        languages=session.exec(
            select(LanguageSkill).where(LanguageSkill.profile_id == profile_id)
        ).all(),
        educations=session.exec(
            select(Education).where(Education.profile_id == profile_id)
        ).all(),
        publications=session.exec(
            select(Publication).where(Publication.profile_id == profile_id)
        ).all(),
        certifications=session.exec(
            select(Certification).where(Certification.profile_id == profile_id)
        ).all(),
        achievements=session.exec(
            select(Achievement).where(Achievement.profile_id == profile_id)
        ).all(),
        evidence_items=session.exec(
            select(EvidenceItem).where(EvidenceItem.profile_id == profile_id)
        ).all(),
    )
