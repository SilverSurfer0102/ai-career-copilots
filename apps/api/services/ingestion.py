import logging
from datetime import datetime
from sqlmodel import Session

from models import (
    CandidateProfile, Experience, Project, Skill, LanguageSkill,
    Education, Publication, Certification, Achievement, EvidenceItem,
)
from services.parsers.dispatcher import dispatch_parse
from services.ai_client import structured_generation, structured_generation_with_pdf
from prompts.ingestion import INGESTION_SYSTEM, INGESTION_SCHEMA

logger = logging.getLogger(__name__)


async def ingest_document(
    profile_id: str,
    file_path: str,
    source_name: str,
    session: Session,
) -> dict:
    ext = file_path.rsplit(".", 1)[-1].lower()
    pdf_bytes: bytes | None = None

    if ext == "pdf":
        with open(file_path, "rb") as fh:
            pdf_bytes = fh.read()
        raw_text = f"[PDF nativ an Claude gesendet: {source_name}]"
    else:
        raw_text = dispatch_parse(file_path)
        if not raw_text.strip():
            return {"status": "empty", "message": "No text could be extracted from document."}

    evidence = EvidenceItem(
        profile_id=profile_id,
        source_type=_source_type_from_path(file_path),
        source_name=source_name,
        raw_text=raw_text,
        file_path=file_path,
        trust_level=0.9,
    )
    session.add(evidence)
    session.flush()

    extracted = await structured_generation_with_pdf(
        system=INGESTION_SYSTEM,
        user="Extract structured career data from this document:",
        schema_description=INGESTION_SCHEMA,
        pdf_bytes=pdf_bytes,
        max_tokens=8192,
    )

    doc_type = extracted.get("document_type", "cv")
    evidence.normalized_text = str(extracted)
    evidence.tags = ["ingested", doc_type]
    session.add(evidence)

    entity_links = []
    profile = session.get(CandidateProfile, profile_id)
    assert profile is not None

    personal = extracted.get("personal", {})
    if personal.get("display_name") and not profile.display_name:
        profile.display_name = personal["display_name"]
    if personal.get("email") and not profile.email:
        profile.email = personal["email"]
    if personal.get("phone") and not profile.phone:
        profile.phone = personal["phone"]
    if personal.get("location") and not profile.location:
        profile.location = personal["location"]
    if personal.get("website") and not profile.website:
        profile.website = personal["website"]
    if personal.get("linkedin_url") and not profile.linkedin_url:
        profile.linkedin_url = personal["linkedin_url"]
    if personal.get("github_url") and not profile.github_url:
        profile.github_url = personal["github_url"]
    if personal.get("summary_variants"):
        existing = profile.summary_variants or []
        profile.summary_variants = existing + personal["summary_variants"]
    profile.updated_at = datetime.utcnow()
    session.add(profile)

    for exp_data in extracted.get("experiences", []):
        exp = Experience(
            profile_id=profile_id,
            evidence_refs=[evidence.id],
            **_safe_pick(exp_data, [
                "employer", "role_title", "start_date", "end_date",
                "location", "employment_type", "description",
                "bullets", "tech_stack", "domain_tags",
            ]),
        )
        session.add(exp)
        entity_links.append({"type": "experience", "id": exp.id})

    for proj_data in extracted.get("projects", []):
        proj = Project(
            profile_id=profile_id,
            evidence_refs=[evidence.id],
            **_safe_pick(proj_data, [
                "title", "role", "time_period", "description",
                "bullets", "technologies", "outcomes", "links", "domain_tags",
            ]),
        )
        session.add(proj)
        entity_links.append({"type": "project", "id": proj.id})

    for skill_data in extracted.get("skills", []):
        skill = Skill(
            profile_id=profile_id,
            evidence_refs=[evidence.id],
            **_safe_pick(skill_data, ["name", "category", "proficiency", "years_of_experience"]),
        )
        session.add(skill)

    for lang_data in extracted.get("languages", []):
        lang = LanguageSkill(
            profile_id=profile_id,
            evidence_refs=[evidence.id],
            **_safe_pick(lang_data, ["language", "level"]),
        )
        session.add(lang)

    for edu_data in extracted.get("educations", []):
        edu = Education(
            profile_id=profile_id,
            evidence_refs=[evidence.id],
            **_safe_pick(edu_data, [
                "institution", "degree", "field_of_study",
                "start_date", "end_date", "grade", "achievements",
            ]),
        )
        session.add(edu)

    for pub_data in extracted.get("publications", []):
        pub = Publication(
            profile_id=profile_id,
            evidence_refs=[evidence.id],
            **_safe_pick(pub_data, [
                "title", "pub_type", "venue", "published_date",
                "coauthors", "abstract", "keywords", "links",
            ]),
        )
        session.add(pub)

    for cert_data in extracted.get("certifications", []):
        cert = Certification(
            profile_id=profile_id,
            evidence_refs=[evidence.id],
            **_safe_pick(cert_data, [
                "name", "issuer", "issued_date", "expiry_date",
                "credential_id", "credential_url",
            ]),
        )
        session.add(cert)

    for ach_data in extracted.get("achievements", []):
        ach = Achievement(
            profile_id=profile_id,
            evidence_refs=[evidence.id],
            **_safe_pick(ach_data, [
                "statement", "context", "metric_type", "metric_value",
            ]),
        )
        session.add(ach)

    evidence.entity_links = entity_links
    session.add(evidence)
    session.commit()

    return {
        "status": "ok",
        "evidence_id": evidence.id,
        "document_type": doc_type,
        "extracted_entities": {
            "experiences": len(extracted.get("experiences", [])),
            "projects": len(extracted.get("projects", [])),
            "skills": len(extracted.get("skills", [])),
            "languages": len(extracted.get("languages", [])),
            "educations": len(extracted.get("educations", [])),
            "publications": len(extracted.get("publications", [])),
            "certifications": len(extracted.get("certifications", [])),
            "achievements": len(extracted.get("achievements", [])),
        },
    }


async def ingest_freetext(
    profile_id: str,
    text: str,
    source_name: str,
    session: Session,
) -> dict:
    """Same pipeline as ingest_document but takes raw text directly (no file)."""
    if not text.strip():
        return {"status": "empty", "message": "No text provided."}

    evidence = EvidenceItem(
        profile_id=profile_id,
        source_type="freetext",
        source_name=source_name,
        raw_text=text,
        file_path=None,
        trust_level=0.95,
    )
    session.add(evidence)
    session.flush()

    extracted = await structured_generation(
        system=INGESTION_SYSTEM,
        user=f"Extract structured career data from this text:\n\n{text}",
        schema_description=INGESTION_SCHEMA,
        max_tokens=8192,
    )

    doc_type = extracted.get("document_type", "freetext")
    evidence.normalized_text = str(extracted)
    evidence.tags = ["ingested", "freetext", doc_type]
    session.add(evidence)

    entity_links = []
    profile = session.get(CandidateProfile, profile_id)
    assert profile is not None

    personal = extracted.get("personal", {})
    if personal.get("display_name") and not profile.display_name:
        profile.display_name = personal["display_name"]
    if personal.get("email") and not profile.email:
        profile.email = personal["email"]
    if personal.get("summary_variants"):
        existing = profile.summary_variants or []
        profile.summary_variants = existing + personal["summary_variants"]
    profile.updated_at = datetime.utcnow()
    session.add(profile)

    for exp_data in extracted.get("experiences", []):
        exp = Experience(
            profile_id=profile_id,
            evidence_refs=[evidence.id],
            **_safe_pick(exp_data, [
                "employer", "role_title", "start_date", "end_date",
                "location", "employment_type", "description",
                "bullets", "tech_stack", "domain_tags",
            ]),
        )
        session.add(exp)
        entity_links.append({"type": "experience", "id": exp.id})

    for proj_data in extracted.get("projects", []):
        proj = Project(
            profile_id=profile_id,
            evidence_refs=[evidence.id],
            **_safe_pick(proj_data, [
                "title", "role", "time_period", "description",
                "bullets", "technologies", "outcomes", "links", "domain_tags",
            ]),
        )
        session.add(proj)
        entity_links.append({"type": "project", "id": proj.id})

    for skill_data in extracted.get("skills", []):
        skill = Skill(
            profile_id=profile_id,
            evidence_refs=[evidence.id],
            **_safe_pick(skill_data, ["name", "category", "proficiency", "years_of_experience"]),
        )
        session.add(skill)

    for lang_data in extracted.get("languages", []):
        lang = LanguageSkill(
            profile_id=profile_id,
            evidence_refs=[evidence.id],
            **_safe_pick(lang_data, ["language", "level"]),
        )
        session.add(lang)

    for edu_data in extracted.get("educations", []):
        edu = Education(
            profile_id=profile_id,
            evidence_refs=[evidence.id],
            **_safe_pick(edu_data, [
                "institution", "degree", "field_of_study",
                "start_date", "end_date", "grade", "achievements",
            ]),
        )
        session.add(edu)

    for pub_data in extracted.get("publications", []):
        pub = Publication(
            profile_id=profile_id,
            evidence_refs=[evidence.id],
            **_safe_pick(pub_data, [
                "title", "pub_type", "venue", "published_date",
                "coauthors", "abstract", "keywords", "links",
            ]),
        )
        session.add(pub)

    for cert_data in extracted.get("certifications", []):
        cert = Certification(
            profile_id=profile_id,
            evidence_refs=[evidence.id],
            **_safe_pick(cert_data, [
                "name", "issuer", "issued_date", "expiry_date",
                "credential_id", "credential_url",
            ]),
        )
        session.add(cert)

    for ach_data in extracted.get("achievements", []):
        ach = Achievement(
            profile_id=profile_id,
            evidence_refs=[evidence.id],
            **_safe_pick(ach_data, [
                "statement", "context", "metric_type", "metric_value",
            ]),
        )
        session.add(ach)

    evidence.entity_links = entity_links
    session.add(evidence)
    session.commit()

    return {
        "status": "ok",
        "evidence_id": evidence.id,
        "document_type": doc_type,
        "extracted_entities": {
            "experiences": len(extracted.get("experiences", [])),
            "projects": len(extracted.get("projects", [])),
            "skills": len(extracted.get("skills", [])),
            "languages": len(extracted.get("languages", [])),
            "educations": len(extracted.get("educations", [])),
            "publications": len(extracted.get("publications", [])),
            "certifications": len(extracted.get("certifications", [])),
            "achievements": len(extracted.get("achievements", [])),
        },
    }


def _source_type_from_path(path: str) -> str:
    ext = path.rsplit(".", 1)[-1].lower()
    return {"pdf": "pdf", "docx": "docx", "doc": "docx", "txt": "txt", "md": "md"}.get(ext, "file")


def _safe_pick(data: dict, keys: list) -> dict:
    return {k: v for k, v in data.items() if k in keys and v is not None}
