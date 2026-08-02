# Plan v2 — Bausteinsystem statt Generierung

> Geplant mit Opus (02.08.2026), Umsetzung mit Sonnet.
> Ziel: 20–40 Bewerbungen/Monat ohne manuelles Nachbauen in Overleaf, ohne Halluzinationen,
> ohne dass die Dokumente nach ChatGPT klingen.

## Warum dieser Umbau (Kurzfassung der Recherche)

- Recruiter screenen in **7,4 s**; von 250 Bewerbungen kommen ~5 ins Interview.
- 67 % der Hiring Manager sagen, sie erkennen KI-Texte — im Blindtest schafften es aber 82 % **nicht**.
  Erkannt wird nicht „KI", sondern **fehlende Spezifität**.
- Job-spezifisch angepasst: 16,4 % Callback vs. 10,7 % generisch.
- DE: nur ~45 % der Unternehmen verlangen noch ein Anschreiben. Kurz und spezifisch schlägt DIN-5008-Seite.
- LinkedIn UA §8.2 verbietet Automatisierung; 2026 verschärfte Durchsetzung (~40 % Restriktionen bei
  geflaggten Tools). → **Kein Scraping, kein Auto-Apply.**

**Konsequenz:** Nicht mehr Bewerbungen automatisieren, sondern den Aufwand pro *guter* Bewerbung
von ~30 min auf ~3 min drücken.

## Kernidee: 4 Schichten, nur eine davon generativ

| Schicht | Wer | Halluzinationsrisiko |
|---|---|---|
| 1. **Bausteine** — von dir formulierte, freigegebene Textblöcke | Mensch, einmalig | 0 |
| 2. **Selektion** — LLM wählt Baustein-IDs aus und ordnet sie | LLM, gibt **nur IDs** zurück | 0 |
| 3. **Rendering** — HTML/CSS → PDF (weasyprint) | deterministisch | 0 |
| 4. **Der eine Absatz** — „warum genau ihr" im Anschreiben | LLM, Freitext | hier, und nur hier |

Heute: 100 % generiert, 0 % vorab geprüft → deshalb braucht es Anti-Halluzinations-Regeln,
eine Validierungs-Pipeline und klingt trotzdem nach Ratgeber.
Danach: ~90 % deterministisch. Die Validierungs-Pipeline wird größtenteils **überflüssig**.

## Wichtige Vorbefunde aus dem Code-Check

- **LaTeX-Export erzeugt nur `.tex`, kein PDF.** Es ist keine TeX-Distribution installiert
  (`pdflatex`/`tectonic`/`typst` alle nicht vorhanden). Einziger echter PDF-Pfad ist
  `weasyprint` über `templates/resume.html.j2`.
  → **Design-Arbeit passiert in HTML/CSS.** LaTeX bleibt als optionaler Overleaf-Export bestehen,
  wird aber nicht weiterentwickelt.
- CRUD für Erfahrungen/Projekte/Skills existiert bereits vollständig in `routers/blocks.py` —
  das Bausteinsystem hängt sich daran an, kein Neuaufbau nötig.
- `Experience.bullets` ist heute eine flache `list[str]` → wird durch die neue `ContentBlock`-Tabelle
  ersetzt (bestehendes Feld bleibt vorerst als Legacy stehen).

---

## Phase 0 — Design-Fix (klein, sofort sichtbar)

**Datei:** `apps/api/templates/resume.html.j2`, neu `cover_letter.html.j2`

Probleme heute: Google-Fonts über Netz (in weasyprint langsam/fragil), zentrierter Header,
generisches Business-Layout.

- Google-Fonts-Link entfernen. Schrift lokal einbetten (`Inter` oder `Source Sans 3` als
  `.woff2` unter `apps/api/static/fonts/`, per `@font-face` mit `file://`-Pfad).
- Header linksbündig, Name groß, darunter eine Kontaktzeile. Foto optional rechts (DE-üblich),
  per Profil-Flag abschaltbar.
- **Einspaltig bleiben** — ATS liest keine Spalten, Textboxen oder Grafiken. Die Optik kommt
  aus Typografie (Type-Scale, Weights, Zeilenabstand, eine Akzentfarbe), nicht aus Layout-Tricks.
- Datumsformat `01/2025 – 02/2026` (ATS-freundlich).
- `page-break-inside: avoid` auf Item-Ebene, damit Einträge nicht über Seiten reißen.
- Zweites Stylesheet-Preset `classic` (schwarz/weiß, konservativ) als CSS-Variante desselben
  Templates — nicht als zweites Template.

**Akzeptanz:** PDF ohne Netzwerkzugriff renderbar, Umlaute korrekt, keine zerrissenen Einträge.

---

## Phase 1 — Bausteine im Datenmodell

**Neue Tabelle** in `apps/api/models.py`:

```python
class ContentBlock(SQLModel, table=True):
    __tablename__ = "content_block"
    id: str
    profile_id: str            # FK candidate_profile
    parent_type: str           # "experience" | "project" | "education" | "standalone"
    parent_id: Optional[str]
    kind: str                  # "bullet" | "summary" | "letter_intro" | "letter_close"
    text: str                  # DEINE finale Formulierung — wird nie vom LLM verändert
    variant_label: Optional[str]   # "kurz" | "lang" | "technisch" | "business"
    role_tags: list            # ["data-engineering", "ml", "consulting"]
    keywords: list             # für Keyword-Matching gegen die JD
    language: str = "de"
    priority: int = 0
    approved: bool = False     # nur approved=True darf ins Dokument
```

- Alembic-Migration.
- CRUD in `routers/blocks.py` ergänzen (`/{profile_id}/content-blocks`).
- **Bootstrap-Helfer:** Endpoint, der aus vorhandenen `Experience.bullets` je einen
  `ContentBlock` mit `approved=False` anlegt — du gehst einmal durch und schreibst sie
  in deiner Sprache um. Das ist der einmalige Aufwand, der den ganzen Rest trägt.
- Frontend: in `app/profile/page.tsx` pro Erfahrung eine Baustein-Liste
  (Text, Varianten-Label, Tags, Approve-Toggle). Inline-Edit, kein Modal.

**Akzeptanz:** Für eine echte Erfahrung existieren 2–3 freigegebene Varianten mit Tags.

---

## Phase 2 — Selektion statt Generierung

**Dateien:** `apps/api/prompts/generation.py`, `services/generation/resume.py`,
`services/generation/cover_letter.py`

- Neuer Prompt `SELECTION_SYSTEM`. Input: kompakte Liste aller approved Bausteine
  (`id | kind | tags | keywords | erste 80 Zeichen`) + analysierte JD.
  Output-Schema **ausschließlich**:
  ```json
  {
    "headline": "string (Zielrollen-Bezeichnung, aus der JD)",
    "sections": [{"section_type": "...", "block_ids": ["..."]}],
    "dropped_reason": "string",
    "letter_hook": "string (2–3 Sätze: warum genau diese Firma)"
  }
  ```
- **Server-seitige Härtung:** jede zurückgegebene ID gegen die DB prüfen
  (existiert, gehört zum Profil, `approved == True`). Unbekannte IDs → verwerfen, nicht raten.
  Der Dokumenttext wird aus der DB gelesen, **nie** aus dem LLM-Output.
- `letter_hook` ist der einzige generierte Freitext und wird im Review farblich markiert.
- **Ersatzlos streichen:** `RESUME_SYSTEM` (der 3-Satz-Summary-Zwang mit
  „Sucht eine [Rolle], um [Wert] einzubringen" und die Verb-Liste „Entwickelte, Optimierte, Leitete"
  ist genau der Duktus, der 2026 als KI gelesen wird), `POOL_RESUME_SYSTEM`, `COMPACT_SYSTEM`
  (Längenbegrenzung passiert jetzt in der Selektion).
- Anschreiben neu: **max. 3 Absätze / ~150 Wörter**. Aufbau: Baustein-Intro +
  `letter_hook` + 1–2 Belegbausteine + Baustein-Schluss. Kein 5-`paragraph_type`-Schema mehr.
- Modellwahl: Selektion ist ein kleiner Prompt → Sonnet reicht, ggf. Haiku testen.

**Akzeptanz:** Zwei Läufe mit derselben JD liefern denselben Dokumenttext (nur `letter_hook` variiert).

---

## Phase 3 — Pre-Flight-Check + Diff-Review

**Neu:** `apps/api/services/preflight.py`. Ersetzt den Großteil von `services/validation.py`.

Deterministische Checks vor jedem Export, Ergebnis `pass | warn | block`:

1. Firmenname aus dem Job-Record ist gesetzt und kommt im Anschreiben vor.
2. **Kein Firmenname einer anderen Bewerbung** im Text (Regex gegen alle bisherigen
   `JobDescription.company`) — das ist der Fehler, der real passiert.
3. Datum == heute.
4. Keine Platzhalter (`[`, `]`, `TODO`, `XXX`, `Muster`).
5. Alle verwendeten Bausteine `approved == True`.
6. Sprache konsistent (kein englischer Baustein im deutschen Dokument).
7. Seitenzahl des gerenderten PDFs ≤ Limit (2 für CV, 1 für Anschreiben).
8. Anrede vorhanden; falls kein Ansprechpartner bekannt → „Sehr geehrte Damen und Herren".

**Frontend `app/review/page.tsx`:** statt Volltext-Review eine **Diff-Ansicht** gegen den
Pool-CV — nur was sich geändert hat (weggelassene Bausteine, andere Varianten, neue Reihenfolge)
plus der markierte `letter_hook`. Ziel: 15 s statt 3 min pro Bewerbung.

**Akzeptanz:** Ein absichtlich mit falschem Firmennamen gebauter Lauf wird geblockt.

---

## Phase 4 — Swipe-Feed

**Neues Model `JobLead`:** `source`, `external_id`, `title`, `company`, `location`, `url`,
`raw_text`, `posted_at`, `status` (`new|liked|passed|applied`), `score`, `dedupe_hash`.

Quellen (per Entscheidung: nur diese zwei in v1):

1. **Bundesagentur für Arbeit Jobsuche-API** — `services/sources/bundesagentur.py`.
   Kostenlos, legal, größte DE-Datenbank. Auth via `X-API-Key`-Header,
   Suche `/pc/v4/jobs`, Details `/pc/v4/jobdetails`. Siehe github.com/bundesAPI/jobsuche-api.
   Suchprofile (Keywords, Region, Umkreis) in `CandidateProfile.preferences`.
2. **Paste / Bookmarklet** — `POST /leads/paste {url?, raw_text}` für LinkedIn-/Stepstone-Funde.
   Dazu ein kleines Bookmarklet-JS, das Titel + markierten Text an `localhost:8000` schickt.
   **Kein Scraping, kein Login-Automatismus** — das ist der ToS-konforme Korridor.

Dedupe über `hash(company + title + normalisierter Ort)`, damit dieselbe Stelle aus beiden
Quellen nur einmal im Stack liegt.

**Frontend `app/swipe/page.tsx`:** Kartenstapel, Tastatur `←` = pass, `→` = like,
`↑` = später. Auf der Karte: Titel, Firma, Ort, Top-5-Keywords, grober Match-Score aus dem
bestehenden Keyword-Scoring in `services/retrieval.py`. „Like" legt eine `Application`
im Status `draft` an und triggert die Selektion.

**Bewusst weggelassen:** Semantic/Vector-Retrieval. Keyword-Scoring reicht als Vorsortierung
für einen Swipe-Stack; der Aufwand lohnt hier nicht.

---

## Phase 5 — Batch-Export

- `GET /applications/batch/export?ids=...` → ZIP mit einem Ordner pro Firma:
  `Lebenslauf_<Nachname>.pdf`, `Anschreiben_<Nachname>.pdf`.
- Dateinamen nach dem Muster, das Portale erwarten (keine UUIDs, keine Umlaute im Dateinamen).
- Läufe mit Pre-Flight-Status `block` werden nicht mit exportiert und im Ergebnis benannt.
- **Kein automatischer Versand.** Bewerbungen laufen über Firmenportale; das System liefert
  das fertige Paket zum Hochladen.

---

## Reihenfolge & Aufwand

| Phase | Aufwand | Nutzen |
|---|---|---|
| 0 Design | klein | sofort sichtbar, Vertrauen in den Output |
| 1 Bausteine | mittel | Grundlage für alles Weitere |
| 2 Selektion | mittel | löst Halluzination + „spießiger" Ton |
| 3 Pre-Flight + Diff | klein | löst Fehleranfälligkeit, macht Tempo |
| 4 Swipe-Feed | mittel | löst Volumen |
| 5 Batch-Export | klein | letzte Meile |

Phasen 0–3 sind der eigentliche Wert. 4–5 sind Komfort und können warten.

## Was tatsächlich gelöscht wurde (Stand nach Umsetzung)

- `RESUME_SYSTEM`, `COVER_LETTER_SYSTEM`/`COVER_LETTER_SCHEMA` in `prompts/generation.py`
  — ersetzt durch `SELECTION_SYSTEM`/`SELECTION_SCHEMA` und `LETTER_SELECTION_SYSTEM`/`SCHEMA`
- `services/semantic_retriever.py` (Stub, keine einzige Referenz im Code)

**Bewusst behalten, entgegen der ursprünglichen Planung:**
- `services/generation/pool_resume.py`, `services/generation/compact.py`,
  `POOL_RESUME_SYSTEM`/`COMPACT_SYSTEM` — die Pool-CV-Seite (`/pool-cv`) ist ein
  eigenständiges, funktionierendes Feature (vollständiges Master-CV, bewusst nicht
  tailored) und hätte beim Löschen eine ganze Frontend-Seite mitgerissen. `pool_resume.py`
  nutzt außerdem `RESUME_SCHEMA` als Output-Struktur weiter — die musste ohnehin bleiben.
- `services/validation.py` / `routers/validate.py` — wird aktiv von der
  Bewerbungs-Detailseite genutzt (Validate-Button). `preflight.py` ist eine
  zusätzliche, deterministische Schicht *vor* dem Export, keine Ablösung des
  bestehenden LLM-Faktenchecks.

## Token-Hinweise für die Umsetzung

- Pro Phase eine eigene Sonnet-Session, `/compact` dazwischen.
- Nicht das ganze Repo lesen lassen — pro Phase sind die betroffenen Dateien oben genannt.
- `apps/web/app/profile/page.tsx` hat 1305 Zeilen. Beim Frontend-Teil von Phase 1 gezielt
  den Erfahrungs-Abschnitt bearbeiten, nicht die Datei komplett einlesen.

## Quellen

- [Auto-Apply-Tools 2026 im Vergleich](https://www.jobscan.co/blog/auto-apply-job-tools/)
- [LinkedIn Automation 2026: Limits & Risiken](https://www.zeliq.com/blog/linkedin-automation-2026)
- [Erkennen Recruiter KI-Anschreiben?](https://coverlettercopilot.ai/blog/are-ai-cover-letters-detectable-by-recruiters)
- [Braucht man 2026 noch ein Anschreiben? (DE)](https://cvscore.net/de/blog/braucht-man-2026-noch-ein-anschreiben/)
- [Lebenslauf 2026: ATS-optimiert](https://www.bpw-akademie.de/blog/lebenslauf-2026-was-gehoert-hinein)
- [bundesAPI/jobsuche-api](https://github.com/bundesAPI/jobsuche-api)
- [Resume as Code (RenderCV)](https://rendercv.com/blog/resume-as-code)
