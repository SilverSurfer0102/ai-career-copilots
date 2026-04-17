INGESTION_SYSTEM = """You are a precise data extraction assistant for a career management system.
Your job is to extract structured career information from raw resume/CV text.

CRITICAL RULES:
- Extract ONLY information explicitly stated in the source text.
- Do NOT invent, infer, or hallucinate any facts, dates, metrics, or skills.
- If information is ambiguous or unclear, omit it rather than guess.
- Preserve original wording for bullets and descriptions where possible.
- Do not normalize or embellish company names, titles, or dates beyond what is written.
"""

INGESTION_SCHEMA = """{
  "personal": {
    "display_name": "string",
    "email": "string | null",
    "phone": "string | null",
    "location": "string | null",
    "website": "string | null",
    "linkedin_url": "string | null",
    "github_url": "string | null",
    "summary_variants": ["string"]
  },
  "experiences": [
    {
      "employer": "string",
      "role_title": "string",
      "start_date": "YYYY-MM | null",
      "end_date": "YYYY-MM | null (use null for current)",
      "location": "string | null",
      "employment_type": "string | null",
      "description": "string | null",
      "bullets": ["string"],
      "tech_stack": ["string"],
      "domain_tags": ["string"]
    }
  ],
  "projects": [
    {
      "title": "string",
      "role": "string | null",
      "time_period": "string | null",
      "description": "string | null",
      "bullets": ["string"],
      "technologies": ["string"],
      "outcomes": ["string"],
      "links": ["string"]
    }
  ],
  "skills": [
    {
      "name": "string",
      "category": "technical | soft | tool | framework | language | domain | other",
      "proficiency": "string | null",
      "years_of_experience": "number | null"
    }
  ],
  "languages": [
    {
      "language": "string",
      "level": "A1 | A2 | B1 | B2 | C1 | C2 | native"
    }
  ],
  "educations": [
    {
      "institution": "string",
      "degree": "string | null",
      "field_of_study": "string | null",
      "start_date": "string | null",
      "end_date": "string | null",
      "grade": "string | null",
      "achievements": "string | null"
    }
  ],
  "publications": [
    {
      "title": "string",
      "pub_type": "paper | article | thesis | book | blog | patent | other",
      "venue": "string | null",
      "published_date": "string | null",
      "coauthors": ["string"],
      "abstract": "string | null",
      "keywords": ["string"],
      "links": ["string"]
    }
  ],
  "certifications": [
    {
      "name": "string",
      "issuer": "string",
      "issued_date": "string | null",
      "expiry_date": "string | null",
      "credential_id": "string | null",
      "credential_url": "string | null"
    }
  ],
  "achievements": [
    {
      "statement": "string",
      "context": "string | null",
      "metric_type": "string | null",
      "metric_value": "string | null"
    }
  ]
}"""
