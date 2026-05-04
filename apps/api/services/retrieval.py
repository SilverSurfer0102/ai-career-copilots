"""
Keyword + rule-based retrieval service.
Interface is designed so semantic retrieval can be dropped in later
by replacing or augmenting the scoring in `build_evidence_pack`.
"""
import logging
from sqlmodel import Session, select

from models import (
    Experience, Project, Skill, LanguageSkill, Education,
    Publication, Certification, Achievement, EvidenceItem, JobDescription,
)
from schemas.retrieval import EvidencePackRead, EvidenceEntry

logger = logging.getLogger(__name__)


async def build_evidence_pack(
    profile_id: str,
    job: JobDescription,
    top_k: int,
    overrides: dict,
    session: Session,
) -> EvidencePackRead:
    job_keywords = _build_keyword_set(job)
    entries: list[EvidenceEntry] = []

    experiences = session.exec(select(Experience).where(Experience.profile_id == profile_id)).all()
    for exp in experiences:
        score, reasons = _score_experience(exp, job, job_keywords)
        if score > 0:
            entries.append(EvidenceEntry(
                entity_type="experience",
                entity_id=exp.id,
                evidence_ids=exp.evidence_refs or [],
                relevance_score=score,
                reasons=reasons,
            ))

    projects = session.exec(select(Project).where(Project.profile_id == profile_id)).all()
    for proj in projects:
        score, reasons = _score_project(proj, job, job_keywords)
        if score > 0:
            entries.append(EvidenceEntry(
                entity_type="project",
                entity_id=proj.id,
                evidence_ids=proj.evidence_refs or [],
                relevance_score=score,
                reasons=reasons,
            ))

    skills = session.exec(select(Skill).where(Skill.profile_id == profile_id)).all()
    skill_scores = _score_skills(skills, job)
    if skill_scores:
        entries.append(EvidenceEntry(
            entity_type="skills",
            entity_id="skills_block",
            evidence_ids=[e for s in skills for e in (s.evidence_refs or [])],
            relevance_score=skill_scores["score"],
            reasons=skill_scores["reasons"],
        ))

    pubs = session.exec(select(Publication).where(Publication.profile_id == profile_id)).all()
    for pub in pubs:
        score, reasons = _score_publication(pub, job, job_keywords)
        if score > 0:
            entries.append(EvidenceEntry(
                entity_type="publication",
                entity_id=pub.id,
                evidence_ids=pub.evidence_refs or [],
                relevance_score=score,
                reasons=reasons,
            ))

    educations = session.exec(select(Education).where(Education.profile_id == profile_id)).all()
    for edu in educations:
        score, reasons = _score_education(edu, job)
        if score > 0:
            entries.append(EvidenceEntry(
                entity_type="education",
                entity_id=edu.id,
                evidence_ids=edu.evidence_refs or [],
                relevance_score=score,
                reasons=reasons,
            ))

    certs = session.exec(select(Certification).where(Certification.profile_id == profile_id)).all()
    for cert in certs:
        score, reasons = _score_certification(cert, job, job_keywords)
        if score > 0:
            entries.append(EvidenceEntry(
                entity_type="certification",
                entity_id=cert.id,
                evidence_ids=cert.evidence_refs or [],
                relevance_score=score,
                reasons=reasons,
            ))

    achievements = session.exec(select(Achievement).where(Achievement.profile_id == profile_id)).all()
    for ach in achievements:
        score, reasons = _score_achievement(ach, job, job_keywords)
        if score > 0:
            entries.append(EvidenceEntry(
                entity_type="achievement",
                entity_id=ach.id,
                evidence_ids=ach.evidence_refs or [],
                relevance_score=score,
                reasons=reasons,
            ))

    langs = session.exec(select(LanguageSkill).where(LanguageSkill.profile_id == profile_id)).all()
    if langs and job.language_requirements:
        req_langs = {l.lower() for l in job.language_requirements}
        matched = [l for l in langs if l.language.lower() in req_langs or any(l.language.lower() in r.lower() for r in job.language_requirements)]
        if matched:
            entries.append(EvidenceEntry(
                entity_type="languages",
                entity_id="languages_block",
                evidence_ids=[e for l in langs for e in (l.evidence_refs or [])],
                relevance_score=5.0,
                reasons=[f"Language match: {', '.join(l.language for l in matched)}"],
            ))

    # Apply trust_level weighting from evidence items
    evidence_trust = _build_evidence_trust_map(profile_id, session)
    for entry in entries:
        if entry.evidence_ids:
            max_trust = max((evidence_trust.get(eid, 1.0) for eid in entry.evidence_ids), default=1.0)
            entry.relevance_score = entry.relevance_score * max_trust

    # Apply manual overrides
    if overrides:
        entries = _apply_overrides(entries, overrides)

    entries.sort(key=lambda e: e.relevance_score, reverse=True)
    entries = entries[:top_k]
    total = sum(e.relevance_score for e in entries)

    return EvidencePackRead(
        profile_id=profile_id,
        job_id=job.id,
        entries=entries,
        total_score=total,
        retrieval_method="keyword",
    )


def _build_evidence_trust_map(profile_id: str, session: Session) -> dict[str, float]:
    items = session.exec(
        select(EvidenceItem.id, EvidenceItem.trust_level).where(EvidenceItem.profile_id == profile_id)
    ).all()
    return {item.id: item.trust_level for item in items}


def _build_keyword_set(job: JobDescription) -> set[str]:
    all_terms: list[str] = (
        job.must_have_skills
        + job.nice_to_have_skills
        + job.domain_terms
        + job.keywords
        + job.responsibilities
        + job.soft_skills
    )
    return {t.lower().strip() for t in all_terms if t}


def _token_overlap(text: str, keywords: set[str]) -> tuple[float, list[str]]:
    if not text or not keywords:
        return 0.0, []
    text_lower = text.lower()
    matched = [kw for kw in keywords if kw in text_lower]
    return float(len(matched)), matched


def _score_experience(exp: Experience, job: JobDescription, keywords: set[str]) -> tuple[float, list[str]]:
    score = 0.0
    reasons = []

    combined_text = " ".join(filter(None, [
        exp.role_title, exp.employer, exp.description,
        " ".join(exp.bullets or []),
        " ".join(exp.tech_stack or []),
        " ".join(exp.domain_tags or []),
    ]))
    kw_score, matched = _token_overlap(combined_text, keywords)
    if kw_score > 0:
        score += kw_score * 2
        reasons.append(f"Keyword matches: {', '.join(matched[:5])}")

    if job.title and job.title.lower() in (exp.role_title or "").lower():
        score += 5
        reasons.append(f"Role title match: {job.title}")

    must_have = set(s.lower() for s in job.must_have_skills)
    tech = set(t.lower() for t in (exp.tech_stack or []))
    overlap = must_have & tech
    if overlap:
        score += len(overlap) * 3
        reasons.append(f"Must-have skills in tech stack: {', '.join(overlap)}")

    return score, reasons


def _score_project(proj: Project, job: JobDescription, keywords: set[str]) -> tuple[float, list[str]]:
    score = 0.0
    reasons = []
    combined_text = " ".join(filter(None, [
        proj.title, proj.role, proj.description,
        " ".join(proj.bullets or []),
        " ".join(proj.technologies or []),
        " ".join(proj.outcomes or []),
    ]))
    kw_score, matched = _token_overlap(combined_text, keywords)
    if kw_score > 0:
        score += kw_score * 1.5
        reasons.append(f"Keyword matches: {', '.join(matched[:5])}")
    return score, reasons


def _score_skills(skills: list[Skill], job: JobDescription) -> dict | None:
    must_have = {s.lower() for s in job.must_have_skills}
    nice = {s.lower() for s in job.nice_to_have_skills}
    skill_names = {s.name.lower() for s in skills}
    synonyms = {syn.lower() for s in skills for syn in (getattr(s, "synonyms", None) or [])}
    all_skill_terms = skill_names | synonyms

    must_match = must_have & all_skill_terms
    nice_match = nice & all_skill_terms

    if not must_match and not nice_match:
        return None

    score = len(must_match) * 3 + len(nice_match) * 1
    reasons = []
    if must_match:
        reasons.append(f"Must-have skill matches: {', '.join(must_match)}")
    if nice_match:
        reasons.append(f"Nice-to-have matches: {', '.join(nice_match)}")
    return {"score": float(score), "reasons": reasons}


def _score_publication(pub: Publication, job: JobDescription, keywords: set[str]) -> tuple[float, list[str]]:
    combined = " ".join(filter(None, [
        pub.title, pub.abstract, " ".join(pub.keywords or [])
    ]))
    score, matched = _token_overlap(combined, keywords)
    reasons = [f"Publication keyword matches: {', '.join(matched[:5])}"] if matched else []
    return score, reasons


def _score_education(edu: Education, job: JobDescription) -> tuple[float, list[str]]:
    score = 0.0
    reasons = []
    edu_reqs = [r.lower() for r in (job.education_requirements or [])]
    combined = " ".join(filter(None, [edu.degree, edu.field_of_study, edu.institution])).lower()
    for req in edu_reqs:
        if any(word in combined for word in req.split()):
            score += 3
            reasons.append(f"Education requirement match: {req}")
            break
    return score, reasons


def _score_certification(cert: Certification, job: JobDescription, keywords: set[str]) -> tuple[float, list[str]]:
    combined = f"{cert.name} {cert.issuer}".lower()
    score, matched = _token_overlap(combined, keywords)
    reasons = [f"Certification keyword match: {', '.join(matched)}"] if matched else []
    return score, reasons


def _score_achievement(ach: Achievement, job: JobDescription, keywords: set[str]) -> tuple[float, list[str]]:
    score, matched = _token_overlap(ach.statement, keywords)
    reasons = [f"Achievement keyword match: {', '.join(matched[:3])}"] if matched else []
    return score * 1.5, reasons


def _apply_overrides(entries: list[EvidenceEntry], overrides: dict) -> list[EvidenceEntry]:
    result = []
    for entry in entries:
        action = overrides.get(entry.entity_id)
        if action == "exclude":
            continue
        if action == "include":
            entry.relevance_score = max(entry.relevance_score, 100.0)
        result.append(entry)
    return result
