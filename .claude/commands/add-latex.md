---
description: Implementiert LaTeX-Rendering für CV und Anschreiben
allowed-tools: Read, Write, Bash(pip install *), Bash(python *)
---

Aufgabe: Ersetze das bestehende HTML/PDF-Rendering durch LaTeX-basierte Ausgabe.

Lies zuerst:
- apps/api/services/rendering.py
- apps/api/templates/
- apps/api/routers/export.py

Dann implementiere:

1. LaTeX Template Engine
   - Erstelle apps/api/templates/latex/ Ordner
   - Implementiere 3 Templates: modern.tex.j2, classic.tex.j2, academic.tex.j2
   - Templates müssen deutsche Umlaute und DIN 5008 unterstützen

2. LaTeX Render Service
   - Erstelle apps/api/services/latex_renderer.py
   - Input: structured CV data + template name
   - Output: .tex Datei + kompiliertes PDF (via pdflatex oder latexmk)
   - Fehlerbehandlung wenn LaTeX nicht installiert

3. Export Endpoint erweitern
   - apps/api/routers/export.py: neuen Parameter format=latex|pdf|html
   - Rückgabe: .tex oder .pdf je nach Format

4. Frontend Export-Button
   - apps/web/app/workspace/page.tsx: Template-Auswahl + Format-Auswahl

Gehe Schritt für Schritt vor. Zeig mir nach jedem Schritt kurz was du gemacht hast.
