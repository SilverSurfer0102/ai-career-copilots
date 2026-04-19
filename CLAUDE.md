# AI Career Copilots — CLAUDE.md

## Was ist dieses Projekt?
Evidence-grounded Bewerbungsassistent. Nutzer lädt Karrieredokumente hoch (CV, Studienhandbuch, Paper, Zertifikat) oder schreibt Freitext. Claude extrahiert strukturierte Daten (Erfahrungen, Projekte, Skills, Ausbildung, Publikationen, Zertifikate). Für einen Job-Description generiert das System Resume + Anschreiben + Match-Analyse, bei der jede Aussage auf eine Evidence-ID im Profil zurückführbar ist. Anschließend läuft eine Validierungs-Pipeline, die unbelegte Behauptungen flaggt. Export aktuell als HTML + PDF (weasyprint).

## Aktueller Stand (ehrlich)
**Läuft:**
- Backend (FastAPI + SQLModel + SQLite) + Frontend (Next.js 14 + Tailwind + shadcn/ui) lokal startbar
- 12 DB-Modelle, alle Pipelines implementiert, Freitext-Eingabe
- Multi-File-Upload + native Claude Vision für gescannte PDFs (heute hinzugefügt)
- 4 UI-Seiten: profile, jobs, review, workspace

**Lücken:**
- Profile-Seite: **keine strukturierte manuelle Eingabe** für Erfahrungen/Projekte/Skills — nur Upload oder Freitext. Extrahierte Daten können **nicht editiert** werden.
- Workspace: User muss Profile-ID + Job-ID als Copy-Paste eintragen (schlechter UX).
- Semantic/Vector-Retrieval ist Stub → nur Keyword-Scoring.
- **LaTeX-Export fehlt komplett** (ist User-Ziel #2).
- DOCX-Export fehlt.
- Keine Auth, Single-User only.
- Noch nie echt end-to-end mit realen Daten getestet.

## Projektstruktur
```
apps/api/                FastAPI Backend
  prompts/               Prompt-Templates (ingestion, generation, validation)
  services/              Business Logic
    generation/          resume.py, cover_letter.py, match_analysis.py
    parsers/             pdf_parser, docx_parser, text_parser, dispatcher
    ai_client.py         Claude SDK wrapper (structured/free/with_pdf)
    ingestion.py         Doc → structured data pipeline
    retrieval.py         Evidence pack builder (keyword scoring)
    rendering.py         HTML/PDF rendering via weasyprint
  routers/               profiles, jobs, retrieval, generate, validate, export
  schemas/               Pydantic Schemas
  models.py              SQLModel DB-Models
  main.py                API-Einstiegspunkt
  alembic/               DB-Migrationen
apps/web/                Next.js 14 App Router
  app/                   Pages: profile, jobs, review, workspace
  components/ui/         shadcn/ui Components
  lib/api.ts             Typed API client
docs/                    architecture, prompting, security-privacy
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
1. **Nutzerfreundliches Profil-Setup** — strukturierte Eingabe + Editierbarkeit aller Career-Daten (Erfahrungen, Skills, Projekte, Ausbildung). Aktuell größte UX-Lücke.
2. **LaTeX-Ausgabe** — CV + Anschreiben auf Deutsch als LaTeX mit 3 Template-Varianten (modern, klassisch, akademisch). DIN 5008, Umlaute-Support.
3. **Saubere Generierungs-Pipeline** — kein Halluzinieren, nur Fakten aus dem Profil. Die Anti-Halluzinations-Logik existiert, muss aber mit echten Daten verifiziert werden.

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
