"use client";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  api,
  type Profile,
  type ProfileBlocks,
  type BatchImportResult,
  type Experience,
  type Project,
  type Skill,
  type LanguageSkill,
  type Education,
  type Certification,
  type Achievement,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ProfilePicker } from "@/components/profile-picker";

// ── Constants ────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  cv: "CV", academic_paper: "Paper", studienhandbuch: "Studienhandbuch",
  project_report: "Projektbericht", certificate: "Zertifikat", freetext: "Freitext",
};
const DOC_TYPE_COLORS: Record<string, string> = {
  cv: "bg-blue-100 text-blue-800", academic_paper: "bg-purple-100 text-purple-800",
  studienhandbuch: "bg-green-100 text-green-800", project_report: "bg-orange-100 text-orange-800",
  certificate: "bg-yellow-100 text-yellow-800", freetext: "bg-gray-100 text-gray-800",
};
const SKILL_CATEGORY_COLORS: Record<string, string> = {
  technical: "bg-blue-50 border-blue-200 text-blue-800",
  domain: "bg-green-50 border-green-200 text-green-800",
  tool: "bg-orange-50 border-orange-200 text-orange-800",
  framework: "bg-orange-50 border-orange-200 text-orange-800",
  language: "bg-pink-50 border-pink-200 text-pink-800",
  soft: "bg-purple-50 border-purple-200 text-purple-800",
};
const SKILL_CATEGORIES: { value: string; label: string }[] = [
  { value: "technical", label: "Technisch" },
  { value: "tool", label: "Tool" },
  { value: "framework", label: "Framework" },
  { value: "language", label: "Programmiersprache" },
  { value: "domain", label: "Domain" },
  { value: "soft", label: "Soft Skill" },
];
const CEFR_LEVELS = ["Muttersprache", "A1", "A2", "B1", "B2", "C1", "C2"];

// ── Section registry (order + custom titles persisted in profile.preferences) ──

type SectionKey =
  | "experiences" | "projects" | "skills" | "educations"
  | "languages" | "certifications" | "achievements" | "publications";

const SECTION_DEFAULT_TITLES: Record<SectionKey, string> = {
  experiences: "Berufserfahrung",
  projects: "Projekte",
  skills: "Skills",
  educations: "Ausbildung",
  languages: "Sprachen",
  certifications: "Zertifikate",
  achievements: "Achievements",
  publications: "Publikationen",
};
const DEFAULT_SECTION_ORDER: SectionKey[] = [
  "experiences", "projects", "skills", "educations",
  "languages", "certifications", "achievements", "publications",
];

function resolveOrder(profile: Profile): SectionKey[] {
  const saved = (profile.preferences?.section_order as SectionKey[] | undefined) ?? [];
  const valid = saved.filter((k) => DEFAULT_SECTION_ORDER.includes(k));
  const missing = DEFAULT_SECTION_ORDER.filter((k) => !valid.includes(k));
  return [...valid, ...missing];
}
function resolveTitle(profile: Profile, key: SectionKey): string {
  const titles = (profile.preferences?.section_titles as Record<string, string> | undefined) ?? {};
  return titles[key]?.trim() || SECTION_DEFAULT_TITLES[key];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function csvToList(s: string) { return s.split(",").map((x) => x.trim()).filter(Boolean); }
function listToCsv(arr: string[] | undefined) { return (arr ?? []).join(", "); }
function linesToList(s: string) { return s.split("\n").map((x) => x.trim()).filter(Boolean); }
function listToLines(arr: string[] | undefined) { return (arr ?? []).join("\n"); }

function InlineForm({ children, onSave, onCancel, saving, accent = "yellow" }: {
  children: React.ReactNode; onSave: () => void; onCancel: () => void; saving: boolean; accent?: "yellow" | "green";
}) {
  return (
    <div className={`border rounded p-3 flex flex-col gap-2 ${accent === "green" ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"}`}>
      {children}
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={onSave} disabled={saving}>{saving ? "Speichere…" : "Speichern"}</Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Abbrechen</Button>
      </div>
    </div>
  );
}

// ── Personal Info (Profilkopf) ────────────────────────────────────────────────

const PERSONAL_FIELDS: { name: keyof PersonalForm; label: string; required?: boolean }[] = [
  { name: "display_name", label: "Vollständiger Name", required: true },
  { name: "email", label: "E-Mail" },
  { name: "phone", label: "Telefon" },
  { name: "location", label: "Ort" },
  { name: "website", label: "Website" },
  { name: "linkedin_url", label: "LinkedIn URL" },
  { name: "github_url", label: "GitHub URL" },
];
type PersonalForm = {
  display_name: string; email: string; phone: string;
  location: string; website: string; linkedin_url: string; github_url: string;
};

function PersonalInfoSection({ profile, onUpdated }: { profile: Profile; onUpdated: () => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PersonalForm>({
    display_name: profile.display_name, email: profile.email ?? "", phone: profile.phone ?? "",
    location: profile.location ?? "", website: profile.website ?? "",
    linkedin_url: profile.linkedin_url ?? "", github_url: profile.github_url ?? "",
  });

  const startEdit = () => {
    setForm({
      display_name: profile.display_name, email: profile.email ?? "", phone: profile.phone ?? "",
      location: profile.location ?? "", website: profile.website ?? "",
      linkedin_url: profile.linkedin_url ?? "", github_url: profile.github_url ?? "",
    });
    setEditing(true);
  };

  const save = async () => {
    if (!form.display_name.trim()) { toast.error("Name ist erforderlich"); return; }
    setSaving(true);
    try {
      await api.profiles.update(profile.id, form);
      toast.success("Persönliche Daten gespeichert");
      setEditing(false);
      onUpdated();
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Persönliche Daten</CardTitle>
        {!editing && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={startEdit}>Bearbeiten</Button>}
      </CardHeader>
      <CardContent>
        {editing ? (
          <InlineForm onSave={save} onCancel={() => setEditing(false)} saving={saving}>
            <div className="grid grid-cols-2 gap-2">
              {PERSONAL_FIELDS.map(({ name, label, required }) => (
                <div key={name} className="flex flex-col gap-1">
                  <Label htmlFor={`pi-${name}`} className="text-xs">{label}{required && " *"}</Label>
                  <Input id={`pi-${name}`} value={form[name]} onChange={(e) => setForm({ ...form, [name]: e.target.value })} />
                </div>
              ))}
            </div>
          </InlineForm>
        ) : (
          <div className="text-sm">
            <div className="text-lg font-serif font-semibold">{profile.display_name}</div>
            <div className="text-gray-500 mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
              {[profile.email, profile.phone, profile.location].filter(Boolean).map((v, i) => (
                <span key={i}>{i > 0 && <span className="text-gray-300 mr-2">·</span>}{v}</span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {profile.website && <a href={profile.website} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">Website</a>}
              {profile.linkedin_url && <a href={profile.linkedin_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">LinkedIn</a>}
              {profile.github_url && <a href={profile.github_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">GitHub</a>}
            </div>
            {!profile.email && !profile.phone && !profile.location && (
              <div className="text-gray-400 mt-1">Noch keine Kontaktdaten — klicke auf „Bearbeiten".</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Zusammenfassung (summary_variants) ─────────────────────────────────────────

function SummarySection({ profile, onUpdated }: { profile: Profile; onUpdated: () => void }) {
  const [variants, setVariants] = useState<string[]>(profile.summary_variants ?? []);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setVariants(profile.summary_variants ?? []);
    setDirty(false);
  }, [profile.id, profile.summary_variants]);

  const update = (next: string[]) => { setVariants(next); setDirty(true); };
  const setAt = (idx: number, val: string) => update(variants.map((v, i) => (i === idx ? val : v)));
  const removeAt = (idx: number) => update(variants.filter((_, i) => i !== idx));
  const makePrimary = (idx: number) => {
    const next = [...variants];
    const [item] = next.splice(idx, 1);
    next.unshift(item);
    update(next);
  };
  const add = () => update([...variants, ""]);

  const save = async () => {
    setSaving(true);
    try {
      const cleaned = variants.map((v) => v.trim()).filter(Boolean);
      await api.profiles.update(profile.id, { summary_variants: cleaned });
      toast.success("Zusammenfassung gespeichert");
      setDirty(false);
      onUpdated();
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  };

  const hasContent = variants.some((v) => v.trim());

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          Zusammenfassung
          {hasContent && <Badge variant="secondary">{variants.filter((v) => v.trim()).length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {variants.length === 0 && (
          <p className="text-sm text-gray-400">Noch keine Zusammenfassung — schreibe ein kurzes Profil-Statement, das oben im CV erscheint.</p>
        )}
        {variants.map((v, idx) => (
          <div key={idx} className={`flex flex-col gap-1 rounded border p-2 ${idx === 0 ? "border-indigo-200 bg-indigo-50/40" : "border-border"}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">
                {idx === 0 ? "Primär (wird bevorzugt)" : `Variante ${idx + 1}`}
              </span>
              <div className="flex gap-1">
                {idx !== 0 && (
                  <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => makePrimary(idx)}>Als primär</Button>
                )}
                <Button size="sm" variant="ghost" className="h-6 text-xs px-2 text-red-600" onClick={() => removeAt(idx)}>Entfernen</Button>
              </div>
            </div>
            <Textarea value={v} onChange={(e) => setAt(idx, e.target.value)} rows={3}
              placeholder="z.B. Masterstudent KI & Digitale Transformation mit Fokus auf Scalable AI und MLOps…" />
          </div>
        ))}
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={add}>+ Variante hinzufügen</Button>
          <Button size="sm" onClick={save} disabled={saving || !dirty}>{saving ? "Speichere…" : "Speichern"}</Button>
          {dirty && <span className="text-xs text-amber-600">ungespeicherte Änderungen</span>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Experience ────────────────────────────────────────────────────────────────

function ExperienceItem({ item, profileId, onRefresh }: { item: Experience; profileId: string; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(item);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.blocks.updateExperience(profileId, item.id, form);
      toast.success("Erfahrung gespeichert");
      setEditing(false);
      onRefresh();
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  };

  const del = async () => {
    try {
      await api.blocks.deleteExperience(profileId, item.id);
      toast.success("Gelöscht");
      onRefresh();
    } catch (e) { toast.error(String(e)); }
  };

  if (editing) return (
    <InlineForm onSave={save} onCancel={() => setEditing(false)} saving={saving}>
      <div className="grid grid-cols-2 gap-2">
        <Input value={form.role_title ?? ""} onChange={(e) => setForm({ ...form, role_title: e.target.value })} placeholder="Rolle / Berufsbezeichnung" />
        <Input value={form.employer ?? ""} onChange={(e) => setForm({ ...form, employer: e.target.value })} placeholder="Unternehmen" />
        <Input value={form.start_date ?? ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} placeholder="Von (z.B. 2021-03)" />
        <Input value={form.end_date ?? ""} onChange={(e) => setForm({ ...form, end_date: e.target.value })} placeholder="Bis (leer = heute)" />
        <Input value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Ort" />
        <Input value={form.employment_type ?? ""} onChange={(e) => setForm({ ...form, employment_type: e.target.value })} placeholder="Art (Vollzeit, Werkstudent…)" />
      </div>
      <Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Beschreibung der Tätigkeit" rows={2} />
      <Textarea value={listToLines(form.bullets)} onChange={(e) => setForm({ ...form, bullets: linesToList(e.target.value) })} placeholder="Stichpunkte (eine pro Zeile) — z.B. CI/CD-Pipeline aufgebaut…" rows={4} />
      <Input value={listToCsv(form.tech_stack)} onChange={(e) => setForm({ ...form, tech_stack: csvToList(e.target.value) })} placeholder="Technologien (kommagetrennt)" />
    </InlineForm>
  );

  return (
    <div className="text-sm border rounded p-3 bg-white">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium">{item.role_title || <span className="text-gray-400">Keine Rolle</span>}</div>
          <div className="text-gray-500">{item.employer} · {item.start_date} – {item.end_date || "heute"}</div>
          {item.location && <div className="text-gray-400 text-xs">{item.location}</div>}
          {item.description && <div className="text-gray-600 mt-1 text-xs line-clamp-2">{item.description}</div>}
          {(item.bullets?.length ?? 0) > 0 && (
            <ul className="list-disc list-inside text-gray-600 mt-1.5 text-xs space-y-0.5">
              {item.bullets.slice(0, 4).map((b, i) => <li key={i}>{b}</li>)}
              {item.bullets.length > 4 && <li className="list-none text-gray-400">+ {item.bullets.length - 4} weitere</li>}
            </ul>
          )}
          {(item.tech_stack?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {item.tech_stack.slice(0, 8).map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
            </div>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setForm(item); setEditing(true); }}>Bearbeiten</Button>
          <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 hover:bg-red-50" onClick={del}>✕</Button>
        </div>
      </div>
    </div>
  );
}

function AddExperienceForm({ profileId, onRefresh }: { profileId: string; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const empty = { role_title: "", employer: "", start_date: "", end_date: "", location: "", employment_type: "", description: "", bullets: [] as string[], tech_stack: [] as string[] };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.role_title && !form.employer) { toast.error("Bitte mindestens Rolle oder Unternehmen angeben"); return; }
    setSaving(true);
    try {
      await api.blocks.createExperience(profileId, form);
      toast.success("Erfahrung hinzugefügt");
      setOpen(false);
      setForm(empty);
      onRefresh();
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  };

  if (!open) return <Button size="sm" variant="outline" className="w-full" onClick={() => setOpen(true)}>+ Neue Erfahrung</Button>;

  return (
    <InlineForm onSave={save} onCancel={() => { setOpen(false); setForm(empty); }} saving={saving} accent="green">
      <div className="text-xs font-semibold text-green-700 mb-1">Neue Erfahrung</div>
      <div className="grid grid-cols-2 gap-2">
        <Input value={form.role_title} onChange={(e) => setForm({ ...form, role_title: e.target.value })} placeholder="Rolle / Berufsbezeichnung" />
        <Input value={form.employer} onChange={(e) => setForm({ ...form, employer: e.target.value })} placeholder="Unternehmen" />
        <Input value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} placeholder="Von (z.B. 2021-03)" />
        <Input value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} placeholder="Bis (leer = heute)" />
      </div>
      <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Beschreibung" rows={2} />
      <Textarea value={listToLines(form.bullets)} onChange={(e) => setForm({ ...form, bullets: linesToList(e.target.value) })} placeholder="Stichpunkte (eine pro Zeile)" rows={3} />
      <Input value={listToCsv(form.tech_stack)} onChange={(e) => setForm({ ...form, tech_stack: csvToList(e.target.value) })} placeholder="Technologien (kommagetrennt)" />
    </InlineForm>
  );
}

// ── Education ────────────────────────────────────────────────────────────────

function EducationItem({ item, profileId, onRefresh }: { item: Education; profileId: string; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(item);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.blocks.updateEducation(profileId, item.id, form);
      toast.success("Ausbildung gespeichert");
      setEditing(false);
      onRefresh();
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  };

  if (editing) return (
    <InlineForm onSave={save} onCancel={() => setEditing(false)} saving={saving}>
      <div className="grid grid-cols-2 gap-2">
        <Input value={form.institution ?? ""} onChange={(e) => setForm({ ...form, institution: e.target.value })} placeholder="Hochschule / Schule" />
        <Input value={form.degree ?? ""} onChange={(e) => setForm({ ...form, degree: e.target.value })} placeholder="Abschluss (z.B. Bachelor of Science)" />
        <Input value={form.field_of_study ?? ""} onChange={(e) => setForm({ ...form, field_of_study: e.target.value })} placeholder="Studiengang / Fach" />
        <Input value={form.grade ?? ""} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="Note (optional)" />
        <Input value={form.start_date ?? ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} placeholder="Von" />
        <Input value={form.end_date ?? ""} onChange={(e) => setForm({ ...form, end_date: e.target.value })} placeholder="Bis" />
      </div>
    </InlineForm>
  );

  return (
    <div className="text-sm border rounded p-3 bg-white flex items-start justify-between gap-2">
      <div>
        <div className="font-medium">{item.degree} — {item.institution}</div>
        <div className="text-gray-500">{item.field_of_study} · {item.start_date} – {item.end_date}</div>
        {item.grade && <div className="text-gray-400 text-xs">Note: {item.grade}</div>}
      </div>
      <div className="flex gap-1 flex-shrink-0">
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setForm(item); setEditing(true); }}>Bearbeiten</Button>
        <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 hover:bg-red-50" onClick={async () => { try { await api.blocks.deleteEducation(profileId, item.id); onRefresh(); } catch (e) { toast.error(String(e)); } }}>✕</Button>
      </div>
    </div>
  );
}

function AddEducationForm({ profileId, onRefresh }: { profileId: string; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const empty = { institution: "", degree: "", field_of_study: "", start_date: "", end_date: "", grade: "" };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.institution) { toast.error("Bitte Hochschule / Schule angeben"); return; }
    setSaving(true);
    try {
      await api.blocks.createEducation(profileId, form);
      toast.success("Ausbildung hinzugefügt");
      setOpen(false);
      setForm(empty);
      onRefresh();
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  };

  if (!open) return <Button size="sm" variant="outline" className="w-full" onClick={() => setOpen(true)}>+ Neue Ausbildung</Button>;

  return (
    <InlineForm onSave={save} onCancel={() => { setOpen(false); setForm(empty); }} saving={saving} accent="green">
      <div className="text-xs font-semibold text-green-700 mb-1">Neue Ausbildung</div>
      <div className="grid grid-cols-2 gap-2">
        <Input value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} placeholder="Hochschule / Schule" />
        <Input value={form.degree} onChange={(e) => setForm({ ...form, degree: e.target.value })} placeholder="Abschluss" />
        <Input value={form.field_of_study} onChange={(e) => setForm({ ...form, field_of_study: e.target.value })} placeholder="Studiengang / Fach" />
        <Input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="Note (optional)" />
        <Input value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} placeholder="Von" />
        <Input value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} placeholder="Bis" />
      </div>
    </InlineForm>
  );
}

// ── Project ──────────────────────────────────────────────────────────────────

function ProjectItem({ item, profileId, onRefresh }: { item: Project; profileId: string; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(item);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.blocks.updateProject(profileId, item.id, form);
      toast.success("Projekt gespeichert");
      setEditing(false);
      onRefresh();
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  };

  if (editing) return (
    <InlineForm onSave={save} onCancel={() => setEditing(false)} saving={saving}>
      <div className="grid grid-cols-2 gap-2">
        <Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Projektname" />
        <Input value={form.time_period ?? ""} onChange={(e) => setForm({ ...form, time_period: e.target.value })} placeholder="Zeitraum" />
      </div>
      <Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Beschreibung" rows={2} />
      <Textarea value={listToLines(form.bullets)} onChange={(e) => setForm({ ...form, bullets: linesToList(e.target.value) })} placeholder="Stichpunkte (eine pro Zeile)" rows={4} />
      <Input value={listToCsv(form.technologies)} onChange={(e) => setForm({ ...form, technologies: csvToList(e.target.value) })} placeholder="Technologien (kommagetrennt)" />
      <Input value={listToCsv(form.links)} onChange={(e) => setForm({ ...form, links: csvToList(e.target.value) })} placeholder="Links (kommagetrennt)" />
    </InlineForm>
  );

  return (
    <div className="text-sm border rounded p-3 bg-white flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <div className="font-medium">{item.title}</div>
        {item.time_period && <div className="text-gray-400 text-xs">{item.time_period}</div>}
        {item.description && <div className="text-gray-600 mt-1 text-xs line-clamp-2">{item.description}</div>}
        {(item.bullets?.length ?? 0) > 0 && (
          <ul className="list-disc list-inside text-gray-600 mt-1.5 text-xs space-y-0.5">
            {item.bullets.slice(0, 4).map((b, i) => <li key={i}>{b}</li>)}
            {item.bullets.length > 4 && <li className="list-none text-gray-400">+ {item.bullets.length - 4} weitere</li>}
          </ul>
        )}
        {(item.technologies?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {item.technologies.slice(0, 6).map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
          </div>
        )}
      </div>
      <div className="flex gap-1 flex-shrink-0">
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setForm(item); setEditing(true); }}>Bearbeiten</Button>
        <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 hover:bg-red-50" onClick={async () => { try { await api.blocks.deleteProject(profileId, item.id); onRefresh(); } catch (e) { toast.error(String(e)); } }}>✕</Button>
      </div>
    </div>
  );
}

function AddProjectForm({ profileId, onRefresh }: { profileId: string; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const empty = { title: "", time_period: "", description: "", bullets: [] as string[], technologies: [] as string[], links: [] as string[] };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.title) { toast.error("Bitte Projektname angeben"); return; }
    setSaving(true);
    try {
      await api.blocks.createProject(profileId, form);
      toast.success("Projekt hinzugefügt");
      setOpen(false);
      setForm(empty);
      onRefresh();
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  };

  if (!open) return <Button size="sm" variant="outline" className="w-full" onClick={() => setOpen(true)}>+ Neues Projekt</Button>;

  return (
    <InlineForm onSave={save} onCancel={() => { setOpen(false); setForm(empty); }} saving={saving} accent="green">
      <div className="text-xs font-semibold text-green-700 mb-1">Neues Projekt</div>
      <div className="grid grid-cols-2 gap-2">
        <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Projektname" />
        <Input value={form.time_period} onChange={(e) => setForm({ ...form, time_period: e.target.value })} placeholder="Zeitraum" />
      </div>
      <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Beschreibung" rows={2} />
      <Textarea value={listToLines(form.bullets)} onChange={(e) => setForm({ ...form, bullets: linesToList(e.target.value) })} placeholder="Stichpunkte (eine pro Zeile)" rows={3} />
      <Input value={listToCsv(form.technologies)} onChange={(e) => setForm({ ...form, technologies: csvToList(e.target.value) })} placeholder="Technologien (kommagetrennt)" />
    </InlineForm>
  );
}

// ── Certification ─────────────────────────────────────────────────────────────

function CertificationItem({ item, profileId, onRefresh }: { item: Certification; profileId: string; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(item);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.blocks.updateCertification(profileId, item.id, form);
      toast.success("Zertifikat gespeichert");
      setEditing(false);
      onRefresh();
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  };

  if (editing) return (
    <InlineForm onSave={save} onCancel={() => setEditing(false)} saving={saving}>
      <div className="grid grid-cols-2 gap-2">
        <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" />
        <Input value={form.issuer ?? ""} onChange={(e) => setForm({ ...form, issuer: e.target.value })} placeholder="Aussteller" />
        <Input value={form.issued_date ?? ""} onChange={(e) => setForm({ ...form, issued_date: e.target.value })} placeholder="Ausstellungsdatum" />
        <Input value={form.credential_url ?? ""} onChange={(e) => setForm({ ...form, credential_url: e.target.value })} placeholder="URL (optional)" />
      </div>
    </InlineForm>
  );

  return (
    <div className="text-sm border rounded p-2 bg-white flex items-center justify-between gap-2">
      <div><span className="font-medium">{item.name}</span> · <span className="text-gray-500">{item.issuer}</span> {item.issued_date && <span className="text-gray-400 text-xs">({item.issued_date})</span>}</div>
      <div className="flex gap-1">
        <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => { setForm(item); setEditing(true); }}>Bearbeiten</Button>
        <Button size="sm" variant="outline" className="h-6 text-xs text-red-600" onClick={async () => { try { await api.blocks.deleteCertification(profileId, item.id); onRefresh(); } catch (e) { toast.error(String(e)); } }}>✕</Button>
      </div>
    </div>
  );
}

function AddCertificationForm({ profileId, onRefresh }: { profileId: string; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const empty = { name: "", issuer: "", issued_date: "", credential_url: "" };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name) { toast.error("Bitte Name angeben"); return; }
    setSaving(true);
    try {
      await api.blocks.createCertification(profileId, form);
      toast.success("Zertifikat hinzugefügt");
      setOpen(false);
      setForm(empty);
      onRefresh();
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  };

  if (!open) return <Button size="sm" variant="outline" className="w-full" onClick={() => setOpen(true)}>+ Neues Zertifikat</Button>;

  return (
    <InlineForm onSave={save} onCancel={() => { setOpen(false); setForm(empty); }} saving={saving} accent="green">
      <div className="text-xs font-semibold text-green-700 mb-1">Neues Zertifikat</div>
      <div className="grid grid-cols-2 gap-2">
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" />
        <Input value={form.issuer} onChange={(e) => setForm({ ...form, issuer: e.target.value })} placeholder="Aussteller" />
        <Input value={form.issued_date} onChange={(e) => setForm({ ...form, issued_date: e.target.value })} placeholder="Datum (z.B. 2023-06)" />
        <Input value={form.credential_url} onChange={(e) => setForm({ ...form, credential_url: e.target.value })} placeholder="URL" />
      </div>
    </InlineForm>
  );
}

// ── Achievement ───────────────────────────────────────────────────────────────

function AchievementItem({ item, profileId, onRefresh }: { item: Achievement; profileId: string; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(item);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.blocks.updateAchievement(profileId, item.id, form);
      toast.success("Gespeichert");
      setEditing(false);
      onRefresh();
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  };

  if (editing) return (
    <InlineForm onSave={save} onCancel={() => setEditing(false)} saving={saving}>
      <Textarea value={form.statement ?? ""} onChange={(e) => setForm({ ...form, statement: e.target.value })} placeholder="Aussage (z.B. Auszeichnung XY, 1. Platz bei…)" rows={2} />
      <Input value={form.metric_value ?? ""} onChange={(e) => setForm({ ...form, metric_value: e.target.value })} placeholder="Metrik (optional, z.B. +30% Umsatz)" />
    </InlineForm>
  );

  return (
    <div className="text-sm border rounded p-2 bg-white flex items-center justify-between gap-2">
      <div className="flex-1">{item.statement} {item.metric_value && <span className="text-indigo-600 font-medium ml-1">({item.metric_value})</span>}</div>
      <div className="flex gap-1">
        <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => { setForm(item); setEditing(true); }}>Bearbeiten</Button>
        <Button size="sm" variant="outline" className="h-6 text-xs text-red-600" onClick={async () => { try { await api.blocks.deleteAchievement(profileId, item.id); onRefresh(); } catch (e) { toast.error(String(e)); } }}>✕</Button>
      </div>
    </div>
  );
}

function AddAchievementInput({ profileId, onRefresh }: { profileId: string; onRefresh: () => void }) {
  return (
    <div className="flex gap-2">
      <Input id="new-achievement" placeholder="Neue Auszeichnung / Erfolg" className="flex-1"
        onKeyDown={async (e) => {
          if (e.key === "Enter") {
            const val = (e.target as HTMLInputElement).value.trim();
            if (!val) return;
            try { await api.blocks.createAchievement(profileId, { statement: val }); onRefresh(); (e.target as HTMLInputElement).value = ""; toast.success("Hinzugefügt"); }
            catch (err) { toast.error(String(err)); }
          }
        }}
      />
      <span className="text-xs text-gray-400 self-center">Enter</span>
    </div>
  );
}

// ── Skills (body, ohne Card — Card kommt von SectionShell) ──────────────────────

function SkillsBody({ skills, profileId, onRefresh }: { skills: Skill[]; profileId: string; onRefresh: () => void }) {
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("technical");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCat, setEditCat] = useState("technical");

  const add = async () => {
    if (!newName.trim()) return;
    try {
      await api.blocks.createSkill(profileId, { name: newName.trim(), category: newCategory });
      setNewName("");
      toast.success("Skill hinzugefügt");
      onRefresh();
    } catch (e) { toast.error(String(e)); }
  };

  const startEdit = (s: Skill) => { setEditId(s.id); setEditName(s.name); setEditCat(s.category ?? "technical"); };
  const saveEdit = async () => {
    if (!editId || !editName.trim()) return;
    try {
      await api.blocks.updateSkill(profileId, editId, { name: editName.trim(), category: editCat });
      setEditId(null);
      toast.success("Skill gespeichert");
      onRefresh();
    } catch (e) { toast.error(String(e)); }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {skills.map((s) => editId === s.id ? (
          <span key={s.id} className="text-xs px-2 py-1 rounded-full border flex items-center gap-1 bg-yellow-50 border-yellow-200">
            <input value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditId(null); }} autoFocus className="w-28 bg-transparent outline-none" />
            <select value={editCat} onChange={(e) => setEditCat(e.target.value)} className="bg-transparent outline-none">
              {SKILL_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <button onClick={saveEdit} className="text-green-700 font-bold ml-0.5">✓</button>
            <button onClick={() => setEditId(null)} className="text-gray-400 font-bold">✕</button>
          </span>
        ) : (
          <span key={s.id} className={`text-xs px-2 py-1 rounded-full border font-medium flex items-center gap-1 ${SKILL_CATEGORY_COLORS[s.category ?? ""] ?? "bg-gray-50 border-gray-200 text-gray-700"}`}>
            {s.name}
            {s.category && <span className="opacity-50">· {s.category}</span>}
            <button onClick={() => startEdit(s)} className="opacity-40 hover:opacity-100 ml-0.5" title="Bearbeiten">✎</button>
            <button onClick={async () => { try { await api.blocks.deleteSkill(profileId, s.id); onRefresh(); } catch (e) { toast.error(String(e)); } }} className="opacity-40 hover:opacity-100 font-bold" title="Löschen">×</button>
          </span>
        ))}
        {skills.length === 0 && <span className="text-gray-400 text-sm">Noch keine Skills</span>}
      </div>
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Skill hinzufügen (Enter)"
          className="max-w-xs"
        />
        <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="text-sm border rounded px-2 bg-white">
          {SKILL_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <Button size="sm" onClick={add}>+</Button>
      </div>
    </div>
  );
}

// ── Languages (body, ohne Card) ────────────────────────────────────────────────

function LanguagesBody({ languages, profileId, onRefresh }: { languages: LanguageSkill[]; profileId: string; onRefresh: () => void }) {
  const [newLang, setNewLang] = useState("");
  const [newLevel, setNewLevel] = useState("B2");
  const [editId, setEditId] = useState<string | null>(null);
  const [editLang, setEditLang] = useState("");
  const [editLevel, setEditLevel] = useState("B2");

  const add = async () => {
    if (!newLang.trim()) return;
    try {
      await api.blocks.createLanguage(profileId, { language: newLang.trim(), level: newLevel });
      setNewLang("");
      toast.success("Sprache hinzugefügt");
      onRefresh();
    } catch (e) { toast.error(String(e)); }
  };

  const startEdit = (l: LanguageSkill) => { setEditId(l.id); setEditLang(l.language); setEditLevel(l.level ?? "B2"); };
  const saveEdit = async () => {
    if (!editId || !editLang.trim()) return;
    try {
      await api.blocks.updateLanguage(profileId, editId, { language: editLang.trim(), level: editLevel });
      setEditId(null);
      toast.success("Sprache gespeichert");
      onRefresh();
    } catch (e) { toast.error(String(e)); }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {languages.map((l) => editId === l.id ? (
          <span key={l.id} className="text-xs px-2 py-1 rounded-full border flex items-center gap-1 bg-yellow-50 border-yellow-200">
            <input value={editLang} onChange={(e) => setEditLang(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditId(null); }} autoFocus className="w-24 bg-transparent outline-none" />
            <select value={editLevel} onChange={(e) => setEditLevel(e.target.value)} className="bg-transparent outline-none">
              {CEFR_LEVELS.map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}
            </select>
            <button onClick={saveEdit} className="text-green-700 font-bold ml-0.5">✓</button>
            <button onClick={() => setEditId(null)} className="text-gray-400 font-bold">✕</button>
          </span>
        ) : (
          <span key={l.id} className="text-xs px-2 py-1 rounded-full border font-medium bg-pink-50 border-pink-200 text-pink-800 flex items-center gap-1">
            {l.language} — {l.level}
            <button onClick={() => startEdit(l)} className="opacity-40 hover:opacity-100 ml-0.5" title="Bearbeiten">✎</button>
            <button onClick={async () => { try { await api.blocks.deleteLanguage(profileId, l.id); onRefresh(); } catch (e) { toast.error(String(e)); } }} className="opacity-40 hover:opacity-100 font-bold" title="Löschen">×</button>
          </span>
        ))}
        {languages.length === 0 && <span className="text-gray-400 text-sm">Noch keine Sprachen</span>}
      </div>
      <div className="flex gap-2">
        <Input
          value={newLang}
          onChange={(e) => setNewLang(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Sprache (z.B. Deutsch)"
          className="max-w-xs"
        />
        <select value={newLevel} onChange={(e) => setNewLevel(e.target.value)} className="text-sm border rounded px-2 bg-white">
          {CEFR_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <Button size="sm" onClick={add}>+</Button>
      </div>
    </div>
  );
}

// ── Progress Bar ──────────────────────────────────────────────────────────────

function ProfileProgress({ blocks, profile }: { blocks: ProfileBlocks; profile: Profile }) {
  const hasContact = Boolean(profile.email || profile.phone || profile.location);
  const hasSummary = (profile.summary_variants ?? []).some((v) => v.trim());
  const sections = [
    { label: "Pers. Daten", count: hasContact ? 1 : 0 },
    { label: "Zusammenfassung", count: hasSummary ? 1 : 0 },
    { label: "Erfahrungen", count: blocks.experiences.length },
    { label: "Projekte", count: blocks.projects.length },
    { label: "Skills", count: blocks.skills.length },
    { label: "Ausbildung", count: blocks.educations.length },
    { label: "Sprachen", count: blocks.languages.length },
    { label: "Zertifikate", count: blocks.certifications.length },
    { label: "Achievements", count: blocks.achievements.length },
  ];
  const filled = sections.filter((s) => s.count > 0).length;
  const pct = Math.round((filled / sections.length) * 100);

  return (
    <div className="bg-white border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2 text-sm">
        <span className="font-medium">Profil-Vollständigkeit</span>
        <span className="text-gray-500">{filled}/{sections.length} Sektionen · {pct}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
        <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex flex-wrap gap-1">
        {sections.map((s) => (
          <span key={s.label} className={`text-xs px-2 py-0.5 rounded-full ${s.count > 0 ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-400"}`}>
            {s.label} {s.count > 0 ? `(${s.count})` : "–"}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Collapsible Section (Upload / Freetext — ohne Reorder) ──────────────────────

function CollapsibleSection({ title, count, defaultOpen = false, children }: {
  title: string; count: number; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen || count > 0);
  return (
    <Card>
      <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => setOpen((v) => !v)}>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">{title} {count > 0 && <Badge variant="secondary">{count}</Badge>}</span>
          <span className="text-gray-400 text-sm">{open ? "▲" : "▼"}</span>
        </CardTitle>
      </CardHeader>
      {open && <CardContent className="flex flex-col gap-2">{children}</CardContent>}
    </Card>
  );
}

// ── Section Shell (Block-Sektionen mit Rename + Reorder) ────────────────────────

function SectionShell({ title, count, canMoveUp, canMoveDown, onMoveUp, onMoveDown, onRename, children }: {
  title: string; count: number;
  canMoveUp: boolean; canMoveDown: boolean;
  onMoveUp: () => void; onMoveDown: () => void;
  onRename: (newTitle: string) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(count > 0);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(title);

  const commitRename = () => {
    const v = draft.trim();
    if (v && v !== title) onRename(v);
    setRenaming(false);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          {renaming ? (
            <span className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
              <Input value={draft} autoFocus onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") { setDraft(title); setRenaming(false); } }}
                className="h-7 text-sm max-w-[16rem]" />
              <Button size="sm" className="h-7 text-xs" onClick={commitRename}>OK</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setDraft(title); setRenaming(false); }}>Abbrechen</Button>
            </span>
          ) : (
            <span className="flex items-center gap-2 cursor-pointer select-none flex-1" onClick={() => setOpen((v) => !v)}>
              {title} {count > 0 && <Badge variant="secondary">{count}</Badge>}
            </span>
          )}
          {!renaming && (
            <span className="flex items-center gap-0.5 text-gray-400">
              <button onClick={() => { setDraft(title); setRenaming(true); }} title="Umbenennen" className="hover:text-gray-700 px-1">✎</button>
              <button onClick={onMoveUp} disabled={!canMoveUp} title="Nach oben" className="hover:text-gray-700 px-1 disabled:opacity-20">↑</button>
              <button onClick={onMoveDown} disabled={!canMoveDown} title="Nach unten" className="hover:text-gray-700 px-1 disabled:opacity-20">↓</button>
              <button onClick={() => setOpen((v) => !v)} title="Ein-/Ausklappen" className="hover:text-gray-700 px-1 text-sm">{open ? "▲" : "▼"}</button>
            </span>
          )}
        </CardTitle>
      </CardHeader>
      {open && <CardContent className="flex flex-col gap-2">{children}</CardContent>}
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [blocks, setBlocks] = useState<ProfileBlocks | null>(null);
  type FileStatus = { name: string; status: "queued" | "processing" | "done" | "error"; message?: string };
  const [fileQueue, setFileQueue] = useState<FileStatus[]>([]);
  const uploading = fileQueue.some((f) => f.status === "queued" || f.status === "processing");
  const [submittingText, setSubmittingText] = useState(false);
  const [creating, setCreating] = useState(false);
  const [profileId, setProfileId] = useState("");
  const [freetextValue, setFreetextValue] = useState("");
  const [freetextLabel, setFreetextLabel] = useState("Manuelle Eingabe");

  useEffect(() => {
    api.profiles.list().then(async (profiles) => {
      setAllProfiles(profiles);
      if (profiles.length > 0) {
        const first = profiles[0];
        setProfile(first);
        setProfileId(first.id);
        const b = await api.profiles.blocks(first.id);
        setBlocks(b);
      }
    });
  }, []);

  const { register, handleSubmit } = useForm<{
    display_name: string; email: string; phone: string;
    location: string; website: string; linkedin_url: string; github_url: string;
  }>();

  const refreshBlocks = async (pid?: string) => {
    const id = pid ?? profile?.id;
    if (!id) return;
    const b = await api.profiles.blocks(id);
    setBlocks(b);
  };

  const refreshProfile = async () => {
    if (!profile) return;
    const p = await api.profiles.get(profile.id);
    setProfile(p);
    setAllProfiles((prev) => prev.map((x) => (x.id === p.id ? p : x)));
  };

  const updatePreferences = async (patch: Record<string, unknown>) => {
    if (!profile) return;
    const next = { ...(profile.preferences ?? {}), ...patch };
    try {
      const p = await api.profiles.update(profile.id, { preferences: next });
      setProfile(p);
    } catch (e) { toast.error(String(e)); }
  };

  const moveSection = (key: SectionKey, dir: -1 | 1) => {
    if (!profile) return;
    const order = resolveOrder(profile);
    const i = order.indexOf(key);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    updatePreferences({ section_order: next });
  };

  const renameSection = (key: SectionKey, newTitle: string) => {
    if (!profile) return;
    const titles = { ...(profile.preferences?.section_titles as Record<string, string> | undefined ?? {}), [key]: newTitle };
    updatePreferences({ section_titles: titles });
  };

  const onCreate = handleSubmit(async (data) => {
    setCreating(true);
    try {
      const p = await api.profiles.create({ ...data, target_roles: [], summary_variants: [] });
      setProfile(p);
      setProfileId(p.id);
      const b = await api.profiles.blocks(p.id);
      setBlocks(b);
      toast.success("Profil erstellt!");
    } catch (e) { toast.error(String(e)); }
    finally { setCreating(false); }
  });

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!profile || !e.target.files?.length) return;
    const files = Array.from(e.target.files);
    setFileQueue(files.map((f) => ({ name: f.name, status: "queued" })));
    let anyOk = false;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setFileQueue((prev) => prev.map((f, idx) => idx === i ? { ...f, status: "processing" } : f));
      try {
        const result = await api.profiles.importFile(profile.id, file) as BatchImportResult;
        anyOk = anyOk || result.status === "ok";
        setFileQueue((prev) => prev.map((f, idx) => idx !== i ? f : {
          name: file.name,
          status: result.status === "ok" ? "done" : "error",
          message: result.status === "ok"
            ? `${DOC_TYPE_LABELS[result.document_type ?? ""] ?? result.document_type} — ${JSON.stringify(result.extracted_entities)}`
            : result.message,
        }));
      } catch (err) {
        setFileQueue((prev) => prev.map((f, idx) => idx !== i ? f : { name: file.name, status: "error", message: String(err) }));
      }
    }
    if (anyOk) refreshBlocks();
    e.target.value = "";
  };

  const onFreetextSubmit = async () => {
    if (!profile || !freetextValue.trim()) return;
    setSubmittingText(true);
    try {
      const result = await api.profiles.addFreetext(profile.id, freetextValue, freetextLabel);
      const docType = result.document_type ? ` [${DOC_TYPE_LABELS[result.document_type] ?? result.document_type}]` : "";
      toast.success(`Gespeichert!${docType}`);
      setFreetextValue("");
      refreshBlocks();
    } catch (err) { toast.error(String(err)); }
    finally { setSubmittingText(false); }
  };

  const switchProfile = async (id: string) => {
    const p = await api.profiles.get(id);
    const b = await api.profiles.blocks(id);
    setProfile(p);
    setProfileId(id);
    setBlocks(b);
  };

  const deleteProfile = async (id: string) => {
    if (!confirm("Profil wirklich löschen? Alle Daten gehen verloren.")) return;
    await api.profiles.delete(id);
    const updated = allProfiles.filter((p) => p.id !== id);
    setAllProfiles(updated);
    if (profile?.id === id) {
      setProfile(null);
      setBlocks(null);
      setProfileId("");
      if (updated.length > 0) switchProfile(updated[0].id);
    }
    toast.success("Profil gelöscht");
  };

  const [showNewProfile, setShowNewProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [creatingQuick, setCreatingQuick] = useState(false);

  const createQuickProfile = async () => {
    if (!newProfileName.trim()) return;
    setCreatingQuick(true);
    try {
      const p = await api.profiles.create({ display_name: newProfileName.trim(), target_roles: [], summary_variants: [] });
      setAllProfiles((prev) => [...prev, p]);
      setShowNewProfile(false);
      setNewProfileName("");
      switchProfile(p.id);
      toast.success("Profil erstellt");
    } catch (e) { toast.error(String(e)); }
    finally { setCreatingQuick(false); }
  };

  // Render a single block section's inner content by key.
  const renderSectionBody = (key: SectionKey) => {
    if (!blocks || !profile) return null;
    switch (key) {
      case "experiences":
        return (<>
          {blocks.experiences.map((e) => <ExperienceItem key={e.id} item={e} profileId={profile.id} onRefresh={refreshBlocks} />)}
          <AddExperienceForm profileId={profile.id} onRefresh={refreshBlocks} />
        </>);
      case "projects":
        return (<>
          {blocks.projects.map((p) => <ProjectItem key={p.id} item={p} profileId={profile.id} onRefresh={refreshBlocks} />)}
          <AddProjectForm profileId={profile.id} onRefresh={refreshBlocks} />
        </>);
      case "skills":
        return <SkillsBody skills={blocks.skills} profileId={profile.id} onRefresh={refreshBlocks} />;
      case "educations":
        return (<>
          {blocks.educations.map((e) => <EducationItem key={e.id} item={e} profileId={profile.id} onRefresh={refreshBlocks} />)}
          <AddEducationForm profileId={profile.id} onRefresh={refreshBlocks} />
        </>);
      case "languages":
        return <LanguagesBody languages={blocks.languages} profileId={profile.id} onRefresh={refreshBlocks} />;
      case "certifications":
        return (<>
          {blocks.certifications.map((c) => <CertificationItem key={c.id} item={c} profileId={profile.id} onRefresh={refreshBlocks} />)}
          <AddCertificationForm profileId={profile.id} onRefresh={refreshBlocks} />
        </>);
      case "achievements":
        return (<>
          {blocks.achievements.map((a) => <AchievementItem key={a.id} item={a} profileId={profile.id} onRefresh={refreshBlocks} />)}
          <AddAchievementInput profileId={profile.id} onRefresh={refreshBlocks} />
        </>);
      case "publications":
        return blocks.publications.length > 0 ? (<>
          {blocks.publications.map((p) => (
            <div key={p.id} className="text-sm border rounded p-3 bg-white">
              <div className="font-medium">{p.title}</div>
              <div className="flex gap-2 mt-1">
                <Badge variant="outline">{p.pub_type}</Badge>
                {p.venue && <span className="text-gray-500 text-xs">{p.venue}</span>}
                {p.published_date && <span className="text-gray-400 text-xs">{p.published_date}</span>}
              </div>
            </div>
          ))}
        </>) : <span className="text-gray-400 text-sm">Noch keine Publikationen</span>;
    }
  };

  const sectionCount = (key: SectionKey): number => {
    if (!blocks) return 0;
    switch (key) {
      case "experiences": return blocks.experiences.length;
      case "projects": return blocks.projects.length;
      case "skills": return blocks.skills.length;
      case "educations": return blocks.educations.length;
      case "languages": return blocks.languages.length;
      case "certifications": return blocks.certifications.length;
      case "achievements": return blocks.achievements.length;
      case "publications": return blocks.publications.length;
    }
  };

  const order = profile ? resolveOrder(profile) : DEFAULT_SECTION_ORDER;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-serif font-semibold">Profil</h1>

      {/* Visual Profile Picker */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Profil wählen</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {showNewProfile ? (
            <div className="flex gap-2 items-center">
              <input
                autoFocus value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") createQuickProfile(); if (e.key === "Escape") setShowNewProfile(false); }}
                placeholder="Name des neuen Profils…"
                className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button size="sm" onClick={createQuickProfile} disabled={creatingQuick}>{creatingQuick ? "…" : "Erstellen"}</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowNewProfile(false)}>Abbruch</Button>
            </div>
          ) : (
            <ProfilePicker
              profiles={allProfiles}
              selectedId={profile?.id ?? null}
              onSelect={switchProfile}
              onCreateNew={() => setShowNewProfile(true)}
              onPhotoUploaded={() => api.profiles.list().then(setAllProfiles)}
            />
          )}
          {profile && (
            <button
              onClick={() => deleteProfile(profile.id)}
              className="self-start text-xs text-red-400 hover:text-red-600"
            >
              Dieses Profil löschen
            </button>
          )}
        </CardContent>
      </Card>

      {!profile && (
        <Card>
          <CardHeader><CardTitle>Neues Profil erstellen</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="grid grid-cols-2 gap-4">
              {[
                { name: "display_name", label: "Vollständiger Name", required: true },
                { name: "email", label: "E-Mail" },
                { name: "phone", label: "Telefon" },
                { name: "location", label: "Ort" },
                { name: "website", label: "Website" },
                { name: "linkedin_url", label: "LinkedIn URL" },
                { name: "github_url", label: "GitHub URL" },
              ].map(({ name, label, required }) => (
                <div key={name} className="flex flex-col gap-1">
                  <Label htmlFor={name}>{label}{required && " *"}</Label>
                  <Input id={name} {...register(name as "display_name")} />
                </div>
              ))}
              <div className="col-span-2">
                <Button type="submit" disabled={creating}>{creating ? "Erstelle…" : "Profil erstellen"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {profile && (
        <>
          <PersonalInfoSection profile={profile} onUpdated={refreshProfile} />
          <SummarySection profile={profile} onUpdated={refreshProfile} />

          {blocks && <ProfileProgress blocks={blocks} profile={profile} />}

          {/* Upload */}
          <CollapsibleSection title="Dokumente hochladen" count={0} defaultOpen={true}>
            <p className="text-sm text-gray-500">CV, Studienhandbuch, Paper, Projektberichte, Zertifikate — mehrere Dateien auf einmal.</p>
            <div className="flex flex-wrap gap-2 mb-1">
              {Object.entries(DOC_TYPE_LABELS).map(([key, label]) => (
                <span key={key} className={`text-xs px-2 py-0.5 rounded-full font-medium ${DOC_TYPE_COLORS[key]}`}>{label}</span>
              ))}
            </div>
            <Input type="file" accept=".pdf,.docx,.txt,.md" onChange={onUpload} disabled={uploading} multiple />
            {fileQueue.length > 0 && (
              <ul className="text-sm flex flex-col gap-1 mt-1">
                {fileQueue.map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className={f.status === "done" ? "text-green-600" : f.status === "error" ? "text-red-600" : "text-indigo-600 animate-pulse"}>
                      {f.status === "done" ? "✓" : f.status === "error" ? "✗" : "⟳"}
                    </span>
                    <span className="font-mono text-xs truncate max-w-xs">{f.name}</span>
                    {f.message && <span className="text-gray-500 text-xs">{f.message}</span>}
                  </li>
                ))}
              </ul>
            )}
          </CollapsibleSection>

          {/* Freetext */}
          <CollapsibleSection title="Text direkt eingeben" count={0}>
            <p className="text-sm text-gray-500">Projekte, Erfahrungen, Kenntnisse — kein Upload nötig.</p>
            <div className="flex flex-col gap-1">
              <Label htmlFor="freetext-label">Bezeichnung (optional)</Label>
              <Input id="freetext-label" placeholder="z.B. Master-Projekt NLP, Praktikumsbeschreibung…" value={freetextLabel} onChange={(e) => setFreetextLabel(e.target.value)} />
            </div>
            <Textarea id="freetext-input" placeholder="Ich habe in meinem Master-Projekt…" rows={5} value={freetextValue} onChange={(e) => setFreetextValue(e.target.value)} />
            <Button onClick={onFreetextSubmit} disabled={submittingText || !freetextValue.trim()}>
              {submittingText ? "Verarbeite…" : "Text verarbeiten & speichern"}
            </Button>
          </CollapsibleSection>
        </>
      )}

      {/* Block Sections (reorderable + renameable) */}
      {blocks && profile && (
        <div className="flex flex-col gap-3">
          {order.map((key, idx) => (
            <SectionShell
              key={key}
              title={resolveTitle(profile, key)}
              count={sectionCount(key)}
              canMoveUp={idx > 0}
              canMoveDown={idx < order.length - 1}
              onMoveUp={() => moveSection(key, -1)}
              onMoveDown={() => moveSection(key, 1)}
              onRename={(t) => renameSection(key, t)}
            >
              {renderSectionBody(key)}
            </SectionShell>
          ))}

          <CollapsibleSection title="Quellen (Evidence)" count={blocks.evidence_items.length}>
            {blocks.evidence_items.map((ev) => (
              <div key={ev.id} className="text-xs border rounded p-2 bg-white font-mono text-gray-500 flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${DOC_TYPE_COLORS[ev.source_type] ?? "bg-gray-100 text-gray-600"}`}>
                  {DOC_TYPE_LABELS[ev.source_type] ?? ev.source_type}
                </span>
                {ev.source_name}
                <span className="ml-auto text-gray-400">trust: {ev.trust_level}</span>
              </div>
            ))}
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}
