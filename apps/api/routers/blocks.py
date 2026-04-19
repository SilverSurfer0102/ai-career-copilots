from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from database import get_session
from models import (
    CandidateProfile, Experience, Project, Skill, LanguageSkill,
    Education, Certification, Achievement,
)
from schemas.blocks import (
    ExperienceCreate, ExperienceUpdate, ExperienceRead,
    ProjectCreate, ProjectUpdate, ProjectRead,
    SkillCreate, SkillUpdate, SkillRead,
    EducationCreate, EducationUpdate, EducationRead,
    LanguageCreate, LanguageUpdate, LanguageRead,
    CertificationCreate, CertificationUpdate, CertificationRead,
    AchievementCreate, AchievementUpdate, AchievementRead,
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
