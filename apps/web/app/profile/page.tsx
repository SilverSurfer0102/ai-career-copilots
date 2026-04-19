"use client";
import { useState } from "react";
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function csvToList(s: string) { return s.split(",").map((x) => x.trim()).filter(Boolean); }
function listToCsv(arr: string[] | undefined) { return (arr ?? []).join(", "); }

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
      <Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Beschreibung der Tätigkeit" rows={3} />
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
  const empty = { role_title: "", employer: "", start_date: "", end_date: "", location: "", employment_type: "", description: "", tech_stack: [] as string[] };
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
      <Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Beschreibung" rows={3} />
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
  const empty = { title: "", time_period: "", description: "", technologies: [] as string[], links: [] as string[] };
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

// ── Skills Section ────────────────────────────────────────────────────────────

function SkillsSection({ skills, profileId, onRefresh }: { skills: Skill[]; profileId: string; onRefresh: () => void }) {
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("technical");

  const add = async () => {
    if (!newName.trim()) return;
    try {
      await api.blocks.createSkill(profileId, { name: newName.trim(), category: newCategory });
      setNewName("");
      toast.success("Skill hinzugefügt");
      onRefresh();
    } catch (e) { toast.error(String(e)); }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">Skills <Badge variant="secondary">{skills.length}</Badge></CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {skills.map((s) => (
            <span key={s.id} className={`text-xs px-2 py-1 rounded-full border font-medium flex items-center gap-1 ${SKILL_CATEGORY_COLORS[s.category ?? ""] ?? "bg-gray-50 border-gray-200 text-gray-700"}`}>
              {s.name}
              {s.category && <span className="opacity-50">· {s.category}</span>}
              <button onClick={async () => { try { await api.blocks.deleteSkill(profileId, s.id); onRefresh(); } catch (e) { toast.error(String(e)); } }} className="opacity-40 hover:opacity-100 ml-0.5 font-bold">×</button>
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
            <option value="technical">Technisch</option>
            <option value="tool">Tool</option>
            <option value="framework">Framework</option>
            <option value="language">Programmiersprache</option>
            <option value="domain">Domain</option>
            <option value="soft">Soft Skill</option>
          </select>
          <Button size="sm" onClick={add}>+</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Languages Section ─────────────────────────────────────────────────────────

const CEFR_LEVELS = ["Muttersprache", "A1", "A2", "B1", "B2", "C1", "C2"];

function LanguagesSection({ languages, profileId, onRefresh }: { languages: LanguageSkill[]; profileId: string; onRefresh: () => void }) {
  const [newLang, setNewLang] = useState("");
  const [newLevel, setNewLevel] = useState("B2");

  const add = async () => {
    if (!newLang.trim()) return;
    try {
      await api.blocks.createLanguage(profileId, { language: newLang.trim(), level: newLevel });
      setNewLang("");
      toast.success("Sprache hinzugefügt");
      onRefresh();
    } catch (e) { toast.error(String(e)); }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">Sprachen <Badge variant="secondary">{languages.length}</Badge></CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {languages.map((l) => (
            <span key={l.id} className="text-xs px-2 py-1 rounded-full border font-medium bg-pink-50 border-pink-200 text-pink-800 flex items-center gap-1">
              {l.language} — {l.level}
              <button onClick={async () => { try { await api.blocks.deleteLanguage(profileId, l.id); onRefresh(); } catch (e) { toast.error(String(e)); } }} className="opacity-40 hover:opacity-100 ml-0.5 font-bold">×</button>
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
      </CardContent>
    </Card>
  );
}

// ── Progress Bar ──────────────────────────────────────────────────────────────

function ProfileProgress({ blocks }: { blocks: ProfileBlocks }) {
  const sections = [
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

// ── Collapsible Section ───────────────────────────────────────────────────────

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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProfilePage() {
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

  const onLoad = async () => {
    if (!profileId) return;
    try {
      const p = await api.profiles.get(profileId);
      const b = await api.profiles.blocks(profileId);
      setProfile(p);
      setBlocks(b);
    } catch (e) { toast.error(String(e)); }
  };

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

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Profil</h1>

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

      <Card>
        <CardHeader><CardTitle>Bestehendes Profil laden</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input placeholder="Profil-ID" value={profileId} onChange={(e) => setProfileId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onLoad()} />
          <Button variant="outline" onClick={onLoad}>Laden</Button>
        </CardContent>
      </Card>

      {profile && (
        <>
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm flex items-center justify-between">
            <span><strong>Profil-ID:</strong> <code className="font-mono">{profile.id}</code></span>
            <span className="text-gray-500 text-xs">für den Workspace speichern</span>
          </div>

          {blocks && <ProfileProgress blocks={blocks} />}

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

      {/* Block Sections */}
      {blocks && profile && (
        <div className="flex flex-col gap-3">
          <CollapsibleSection title="Berufserfahrung" count={blocks.experiences.length}>
            {blocks.experiences.map((e) => (
              <ExperienceItem key={e.id} item={e} profileId={profile.id} onRefresh={refreshBlocks} />
            ))}
            <AddExperienceForm profileId={profile.id} onRefresh={refreshBlocks} />
          </CollapsibleSection>

          <CollapsibleSection title="Projekte" count={blocks.projects.length}>
            {blocks.projects.map((p) => (
              <ProjectItem key={p.id} item={p} profileId={profile.id} onRefresh={refreshBlocks} />
            ))}
            <AddProjectForm profileId={profile.id} onRefresh={refreshBlocks} />
          </CollapsibleSection>

          <SkillsSection skills={blocks.skills} profileId={profile.id} onRefresh={refreshBlocks} />

          <CollapsibleSection title="Ausbildung" count={blocks.educations.length}>
            {blocks.educations.map((e) => (
              <EducationItem key={e.id} item={e} profileId={profile.id} onRefresh={refreshBlocks} />
            ))}
            <AddEducationForm profileId={profile.id} onRefresh={refreshBlocks} />
          </CollapsibleSection>

          <LanguagesSection languages={blocks.languages} profileId={profile.id} onRefresh={refreshBlocks} />

          <CollapsibleSection title="Zertifikate" count={blocks.certifications.length}>
            {blocks.certifications.map((c) => (
              <CertificationItem key={c.id} item={c} profileId={profile.id} onRefresh={refreshBlocks} />
            ))}
            <AddCertificationForm profileId={profile.id} onRefresh={refreshBlocks} />
          </CollapsibleSection>

          <CollapsibleSection title="Achievements" count={blocks.achievements.length}>
            {blocks.achievements.map((a) => (
              <AchievementItem key={a.id} item={a} profileId={profile.id} onRefresh={refreshBlocks} />
            ))}
            <div className="flex gap-2">
              <Input id="new-achievement" placeholder="Neue Auszeichnung / Erfolg" className="flex-1"
                onKeyDown={async (e) => {
                  if (e.key === "Enter") {
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (!val) return;
                    try { await api.blocks.createAchievement(profile.id, { statement: val }); refreshBlocks(); (e.target as HTMLInputElement).value = ""; toast.success("Hinzugefügt"); }
                    catch (err) { toast.error(String(err)); }
                  }
                }}
              />
              <span className="text-xs text-gray-400 self-center">Enter</span>
            </div>
          </CollapsibleSection>

          {blocks.publications.length > 0 && (
            <CollapsibleSection title="Publikationen" count={blocks.publications.length}>
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
            </CollapsibleSection>
          )}

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
