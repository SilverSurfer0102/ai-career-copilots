from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from database import get_session
from models import Application, GenerationRun, CandidateProfile, JobDescription
from schemas.application import ApplicationCreate, ApplicationUpdate, ApplicationRead, ApplicationDetail, RunSummary

router = APIRouter()


def _enrich(app: Application, session: Session) -> ApplicationRead:
    profile = session.get(CandidateProfile, app.profile_id)
    job = session.get(JobDescription, app.job_id)
    return ApplicationRead(
        **app.model_dump(),
        profile_name=profile.display_name if profile else None,
        job_title=job.title if job else None,
        job_company=job.company if job else None,
    )


@router.get("", response_model=list[ApplicationRead])
def list_applications(session: Session = Depends(get_session)):
    apps = session.exec(select(Application).order_by(Application.created_at.desc())).all()
    return [_enrich(a, session) for a in apps]


@router.post("", response_model=ApplicationRead, status_code=201)
def create_application(payload: ApplicationCreate, session: Session = Depends(get_session)):
    if not session.get(CandidateProfile, payload.profile_id):
        raise HTTPException(status_code=404, detail="Profile not found")
    if not session.get(JobDescription, payload.job_id):
        raise HTTPException(status_code=404, detail="Job not found")
    app = Application(**payload.model_dump())
    session.add(app)
    session.commit()
    session.refresh(app)
    return _enrich(app, session)


@router.get("/{app_id}", response_model=ApplicationDetail)
def get_application(app_id: str, session: Session = Depends(get_session)):
    app = session.get(Application, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    runs = session.exec(
        select(GenerationRun)
        .where(GenerationRun.application_id == app_id)
        .order_by(GenerationRun.created_at.desc())
    ).all()
    enriched = _enrich(app, session)
    return ApplicationDetail(
        **enriched.model_dump(),
        runs=[RunSummary.model_validate(r) for r in runs],
    )


@router.patch("/{app_id}", response_model=ApplicationRead)
def update_application(app_id: str, payload: ApplicationUpdate, session: Session = Depends(get_session)):
    app = session.get(Application, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(app, k, v)
    app.updated_at = datetime.utcnow()
    session.add(app)
    session.commit()
    session.refresh(app)
    return _enrich(app, session)


@router.delete("/{app_id}", status_code=204)
def delete_application(app_id: str, session: Session = Depends(get_session)):
    app = session.get(Application, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    session.delete(app)
    session.commit()
