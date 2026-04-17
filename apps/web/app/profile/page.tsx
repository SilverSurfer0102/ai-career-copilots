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
import { Separator } from "@/components/ui/separator";

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [blocks, setBlocks] = useState<ProfileBlocks | null>(null);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [profileId, setProfileId] = useState("");

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
      toast.success("Profile created!");
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
      toast.success(`Ingested! Extracted: ${JSON.stringify(result.extracted_entities)}`);
      const b = await api.profiles.blocks(profile.id);
      setBlocks(b);
    } catch (err: unknown) {
      toast.error(String(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Profile</h1>

      {!profile && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="grid grid-cols-2 gap-4">
              {[
                { name: "display_name", label: "Full Name", required: true },
                { name: "email", label: "Email" },
                { name: "phone", label: "Phone" },
                { name: "location", label: "Location" },
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
                  {creating ? "Creating…" : "Create Profile"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Load Existing Profile</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder="Profile ID"
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
          />
          <Button variant="outline" onClick={onLoad}>Load</Button>
        </CardContent>
      </Card>

      {profile && (
        <>
          <Card>
            <CardHeader><CardTitle>Upload Document</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              <p className="text-sm text-gray-500">
                Upload a PDF, DOCX, TXT, or MD file. The system will extract and structure your career data.
              </p>
              <Input type="file" accept=".pdf,.docx,.txt,.md" onChange={onUpload} disabled={uploading} />
              {uploading && <p className="text-sm text-indigo-600">Processing document…</p>}
            </CardContent>
          </Card>

          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm">
            <strong>Profile ID:</strong>{" "}
            <code className="font-mono">{profile.id}</code>
            <span className="text-gray-500 ml-2">— save this to use in Workspace</span>
          </div>
        </>
      )}

      {blocks && (
        <div className="grid grid-cols-1 gap-4">
          <BlockSection title="Experiences" count={blocks.experiences.length}>
            {blocks.experiences.map((e) => (
              <div key={e.id} className="text-sm border rounded p-3 bg-white">
                <div className="font-medium">{e.role_title}</div>
                <div className="text-gray-500">{e.employer} · {e.start_date} – {e.end_date || "present"}</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {e.tech_stack.slice(0, 8).map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
                </div>
              </div>
            ))}
          </BlockSection>

          <BlockSection title="Skills" count={blocks.skills.length}>
            <div className="flex flex-wrap gap-2">
              {blocks.skills.map((s) => (
                <Badge key={s.id} variant="outline">{s.name} {s.proficiency ? `(${s.proficiency})` : ""}</Badge>
              ))}
            </div>
          </BlockSection>

          <BlockSection title="Education" count={blocks.educations.length}>
            {blocks.educations.map((e) => (
              <div key={e.id} className="text-sm border rounded p-3 bg-white">
                <div className="font-medium">{e.degree} — {e.institution}</div>
                <div className="text-gray-500">{e.field_of_study} · {e.start_date} – {e.end_date}</div>
              </div>
            ))}
          </BlockSection>

          <BlockSection title="Projects" count={blocks.projects.length}>
            {blocks.projects.map((p) => (
              <div key={p.id} className="text-sm border rounded p-3 bg-white">
                <div className="font-medium">{p.title}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {p.technologies.slice(0, 6).map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
                </div>
              </div>
            ))}
          </BlockSection>

          <BlockSection title="Languages" count={blocks.languages.length}>
            {blocks.languages.map((l) => (
              <Badge key={l.id}>{l.language} — {l.level}</Badge>
            ))}
          </BlockSection>

          <BlockSection title="Certifications" count={blocks.certifications.length}>
            {blocks.certifications.map((c) => (
              <div key={c.id} className="text-sm">{c.name} · {c.issuer}</div>
            ))}
          </BlockSection>

          <BlockSection title="Evidence Items" count={blocks.evidence_items.length}>
            {blocks.evidence_items.map((ev) => (
              <div key={ev.id} className="text-xs border rounded p-2 bg-white font-mono text-gray-500">
                [{ev.source_type}] {ev.source_name} — trust: {ev.trust_level}
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
