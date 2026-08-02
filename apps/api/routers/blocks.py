from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from database import get_session
from models import (
    CandidateProfile, Experience, Project, Skill, LanguageSkill,
    Education, Certification, Achievement, ContentBlock,
)
from schemas.blocks import (
    ExperienceCreate, ExperienceUpdate, ExperienceRead,
    ProjectCreate, ProjectUpdate, ProjectRead,
    SkillCreate, SkillUpdate, SkillRead,
    EducationCreate, EducationUpdate, EducationRead,
    LanguageCreate, LanguageUpdate, LanguageRead,
    CertificationCreate, CertificationUpdate, CertificationRead,
    AchievementCreate, AchievementUpdate, AchievementRead,
    ContentBlockCreate, ContentBlockUpdate, ContentBlockRead,
)

router = APIRouter()


def _get_profile(profile_id: str, session: Session) -> CandidateProfile:
    profile = session.get(CandidateProfile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


# ── Experience ───────────────────────────────────────────────────────────────

@router.post("/{profile_id}/experiences", response_model=ExperienceRead, status_code=201)
def create_experience(
    profile_id: str, payload: ExperienceCreate, session: Session = Depends(get_session)
):
    _get_profile(profile_id, session)
    exp = Experience(profile_id=profile_id, **payload.model_dump())
    session.add(exp)
    session.commit()
    session.refresh(exp)
    return exp


@router.patch("/{profile_id}/experiences/{exp_id}", response_model=ExperienceRead)
def update_experience(
    profile_id: str, exp_id: str, payload: ExperienceUpdate, session: Session = Depends(get_session)
):
    exp = session.get(Experience, exp_id)
    if not exp or exp.profile_id != profile_id:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(exp, k, v)
    session.add(exp)
    session.commit()
    session.refresh(exp)
    return exp


@router.delete("/{profile_id}/experiences/{exp_id}", status_code=204)
def delete_experience(
    profile_id: str, exp_id: str, session: Session = Depends(get_session)
):
    exp = session.get(Experience, exp_id)
    if not exp or exp.profile_id != profile_id:
        raise HTTPException(status_code=404, detail="Not found")
    session.delete(exp)
    session.commit()


# ── Project ──────────────────────────────────────────────────────────────────

@router.post("/{profile_id}/projects", response_model=ProjectRead, status_code=201)
def create_project(
    profile_id: str, payload: ProjectCreate, session: Session = Depends(get_session)
):
    _get_profile(profile_id, session)
    obj = Project(profile_id=profile_id, **payload.model_dump())
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.patch("/{profile_id}/projects/{obj_id}", response_model=ProjectRead)
def update_project(
    profile_id: str, obj_id: str, payload: ProjectUpdate, session: Session = Depends(get_session)
):
    obj = session.get(Project, obj_id)
    if not obj or obj.profile_id != profile_id:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.delete("/{profile_id}/projects/{obj_id}", status_code=204)
def delete_project(
    profile_id: str, obj_id: str, session: Session = Depends(get_session)
):
    obj = session.get(Project, obj_id)
    if not obj or obj.profile_id != profile_id:
        raise HTTPException(status_code=404, detail="Not found")
    session.delete(obj)
    session.commit()


# ── Skill ────────────────────────────────────────────────────────────────────

@router.post("/{profile_id}/skills", response_model=SkillRead, status_code=201)
def create_skill(
    profile_id: str, payload: SkillCreate, session: Session = Depends(get_session)
):
    _get_profile(profile_id, session)
    obj = Skill(profile_id=profile_id, **payload.model_dump())
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.patch("/{profile_id}/skills/{obj_id}", response_model=SkillRead)
def update_skill(
    profile_id: str, obj_id: str, payload: SkillUpdate, session: Session = Depends(get_session)
):
    obj = session.get(Skill, obj_id)
    if not obj or obj.profile_id != profile_id:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.delete("/{profile_id}/skills/{obj_id}", status_code=204)
def delete_skill(
    profile_id: str, obj_id: str, session: Session = Depends(get_session)
):
    obj = session.get(Skill, obj_id)
    if not obj or obj.profile_id != profile_id:
        raise HTTPException(status_code=404, detail="Not found")
    session.delete(obj)
    session.commit()


# ── Education ────────────────────────────────────────────────────────────────

@router.post("/{profile_id}/educations", response_model=EducationRead, status_code=201)
def create_education(
    profile_id: str, payload: EducationCreate, session: Session = Depends(get_session)
):
    _get_profile(profile_id, session)
    obj = Education(profile_id=profile_id, **payload.model_dump())
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.patch("/{profile_id}/educations/{obj_id}", response_model=EducationRead)
def update_education(
    profile_id: str, obj_id: str, payload: EducationUpdate, session: Session = Depends(get_session)
):
    obj = session.get(Education, obj_id)
    if not obj or obj.profile_id != profile_id:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.delete("/{profile_id}/educations/{obj_id}", status_code=204)
def delete_education(
    profile_id: str, obj_id: str, session: Session = Depends(get_session)
):
    obj = session.get(Education, obj_id)
    if not obj or obj.profile_id != profile_id:
        raise HTTPException(status_code=404, detail="Not found")
    session.delete(obj)
    session.commit()


# ── Language ─────────────────────────────────────────────────────────────────

@router.post("/{profile_id}/languages", response_model=LanguageRead, status_code=201)
def create_language(
    profile_id: str, payload: LanguageCreate, session: Session = Depends(get_session)
):
    _get_profile(profile_id, session)
    obj = LanguageSkill(profile_id=profile_id, **payload.model_dump())
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.patch("/{profile_id}/languages/{obj_id}", response_model=LanguageRead)
def update_language(
    profile_id: str, obj_id: str, payload: LanguageUpdate, session: Session = Depends(get_session)
):
    obj = session.get(LanguageSkill, obj_id)
    if not obj or obj.profile_id != profile_id:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.delete("/{profile_id}/languages/{obj_id}", status_code=204)
def delete_language(
    profile_id: str, obj_id: str, session: Session = Depends(get_session)
):
    obj = session.get(LanguageSkill, obj_id)
    if not obj or obj.profile_id != profile_id:
        raise HTTPException(status_code=404, detail="Not found")
    session.delete(obj)
    session.commit()


# ── Certification ─────────────────────────────────────────────────────────────

@router.post("/{profile_id}/certifications", response_model=CertificationRead, status_code=201)
def create_certification(
    profile_id: str, payload: CertificationCreate, session: Session = Depends(get_session)
):
    _get_profile(profile_id, session)
    obj = Certification(profile_id=profile_id, **payload.model_dump())
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.patch("/{profile_id}/certifications/{obj_id}", response_model=CertificationRead)
def update_certification(
    profile_id: str, obj_id: str, payload: CertificationUpdate, session: Session = Depends(get_session)
):
    obj = session.get(Certification, obj_id)
    if not obj or obj.profile_id != profile_id:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.delete("/{profile_id}/certifications/{obj_id}", status_code=204)
def delete_certification(
    profile_id: str, obj_id: str, session: Session = Depends(get_session)
):
    obj = session.get(Certification, obj_id)
    if not obj or obj.profile_id != profile_id:
        raise HTTPException(status_code=404, detail="Not found")
    session.delete(obj)
    session.commit()


# ── Achievement ───────────────────────────────────────────────────────────────

@router.post("/{profile_id}/achievements", response_model=AchievementRead, status_code=201)
def create_achievement(
    profile_id: str, payload: AchievementCreate, session: Session = Depends(get_session)
):
    _get_profile(profile_id, session)
    obj = Achievement(profile_id=profile_id, **payload.model_dump())
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.patch("/{profile_id}/achievements/{obj_id}", response_model=AchievementRead)
def update_achievement(
    profile_id: str, obj_id: str, payload: AchievementUpdate, session: Session = Depends(get_session)
):
    obj = session.get(Achievement, obj_id)
    if not obj or obj.profile_id != profile_id:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.delete("/{profile_id}/achievements/{obj_id}", status_code=204)
def delete_achievement(
    profile_id: str, obj_id: str, session: Session = Depends(get_session)
):
    obj = session.get(Achievement, obj_id)
    if not obj or obj.profile_id != profile_id:
        raise HTTPException(status_code=404, detail="Not found")
    session.delete(obj)
    session.commit()


# ── Content Block ────────────────────────────────────────────────────────────

@router.get("/{profile_id}/content-blocks", response_model=list[ContentBlockRead])
def list_content_blocks(
    profile_id: str,
    approved: bool | None = Query(default=None),
    kind: str | None = Query(default=None),
    session: Session = Depends(get_session),
):
    _get_profile(profile_id, session)
    stmt = select(ContentBlock).where(ContentBlock.profile_id == profile_id)
    if approved is not None:
        stmt = stmt.where(ContentBlock.approved == approved)
    if kind is not None:
        stmt = stmt.where(ContentBlock.kind == kind)
    return session.exec(stmt.order_by(ContentBlock.parent_id, ContentBlock.priority)).all()


@router.post("/{profile_id}/content-blocks", response_model=ContentBlockRead, status_code=201)
def create_content_block(
    profile_id: str, payload: ContentBlockCreate, session: Session = Depends(get_session)
):
    _get_profile(profile_id, session)
    obj = ContentBlock(profile_id=profile_id, **payload.model_dump())
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.patch("/{profile_id}/content-blocks/{block_id}", response_model=ContentBlockRead)
def update_content_block(
    profile_id: str, block_id: str, payload: ContentBlockUpdate, session: Session = Depends(get_session)
):
    obj = session.get(ContentBlock, block_id)
    if not obj or obj.profile_id != profile_id:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    obj.updated_at = datetime.utcnow()
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.delete("/{profile_id}/content-blocks/{block_id}", status_code=204)
def delete_content_block(
    profile_id: str, block_id: str, session: Session = Depends(get_session)
):
    obj = session.get(ContentBlock, block_id)
    if not obj or obj.profile_id != profile_id:
        raise HTTPException(status_code=404, detail="Not found")
    session.delete(obj)
    session.commit()


@router.post("/{profile_id}/content-blocks/bootstrap", response_model=list[ContentBlockRead])
def bootstrap_content_blocks(profile_id: str, session: Session = Depends(get_session)):
    """One-time migration helper: turns existing free-text bullets/summaries into
    draft (unapproved) ContentBlocks so the candidate can review and approve them
    instead of starting from a blank page. Skips parents that already have blocks."""
    profile = _get_profile(profile_id, session)
    existing_parent_ids = {
        b.parent_id
        for b in session.exec(
            select(ContentBlock).where(ContentBlock.profile_id == profile_id)
        ).all()
    }
    created: list[ContentBlock] = []

    experiences = session.exec(select(Experience).where(Experience.profile_id == profile_id)).all()
    for exp in experiences:
        if exp.id in existing_parent_ids:
            continue
        for i, bullet in enumerate(exp.bullets or []):
            text = bullet.get("text") if isinstance(bullet, dict) else bullet
            if not text:
                continue
            created.append(ContentBlock(
                profile_id=profile_id, parent_type="experience", parent_id=exp.id,
                kind="bullet", text=text, priority=i, role_tags=exp.domain_tags or [],
                keywords=exp.tech_stack or [], approved=False,
            ))

    projects = session.exec(select(Project).where(Project.profile_id == profile_id)).all()
    for proj in projects:
        if proj.id in existing_parent_ids:
            continue
        for i, bullet in enumerate(proj.bullets or []):
            text = bullet.get("text") if isinstance(bullet, dict) else bullet
            if not text:
                continue
            created.append(ContentBlock(
                profile_id=profile_id, parent_type="project", parent_id=proj.id,
                kind="bullet", text=text, priority=i, keywords=proj.technologies or [],
                approved=False,
            ))

    if "standalone" not in existing_parent_ids:
        for i, summary in enumerate(profile.summary_variants or []):
            if not summary:
                continue
            created.append(ContentBlock(
                profile_id=profile_id, parent_type="standalone", parent_id=None,
                kind="summary", text=summary, priority=i, approved=False,
            ))

    for obj in created:
        session.add(obj)
    session.commit()
    for obj in created:
        session.refresh(obj)
    return created
