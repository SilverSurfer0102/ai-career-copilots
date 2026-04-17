# Architecture

## Components

```
┌─────────────────────────────────────────────────────────┐
│  Browser (Next.js 14 App Router)                        │
│  Profile │ Jobs │ Review │ Workspace │ Export           │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP/JSON
┌───────────────────────▼─────────────────────────────────┐
│  FastAPI (apps/api/)                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ /profiles│ │  /jobs   │ │/retrieval│ │ /generate │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│  ┌──────────┐ ┌──────────┐                              │
│  │/validate │ │  /export │                              │
│  └──────────┘ └──────────┘                              │
│                                                         │
│  Services                                               │
│  ├── ingestion.py (parse → normalize → store)           │
│  ├── job_analysis.py (extract JD requirements)          │
│  ├── retrieval.py (keyword scoring + ranking)           │
│  ├── generation/resume.py                               │
│  ├── generation/cover_letter.py                         │
│  ├── generation/match_analysis.py                       │
│  ├── validation.py (claim verification)                 │
│  └── rendering.py (Jinja2 → HTML → PDF)                 │
│                                                         │
│  parsers/                                               │
│  ├── pdf_parser.py (pdfminer.six)                       │
│  ├── docx_parser.py (python-docx)                       │
│  └── text_parser.py (txt/md)                            │
│                                                         │
│  prompts/ (all prompt templates, versioned)             │
│  └── ingestion.py / job_analysis.py / generation.py     │
└───────────────────────┬─────────────────────────────────┘
                        │ SQLModel / psycopg2
┌───────────────────────▼─────────────────────────────────┐
│  PostgreSQL 16 + pgvector (Docker)                      │
│  12 tables: profiles, experiences, projects, skills,    │
│  languages, educations, publications, certifications,   │
│  achievements, evidence_items, job_descriptions,        │
│  generation_runs                                        │
└─────────────────────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│  Anthropic API (claude-sonnet-4-6)                      │
│  ├── Ingestion: raw text → structured JSON              │
│  ├── Job analysis: JD text → requirements JSON          │
│  ├── Generation: evidence + job → resume/letter JSON    │
│  └── Validation: generated content → claim report JSON  │
└─────────────────────────────────────────────────────────┘
```

## Request Flow — Generate Resume

```
POST /generate/resume
  ├── validate profile_id + job_id exist
  ├── if no evidence_ids: call retrieval.build_evidence_pack()
  │     └── keyword scoring across all profile entities
  ├── load EvidenceItems from DB
  ├── build context prompt (profile summary + evidence blocks)
  ├── call Claude (RESUME_SYSTEM + RESUME_SCHEMA)
  ├── store GenerationRun (inputs, outputs, intermediate_repr)
  └── return GenerationRunRead
```

## Retrieval Strategy

Current: **keyword + rule-based scoring**
- token overlap between job keywords and entity text/tags
- must-have skill overlap (higher weight)
- role title matching
- domain tag matching

Extension point: `services/semantic_retriever.py` — stubbed interface for pgvector embedding search.

## Validation Strategy

Post-generation LLM validation:
- flatten generated document to plain text claims
- send claims + source evidence to Claude with VALIDATION_SYSTEM prompt
- Claude returns per-claim support status + risk level
- unsupported/high-risk claims are flagged in UI

## Extension Points

| Feature | Where to extend |
|---------|----------------|
| Vector retrieval | `services/semantic_retriever.py` |
| New document types | `services/parsers/` + dispatcher |
| New generation types | `services/generation/` + `routers/generate.py` |
| New export formats | `services/rendering.py` |
| Auth | FastAPI middleware + `dependencies.py` |
| Multi-tenant | Add `user_id` FK to all profile models |
