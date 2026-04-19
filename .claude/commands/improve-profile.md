---
description: Verbessert die Profil-Eingabe UX im Frontend
allowed-tools: Read, Write
---

Aufgabe: Mache die Profil-Erstellung so nutzerfreundlich wie möglich.

Lies zuerst:
- apps/web/app/profile/page.tsx
- apps/api/routers/profiles.py
- apps/api/schemas/profile.py
- apps/api/models.py

Analysiere: Was kann ein Nutzer aktuell eingeben? Was fehlt noch?

Dann verbessere die Profile-Page:

1. Strukturierte Eingabe-Sektionen:
   - Persönliche Daten (Name, Kontakt, Foto-Upload)
   - Berufserfahrung (Firma, Rolle, Zeitraum, Beschreibung, Erfolge)
   - Ausbildung (Institution, Abschluss, Zeitraum, Note optional)
   - Skills (technisch + soft skills, mit Niveau-Angabe)
   - Projekte (Name, Beschreibung, Technologien, Link)
   - Sprachen (Sprache + Niveau nach CEFR)
   - Zertifikate & Awards

2. UX-Prinzipien:
   - Abschnitte einzeln ein-/ausklappbar
   - Inline-Editing (kein Modal-Chaos)
   - Speichern-Feedback (Toast-Notification)
   - Fortschrittsanzeige wie vollständig das Profil ist

3. Nutze die bestehenden shadcn/ui Komponenten aus apps/web/components/ui/

Zeig mir nach jeder Sektion kurz was du geändert hast.
