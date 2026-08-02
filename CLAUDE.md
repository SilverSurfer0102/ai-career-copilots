# AI Career Copilots — CLAUDE.md

## Was ist dieses Projekt?
Evidence-grounded Bewerbungsassistent. Nutzer lädt Karrieredokumente hoch (CV, Studienhandbuch, Paper, Zertifikat) oder schreibt Freitext. Claude extrahiert strukturierte Daten (Erfahrungen, Projekte, Skills, Ausbildung, Publikationen, Zertifikate). Der Nutzer formuliert daraus Textbausteine und gibt sie frei. Für eine Job-Description *wählt* Claude nur noch passende Bausteine aus (Selektions-Pipeline) statt Text neu zu generieren — der einzige echte Freitext ist ein kurzer, firmenspezifischer Anschreiben-Hook. Ein deterministischer Pre-Flight-Check läuft vor jedem Export. Export als HTML + PDF (weasyprint), optional `.tex` (manuell kompilierbar).

Details zur Architekturentscheidung: [docs/PLAN-v2-bausteinsystem.md](docs/PLAN-v2-bausteinsystem.md).

## Aktueller Stand (ehrlich)
**Läuft:**
- Backend (FastAPI + SQLModel + SQLite) + Frontend (Next.js + Tailwind + shadcn/ui) lokal startbar
- Bausteinsystem (`ContentBlock`): Bootstrap aus vorhandenen Daten, Freigabe-Workflow, Selektions-Pipeline für Resume + Anschreiben
- Pre-Flight-Check (deterministisch, kein LLM-Call) + Diff-Review gegen den Baustein-Pool
- Stellen-Feed: Bundesagentur-für-Arbeit-API + manuelles Einfügen (Paste), Swipe-UI unter `/swipe`
- Batch-Export als ZIP mit einem Ordner pro Firma
- Strukturierte manuelle Eingabe/Bearbeitung im Profil (Erfahrungen, Skills, Kontaktdaten, Section-Reihenfolge)
- Multi-File-Upload + native Claude Vision für gescannte PDFs

**Lücken:**
- Semantic/Vector-Retrieval ist Stub → nur Keyword-Scoring (bewusst, siehe Plan-Dokument)
- LaTeX-Export liefert nur `.tex`-Quelltext — keine TeX-Distribution installiert, PDF-Pfad läuft über HTML/weasyprint
- DOCX-Export fehlt
- Keine Auth, Single-User only
- Kein automatischer Bewerbungsversand (bewusst — Bewerbungen laufen über Firmenportale)

## Projektstruktur
```
apps/api/                FastAPI Backend
  prompts/               Prompt-Templates (ingestion, selection, job_analysis)
  services/              Business Logic
    generation/          resume.py, cover_letter.py, match_analysis.py (Selektions-Pipeline)
    sources/             bundesagentur.py (Job-Feed)
    parsers/             pdf_parser, docx_parser, text_parser, dispatcher
    ai_client.py         Claude SDK wrapper (structured/free/with_pdf)
    ingestion.py         Doc → structured data pipeline
    retrieval.py         Evidence pack builder (keyword scoring)
    rendering.py         HTML/PDF rendering via weasyprint
    preflight.py         Deterministischer Pre-Export-Check
    diff_review.py        Diff generierter Bullets vs. Baustein-Pool
  routers/               profiles, blocks, jobs, leads, retrieval, generate, validate, preflight, export, applications
  schemas/               Pydantic Schemas
  models.py              SQLModel DB-Models (inkl. ContentBlock, JobLead)
  main.py                API-Einstiegspunkt
  alembic/               DB-Migrationen
apps/web/                Next.js App Router
  app/                   Pages: profile, swipe, jobs, applications, review, pool-cv
  components/ui/         shadcn/ui Components
  lib/api.ts             Typed API client
docs/                    architecture, prompting, security-privacy, PLAN-v2-bausteinsystem
scripts/                 seed_demo_data.py
```

## Start-Befehle

**Wichtig:** Wir nutzen **SQLite, nicht PostgreSQL/Docker**. Die `docker-compose.yml` liegt zwar im Repo, wird aber nicht benötigt.

```bash
# Backend (Terminal 1)
cd apps/api
source .venv/bin/activate
uvicorn main:app --reload
# → http://localhost:8000/health

# Frontend (Terminal 2)
cd apps/web
npm run dev
# → http://localhost:3000
```

.env muss in `apps/api/.env` mit gültigem `ANTHROPIC_API_KEY` liegen.

## Meine Ziele (Priorität)
1. **Bausteinsystem mit echten Daten befüllen** — Bootstrap laufen lassen, Bausteine in eigener Sprache formulieren und freigeben. Größter Hebel für Qualität, einmaliger Aufwand.
2. **Swipe-Feed im Alltag nutzen** — Bundesagentur-Suchprofile einrichten, Paste-Workflow für LinkedIn/Stepstone etablieren.
3. **LaTeX optional vertiefen** — aktuell Zusatzformat (`.tex`, manuell kompilierbar). Nur ausbauen, wenn eine TeX-Distribution lokal installiert wird — Haupt-PDF-Pfad bleibt HTML/weasyprint.

## Kosten-Tracking
Token-Verbrauch transparent halten:
- Nach jeder Session: `/cost` für Einschätzung dieser Session
- Faustregel Modellwahl:
  - Lesen / schnelle Fixes → Sonnet
  - Planen / Architektur → `/opusplan` Command (erinnert an manuelles Opus + Effort High + Thinking an)
  - Implementieren → Sonnet als Standard
- Bei großen Lese-Operationen (ganzes Repo) immer fragen: ist das wirklich nötig?
- `/compact` wenn Session länger als ~30 Nachrichten wird

## Arbeitsregeln für diese Sessions
- Erst Plan Mode, dann Umsetzung — bei jeder Aufgabe die >1 Datei betrifft
- Erkläre kurz WARUM vor dem WIE
- Wenn du eine Lücke oder ein Problem siehst, sag es direkt
- Bei langen Sessions: /compact vorschlagen bevor Qualität leidet
- Sprache: Deutsch im Chat, Englisch im Code
- Generierung darf NIEMALS Fakten erfinden — nur was im Profil steht
- LaTeX-Templates immer auf Deutsch testen (Umlaute, Datum-Format)
