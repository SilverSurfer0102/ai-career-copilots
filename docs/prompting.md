# Prompting Design

## Prompt Location

All prompts live in `apps/api/prompts/`. They are Python modules exporting string constants. This keeps them versioned in git, testable in isolation, and clearly separated from service logic.

```
prompts/
  ingestion.py     — INGESTION_SYSTEM, INGESTION_SCHEMA
  job_analysis.py  — JOB_ANALYSIS_SYSTEM, JOB_ANALYSIS_SCHEMA
  generation.py    — RESUME_SYSTEM/SCHEMA, COVER_LETTER_SYSTEM/SCHEMA,
                     MATCH_ANALYSIS_SYSTEM/SCHEMA, VALIDATION_SYSTEM/SCHEMA
```

## Anti-Hallucination Policy (Mandatory)

Every system prompt for generation includes these rules:
1. Use ONLY the evidence provided in the context.
2. Every claim must reference a source `evidence_id`.
3. Never invent facts, dates, metrics, or skills.
4. Prefer omission over fabrication.

The schema enforces this structurally — every bullet in the resume output includes an `evidence_ids: []` field that must be populated.

## Structured Output Pattern

All LLM calls use `structured_generation()` in `services/ai_client.py`:
- System prompt sets context and rules
- User prompt appends the data + schema description
- Model is instructed to return ONLY valid JSON
- Response is stripped of markdown fences and parsed
- On JSON parse failure, a `ValueError` is raised (fail loudly)

## Prompt Versions

The `prompt_version` field in `GenerationRun` records which version of the prompts produced each output. Currently at `"1.0"`. When prompts change significantly, increment this version.

## Adding a New Document Type

1. Add a new constant to `prompts/generation.py` with `_SYSTEM` + `_SCHEMA`
2. Add a service in `services/generation/`
3. Add a router endpoint in `routers/generate.py`
4. Add the `run_type` to frontend workspace tabs

## Safety Rules Summary

| Allowed | Forbidden |
|---------|-----------|
| Reorder sections | Invent job titles |
| Paraphrase bullets | Add unverified metrics |
| Emphasize relevant facts | Fabricate certifications |
| Improve grammar | Add employers not in evidence |
| Combine supported facts | Add skills not in profile |
| Omit irrelevant sections | Suggest fabricating credentials |
