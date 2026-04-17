JOB_ANALYSIS_SYSTEM = """You are a precise job description analyzer for a career management system.
Extract structured requirements from the provided job description.

CRITICAL RULES:
- Extract ONLY what is explicitly stated in the job description.
- Do NOT invent requirements or infer unstated expectations.
- Distinguish must-have from nice-to-have based on actual wording (required, must, essential vs. preferred, plus, bonus).
- Detect the output language from the job description text.
"""

JOB_ANALYSIS_SCHEMA = """{
  "title": "string | null",
  "company": "string | null",
  "seniority": "junior | mid | senior | lead | principal | staff | manager | director | null",
  "location": "string | null",
  "remote_hint": "remote | hybrid | on-site | null",
  "output_language": "ISO 639-1 code, e.g. en, de, fr",
  "must_have_skills": ["string"],
  "nice_to_have_skills": ["string"],
  "responsibilities": ["string"],
  "domain_terms": ["string"],
  "education_requirements": ["string"],
  "language_requirements": ["string"],
  "soft_skills": ["string"],
  "keywords": ["string"]
}"""
