"use client";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { api, type Profile, type GenerationRun } from "@/lib/api";
import { ProfilePicker } from "@/components/profile-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function PoolCVPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [poolRun, setPoolRun] = useState<GenerationRun | null>(null);
  const [compactRun, setCompactRun] = useState<GenerationRun | null>(null);
  const [generating, setGenerating] = useState(false);
  const [compacting, setCompacting] = useState(false);
  const [language, setLanguage] = useState("de");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.profiles.list()
      .then((ps) => {
        setProfiles(ps);
        if (ps.length > 0) setSelectedProfileId(ps[0].id);
      })
      .catch(() => toast.error("Profile konnten nicht geladen werden — läuft das Backend?"));
  }, []);

  const loadPoolRun = useCallback(async (profileId: string) => {
    const runs = await api.runs.list({ profile_id: profileId, run_type: "resume_pool" });
    const latest = runs[0] ?? null;
    setPoolRun(latest);

    if (latest) {
      const compacts = await api.runs.list({ profile_id: profileId, run_type: "resume_compact" });
      const linkedCompact = compacts.find((r) => {
        const inp = r.generation_inputs as Record<string, unknown>;
        return inp?.source_run_id === latest.id;
      }) ?? null;
      setCompactRun(linkedCompact);
    } else {
      setCompactRun(null);
    }
  }, []);

  useEffect(() => {
    if (selectedProfileId) loadPoolRun(selectedProfileId);
  }, [selectedProfileId, loadPoolRun]);

  const handleSelectProfile = (id: string) => {
    setSelectedProfileId(id);
    setPoolRun(null);
    setCompactRun(null);
  };

  const handleCreateProfile = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const p = await api.profiles.create({ display_name: newName.trim() });
      setProfiles((prev) => [...prev, p]);
      setSelectedProfileId(p.id);
      setShowCreate(false);
      setNewName("");
      toast.success("Profil erstellt");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setCreating(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedProfileId) return;
    setGenerating(true);
    try {
      const run = await api.generate.poolResume(selectedProfileId, { language_override: language });
      setPoolRun(run);
      setCompactRun(null);
      toast.success("Pool-CV erstellt!");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setGenerating(false);
    }
  };

  const handleCompact = async () => {
    if (!poolRun) return;
    setCompacting(true);
    try {
      const run = await api.runs.compact(poolRun.id);
      setCompactRun(run);
      toast.success("Kompaktversion erstellt!");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setCompacting(false);
    }
  };

  const handleDeletePool = async () => {
    if (!poolRun || !confirm("Pool-CV löschen?")) return;
    await api.runs.delete(poolRun.id);
    if (compactRun) await api.runs.delete(compactRun.id).catch(() => {});
    setPoolRun(null);
    setCompactRun(null);
    toast.success("Pool-CV gelöscht");
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-serif font-semibold">Pool-CV</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vollständiges Master-CV — unabhängig von einer Stelle
        </p>
      </div>

      {/* Profile Picker */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Profil wählen
          </CardTitle>
        </CardHeader>
        <CardContent>
          {showCreate ? (
            <div className="flex gap-2 items-center">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateProfile(); if (e.key === "Escape") setShowCreate(false); }}
                placeholder="Name eingeben…"
                className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button size="sm" onClick={handleCreateProfile} disabled={creating}>
                {creating ? "…" : "Erstellen"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Abbruch</Button>
            </div>
          ) : (
            <ProfilePicker
              profiles={profiles}
              selectedId={selectedProfileId}
              onSelect={handleSelectProfile}
              onCreateNew={() => setShowCreate(true)}
              onPhotoUploaded={() => api.profiles.list().then(setProfiles)}
            />
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      {selectedProfileId && (
        <div className="flex flex-wrap gap-3 items-center">
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? "Generiere Pool-CV…" : poolRun ? "Neu generieren" : "Pool-CV erstellen"}
          </Button>
          {poolRun && !compactRun && (
            <Button variant="outline" onClick={handleCompact} disabled={compacting}>
              {compacting ? "Kürze…" : "Auf 1 Seite kürzen"}
            </Button>
          )}
          {poolRun && (
            <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={handleDeletePool}>
              Pool-CV löschen
            </Button>
          )}
          <div className="ml-auto">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="h-8 rounded-lg border border-border bg-background px-2.5 text-sm"
            >
              <option value="de">Deutsch</option>
              <option value="en">English</option>
              <option value="fr">Français</option>
            </select>
          </div>
        </div>
      )}

      {/* Pool CV Editor */}
      {poolRun ? (
        <PoolResumeEditor
          run={poolRun}
          compactRun={compactRun}
          onOutputSaved={setPoolRun}
          onCompact={handleCompact}
          compacting={compacting}
        />
      ) : selectedProfileId ? (
        <div className="border border-dashed border-border rounded-xl p-14 text-center text-muted-foreground bg-card">
          Noch kein Pool-CV für dieses Profil. Klicke auf &quot;Pool-CV erstellen&quot;.
        </div>
      ) : null}
    </div>
  );
}

// ── Pool Resume Editor ────────────────────────────────────────────────────────

function PoolResumeEditor({
  run,
  compactRun,
  onOutputSaved,
  onCompact,
  compacting,
}: {
  run: GenerationRun;
  compactRun: GenerationRun | null;
  onOutputSaved: (r: GenerationRun) => void;
  onCompact: () => void;
  compacting: boolean;
}) {
  const [view, setView] = useState<"full" | "compact">("full");
  const [latexTemplate, setLatexTemplate] = useState<"modern" | "classic" | "academic">("modern");
  const activeRun = view === "compact" && compactRun ? compactRun : run;

  const previewUrl = `${API}/export/runs/${activeRun.id}/resume/html`;
  const pdfUrl = `${API}/export/runs/${activeRun.id}/resume/pdf`;
  const latexUrl = `${API}/export/runs/${activeRun.id}/resume/latex?template=${latexTemplate}`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
        <CardTitle className="text-base font-serif">
          Pool-CV{" "}
          <span className="text-muted-foreground font-mono text-xs ml-2">{activeRun.id.slice(0, 8)}</span>
        </CardTitle>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setView("full")}
              className={`px-3 py-1 text-xs font-medium transition-colors ${view === "full" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Vollversion
            </button>
            <button
              onClick={() => setView("compact")}
              disabled={!compactRun}
              className={`px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${view === "compact" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Kompakt
            </button>
          </div>
          {!compactRun && (
            <Button size="sm" variant="outline" onClick={onCompact} disabled={compacting}>
              {compacting ? "Kürze…" : "Auf 1 Seite kürzen"}
            </Button>
          )}
          <a href={previewUrl} target="_blank" rel="noreferrer"
            className="inline-flex items-center rounded-lg border border-border bg-background px-2.5 text-xs h-7 font-medium hover:bg-muted">
            HTML Vorschau
          </a>
          <a href={pdfUrl} download
            className="inline-flex items-center rounded-lg bg-primary text-primary-foreground px-2.5 text-xs h-7 font-medium hover:bg-accent">
            PDF
          </a>
          <div className="flex items-center gap-1 border rounded-lg overflow-hidden h-7">
            <select
              value={latexTemplate}
              onChange={(e) => setLatexTemplate(e.target.value as typeof latexTemplate)}
              className="h-7 text-xs px-2 bg-background border-0 outline-none"
            >
              <option value="modern">Modern</option>
              <option value="classic">Klassisch (DIN 5008)</option>
              <option value="academic">Akademisch</option>
            </select>
            <a href={latexUrl} download
              className="inline-flex items-center bg-accent text-accent-foreground px-2.5 text-xs h-7 font-medium hover:opacity-80 whitespace-nowrap">
              .tex ↓
            </a>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <InlineResumeEditor run={activeRun} onSaved={onOutputSaved} />
      </CardContent>
    </Card>
  );
}

// ── Inline Resume Editor ──────────────────────────────────────────────────────

function InlineResumeEditor({ run, onSaved }: { run: GenerationRun; onSaved: (r: GenerationRun) => void }) {
  const [previewKey, setPreviewKey] = useState(0);

  const patch = async (path: string, value: unknown, op?: string) => {
    try {
      const updated = await api.runs.patchOutputs(run.id, path, value, op);
      onSaved(updated);
      setPreviewKey((k) => k + 1);
      toast.success("Gespeichert");
    } catch (e) {
      toast.error(String(e));
    }
  };

  const outputs = run.generation_outputs as Record<string, unknown>;
  const summary = (outputs?.professional_summary as Record<string, string> | null)?.text || "";
  const rawSections = outputs?.sections;
  const sections: Array<Record<string, unknown>> = Array.isArray(rawSections) ? rawSections : [];

  return (
    <div className="flex flex-col gap-4">
      {summary && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Zusammenfassung</p>
          <EditableField value={summary} onSave={(v) => patch("professional_summary.text", v)} />
        </div>
      )}

      {sections.map((section, si) => {
        const items = (section.items as Array<Record<string, unknown>>) || [];
        const itemsPath = `sections.${si}.items`;
        return (
          <div key={si}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {String(section.title || "")}
            </p>
            <div className="flex flex-col gap-3">
              {items.map((item, ii) => {
                const bullets = (item.bullets as Array<Record<string, string>>) || [];
                const bulletsPath = `sections.${si}.items.${ii}.bullets`;
                return (
                  <div key={ii} className="pl-3 border-l-2 border-border">
                    <div className="flex items-start gap-1">
                      <div className="flex-1">
                        <EditableField
                          value={String(item.title || "")}
                          onSave={(v) => patch(`sections.${si}.items.${ii}.title`, v)}
                          className="font-semibold"
                        />
                      </div>
                      <button
                        onClick={() => patch(itemsPath, ii, "delete")}
                        className="mt-1 w-6 h-6 flex-shrink-0 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-red-50 text-base leading-none transition-colors"
                        title="Eintrag löschen"
                      >×</button>
                    </div>
                    <EditableField value={String(item.subtitle ?? "")} onSave={(v) => patch(`sections.${si}.items.${ii}.subtitle`, v)} compact className="text-xs text-muted-foreground" />
                    <EditableField value={String(item.date_range ?? "")} onSave={(v) => patch(`sections.${si}.items.${ii}.date_range`, v)} compact className="text-xs text-muted-foreground" />
                    {bullets.map((b, bi) => (
                      <div key={bi} className="mt-1 flex items-start gap-1">
                        <div className="flex-1">
                          <EditableField
                            value={typeof b === "object" ? (b.text ?? "") : String(b)}
                            onSave={(v) => patch(`${bulletsPath}.${bi}.text`, v)}
                            compact
                          />
                        </div>
                        <button onClick={() => patch(bulletsPath, bi, "delete")} className="mt-1.5 w-6 h-6 flex-shrink-0 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-red-50 text-base leading-none transition-colors" title="Bullet löschen">×</button>
                      </div>
                    ))}
                    <button onClick={() => patch(bulletsPath, { text: "", evidence_ids: [] }, "append")} className="mt-1.5 text-xs text-primary/70 hover:text-primary">
                      + Bullet hinzufügen
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => patch(itemsPath, { item_type: "entry", title: "", subtitle: null, date_range: null, location: null, bullets: [], metadata: {} }, "append")}
              className="mt-2 text-xs text-primary/70 hover:text-primary"
            >
              + Eintrag hinzufügen
            </button>
          </div>
        );
      })}

      <div className="mt-2">
        <p className="text-xs text-muted-foreground mb-1">Vorschau</p>
        <iframe
          key={previewKey}
          src={`${API}/export/runs/${run.id}/resume/html`}
          className="w-full border border-border rounded-lg"
          style={{ height: 600 }}
          title="Pool-CV Vorschau"
        />
      </div>
    </div>
  );
}

function EditableField({ value, onSave, compact = false, className = "" }: { value: string; onSave: (v: string) => void; compact?: boolean; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const handleSave = () => { onSave(draft); setEditing(false); };

  if (editing) {
    return (
      <div className="flex flex-col gap-1">
        <textarea
          autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
          className="w-full text-sm border border-primary/40 rounded-md p-2 resize-y bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          rows={compact ? 2 : 4}
          onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) handleSave(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
        />
        <div className="flex gap-2 text-xs">
          <button onClick={handleSave} className="text-primary font-medium hover:underline">Speichern (Ctrl+Enter)</button>
          <button onClick={() => { setDraft(value); setEditing(false); }} className="text-muted-foreground hover:underline">Abbrechen</button>
        </div>
      </div>
    );
  }

  return (
    <div onClick={() => { setDraft(value); setEditing(true); }} title="Klicken zum Bearbeiten" className={`cursor-text text-sm hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 transition-colors ${className}`}>
      {value || <span className="text-muted-foreground italic">Leer</span>}
    </div>
  );
}
