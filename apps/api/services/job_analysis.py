from services.ai_client import structured_generation
from prompts.job_analysis import JOB_ANALYSIS_SYSTEM, JOB_ANALYSIS_SCHEMA


async def analyze_job_description(raw_text: str) -> dict:
    extracted = await structured_generation(
        system=JOB_ANALYSIS_SYSTEM,
        user=f"Analyze this job description and extract structured requirements:\n\n{raw_text}",
        schema_description=JOB_ANALYSIS_SCHEMA,
        max_tokens=4096,
    )
    _safe_lists = [
        "must_have_skills", "nice_to_have_skills", "responsibilities",
        "domain_terms", "education_requirements", "language_requirements",
        "soft_skills", "keywords",
    ]
    for key in _safe_lists:
        if key not in extracted or not isinstance(extracted[key], list):
            extracted[key] = []
    return extracted
