"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { api, type Profile, type ProfileBlocks } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

const DOC_TYPE_LABELS: Record<string, string> = {
  cv: "CV",
  academic_paper: "Paper",
  studienhandbuch: "Studienhandbuch",
  project_report: "Projektbericht",
  certificate: "Zertifikat",
  freetext: "Freitext",
};

const DOC_TYPE_COLORS: Record<string, string> = {
  cv: "bg-blue-100 text-blue-800",
  academic_paper: "bg-purple-100 text-purple-800",
  studienhandbuch: "bg-green-100 text-green-800",
  project_report: "bg-orange-100 text-orange-800",
  certificate: "bg-yellow-100 text-yellow-800",
  freetext: "bg-gray-100 text-gray-800",
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [blocks, setBlocks] = useState<ProfileBlocks | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submittingText, setSubmittingText] = useState(false);
  const [creating, setCreating] = useState(false);
  const [profileId, setProfileId] = useState("");
  const [freetextValue, setFreetextValue] = useState("");
  const [freetextLabel, setFreetextLabel] = useState("Manuelle Eingabe");

  const { register, handleSubmit } = useForm<{
    display_name: string;
    email: string;
    phone: string;
    location: string;
    website: string;
    linkedin_url: string;
    github_url: string;
  }>();

  const onCreate = handleSubmit(async (data) => {
    setCreating(true);
    try {
      const p = await api.profiles.create({ ...data, target_roles: [], summary_variants: [] });
      setProfile(p);
      setProfileId(p.id);
      toast.success("Profil erstellt!");
    } catch (e: unknown) {
      toast.error(String(e));
    } finally {
      setCreating(false);
    }
  });

  const onLoad = async () => {
    if (!profileId) return;
    try {
      const p = await api.profiles.get(profileId);
      const b = await api.profiles.blocks(profileId);
      setProfile(p);
      setBlocks(b);
    } catch (e: unknown) {
      toast.error(String(e));
    }
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!profile || !e.target.files?.[0]) return;
    setUploading(true);
    try {
      const result = await api.profiles.importFile(profile.id, e.target.files[0]);
      const docType = result.document_type ? ` [${DOC_TYPE_LABELS[result.document_type] ?? result.document_type}]` : "";
      toast.success(`Verarbeitet!${docType} Extrahiert: ${JSON.stringify(result.extracted_entities)}`);
      const b = await api.profiles.blocks(profile.id);
      setBlocks(b);
    } catch (err: unknown) {
      toast.error(String(err));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const onFreetextSubmit = async () => {
    if (!profile || !freetextValue.trim()) return;
    setSubmittingText(true);
    try {
      const result = await api.profiles.addFreetext(profile.id, freetextValue, freetextLabel);
      const docType = result.document_type ? ` [${DOC_TYPE_LABELS[result.document_type] ?? result.document_type}]` : "";
      toast.success(`Gespeichert!${docType} Extrahiert: ${JSON.stringify(result.extracted_entities)}`);
      setFreetextValue("");
      const b = await api.profiles.blocks(profile.id);
      setBlocks(b);
    } catch (err: unknown) {
      toast.error(String(err));
    } finally {
      setSubmittingText(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Profil</h1>

      {!profile && (
        <Card>
          <CardHeader>
            <CardTitle>Neues Profil erstellen</CardTitle>
          </CardHeader>
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
                <Button type="submit" disabled={creating}>
                  {creating ? "Erstelle…" : "Profil erstellen"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Bestehendes Profil laden</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder="Profil-ID"
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
          />
          <Button variant="outline" onClick={onLoad}>Laden</Button>
        </CardContent>
      </Card>

      {profile && (
        <>
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm">
            <strong>Profil-ID:</strong>{" "}
            <code className="font-mono">{profile.id}</code>
            <span className="text-gray-500 ml-2">— für den Workspace speichern</span>
          </div>

          {/* Document Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Dokument hochladen</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <p className="text-sm text-gray-500">
                Lade alles hoch: CV, Studienhandbuch (Bachelor/Master), Paper, Projektberichte, Zertifikate.
                Das System erkennt automatisch den Dokumenttyp.
              </p>
              <div className="flex flex-wrap gap-2 mb-2">
                {Object.entries(DOC_TYPE_LABELS).map(([key, label]) => (
                  <span key={key} className={`text-xs px-2 py-0.5 rounded-full font-medium ${DOC_TYPE_COLORS[key]}`}>
                    {label}
                  </span>
                ))}
              </div>
              <Input type="file" accept=".pdf,.docx,.txt,.md" onChange={onUpload} disabled={uploading} />
              {uploading && <p className="text-sm text-indigo-600">Dokument wird verarbeitet…</p>}
            </CardContent>
          </Card>

          {/* Freetext Entry */}
          <Card>
            <CardHeader>
              <CardTitle>Text direkt eingeben</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-gray-500">
                Schreibe direkt was du gemacht hast — Projekte, Erfahrungen, Kenntnisse. Kein Upload nötig.
              </p>
              <div className="flex flex-col gap-1">
                <Label htmlFor="freetext-label">Bezeichnung (optional)</Label>
                <Input
                  id="freetext-label"
                  placeholder="z.B. Master-Projekt NLP, Praktikumsbeschreibung, ..."
                  value={freetextLabel}
                  onChange={(e) => setFreetextLabel(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="freetext-input">Dein Text</Label>
                <Textarea
                  id="freetext-input"
                  placeholder="Ich habe in meinem Master-Projekt ein NLP-System zur automatischen Textzusammenfassung entwickelt. Dabei habe ich PyTorch, Transformers und BERT verwendet..."
                  rows={6}
                  value={freetextValue}
                  onChange={(e) => setFreetextValue(e.target.value)}
                />
              </div>
              <Button
                onClick={onFreetextSubmit}
                disabled={submittingText || !freetextValue.trim()}
              >
                {submittingText ? "Verarbeite…" : "Text verarbeiten & speichern"}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {blocks && (
        <div className="grid grid-cols-1 gap-4">
          <BlockSection title="Erfahrungen" count={blocks.experiences.length}>
            {blocks.experiences.map((e) => (
              <div key={e.id} className="text-sm border rounded p-3 bg-white">
                <div className="font-medium">{e.role_title}</div>
                <div className="text-gray-500">{e.employer} · {e.start_date} – {e.end_date || "heute"}</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {e.tech_stack.slice(0, 8).map((t) => (
                    <Badge key={t} variant="secondary">{t}</Badge>
                  ))}
                  {e.domain_tags.slice(0, 4).map((t) => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </BlockSection>

          <BlockSection title="Projekte" count={blocks.projects.length}>
            {blocks.projects.map((p) => (
              <div key={p.id} className="text-sm border rounded p-3 bg-white">
                <div className="font-medium">{p.title}</div>
                {p.time_period && <div className="text-gray-400 text-xs">{p.time_period}</div>}
                {p.description && <div className="text-gray-600 mt-1 text-xs line-clamp-2">{p.description}</div>}
                <div className="flex flex-wrap gap-1 mt-2">
                  {p.technologies.slice(0, 6).map((t) => (
                    <Badge key={t} variant="secondary">{t}</Badge>
                  ))}
                  {(p.domain_tags || []).slice(0, 4).map((t) => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </BlockSection>

          <BlockSection title="Skills" count={blocks.skills.length}>
            <div className="flex flex-wrap gap-2">
              {blocks.skills.map((s) => (
                <span
                  key={s.id}
                  className={`text-xs px-2 py-1 rounded-full border font-medium ${
                    s.category === "technical" ? "bg-blue-50 border-blue-200 text-blue-800" :
                    s.category === "domain" ? "bg-green-50 border-green-200 text-green-800" :
                    s.category === "tool" || s.category === "framework" ? "bg-orange-50 border-orange-200 text-orange-800" :
                    s.category === "language" ? "bg-pink-50 border-pink-200 text-pink-800" :
                    "bg-gray-50 border-gray-200 text-gray-700"
                  }`}
                >
                  {s.name}
                  {s.category && <span className="opacity-60 ml-1">· {s.category}</span>}
                </span>
              ))}
            </div>
          </BlockSection>

          <BlockSection title="Ausbildung" count={blocks.educations.length}>
            {blocks.educations.map((e) => (
              <div key={e.id} className="text-sm border rounded p-3 bg-white">
                <div className="font-medium">{e.degree} — {e.institution}</div>
                <div className="text-gray-500">{e.field_of_study} · {e.start_date} – {e.end_date}</div>
              </div>
            ))}
          </BlockSection>

          <BlockSection title="Publikationen" count={blocks.publications.length}>
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
          </BlockSection>

          <BlockSection title="Sprachen" count={blocks.languages.length}>
            {blocks.languages.map((l) => (
              <Badge key={l.id}>{l.language} — {l.level}</Badge>
            ))}
          </BlockSection>

          <BlockSection title="Zertifikate" count={blocks.certifications.length}>
            {blocks.certifications.map((c) => (
              <div key={c.id} className="text-sm border rounded p-2 bg-white">{c.name} · {c.issuer}</div>
            ))}
          </BlockSection>

          <BlockSection title="Achievements" count={blocks.achievements.length}>
            {blocks.achievements.map((a) => (
              <div key={a.id} className="text-sm border rounded p-2 bg-white">{a.statement}</div>
            ))}
          </BlockSection>

          <BlockSection title="Quellen (Evidence)" count={blocks.evidence_items.length}>
            {blocks.evidence_items.map((ev) => (
              <div key={ev.id} className="text-xs border rounded p-2 bg-white font-mono text-gray-500 flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${DOC_TYPE_COLORS[ev.source_type] ?? "bg-gray-100 text-gray-600"}`}>
                  {DOC_TYPE_LABELS[ev.source_type] ?? ev.source_type}
                </span>
                {ev.source_name}
                <span className="ml-auto text-gray-400">trust: {ev.trust_level}</span>
              </div>
            ))}
          </BlockSection>
        </div>
      )}
    </div>
  );
}

function BlockSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {title} <Badge variant="secondary">{count}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">{children}</CardContent>
    </Card>
  );
}
