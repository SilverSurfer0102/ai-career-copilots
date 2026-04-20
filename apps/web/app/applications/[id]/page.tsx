"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  api,
  type ApplicationDetail,
  type ApplicationStatus,
  type GenerationRun,
  type ValidationReport,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft: "Entwurf",
  ready: "Bereit",
  submitted: "Beworben",
  interview: "Interview",
  offer: "Angebot",
  rejected: "Abgelehnt",
  archived: "Archiviert",
};

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  ready: "bg-blue-50 text-blue-700",
  submitted: "bg-amber-50 text-amber-700",
  interview: "bg-purple-50 text-purple-700",
  offer: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
  archived: "bg-gray-50 text-gray-400",
};

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const STATUSES = Object.keys(STATUS_LABELS) as ApplicationStatus[];

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [app, setApp] = useState<ApplicationDetail | null>(null);
  const [resumeRun, setResumeRun] = useState<GenerationRun | null>(null);
  const [compactRun, setCompactRun] = useState<GenerationRun | null>(null);
  const [coverRun, setCoverRun] = useState<GenerationRun | null>(null);
  const [matchRun, setMatchRun] = useState<GenerationRun | null>(null);
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [compacting, setCompacting] = useState(false);
  const [notes, setNotes] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [language, setLanguage] = useState("auto");

  const loadRuns = useCallback(async () => {
    const runs = await api.runs.list({ application_id: id });
    const resume = runs.filter((r) => r.run_type === "resume").sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
    const compact = runs.filter((r) => r.run_type === "resume_compact").sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
    const cover = runs.filter((r) => r.run_type === "cover_letter")[0];
    const match = runs.filter((r) => r.run_type === "match_analysis")[0];
    if (resume) setResumeRun(resume);
    if (compact) setCompactRun(compact);
    if (cover) setCoverRun(cover);
    if (match) setMatchRun(match);
  }, [id]);

  useEffect(() => {
    api.applications.get(id).then((a) => {
      setApp(a);
      setNotes(a.notes || "");
    }).catch(() => toast.error("Bewerbung nicht gefunden"));
    loadRuns();
  }, [id, loadRuns]);

  const updateStatus = async (status: ApplicationStatus) => {
    if (!app) return;
    const updated = await api.applications.update(id, { status });
    setApp((prev) => prev ? { ...prev, status: updated.status as ApplicationStatus } : prev);
    toast.success("Status aktualisiert");
  };

  const saveNotes = async () => {
    await api.applications.update(id, { notes });
    setEditingNotes(false);
    toast.success("Notizen gespeichert");
  };

  const generate = async (type: "resume" | "cover-letter" | "match") => {
    if (!app) return;
    setGenerating(type);
    try {
      const req = {
        profile_id: app.profile_id,
        job_id: app.job_id,
        application_id: id,
        options: language !== "auto" ? { language_override: language } : {},
      };
      if (type === "resume") {
        const run = await api.generate.resume(req);
        setResumeRun(run);
        toast.success("Lebenslauf generiert!");
      } else if (type === "cover-letter") {
        const run = await api.generate.coverLetter(req);
        setCoverRun(run);
        toast.success("Anschreiben generiert!");
      } else {
        const run = await api.generate.matchAnalysis(req);
        setMatchRun(run);
        toast.success("Match-Analyse fertig!");
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setGenerating(null);
    }
  };

  const handleValidate = async () => {
    const run = resumeRun || coverRun;
    if (!run) { toast.error("Erst CV oder Anschreiben generieren"); return; }
    setValidating(true);
    try {
      const report = await api.validate.run(run.id);
      setValidation(report);
      toast.success("Validierung abgeschlossen");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setValidating(false);
    }
  };

  const deleteRun = async (run: GenerationRun, clear: () => void) => {
    if (!confirm("Diesen Entwurf löschen?")) return;
    await api.runs.delete(run.id);
    clear();
    toast.success("Entwurf gelöscht");
  };

  const handleCompact = async () => {
    if (!resumeRun) { toast.error("Erst einen Lebenslauf generieren"); return; }
    setCompacting(true);
    try {
      const run = await api.runs.compact(resumeRun.id);
      setCompactRun(run);
      toast.success("Kompaktversion erstellt!");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setCompacting(false);
    }
  };

  if (!app) {
    return <div className="text-muted-foreground text-sm p-4">Lade…</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button onClick={() => router.push("/applications")} className="text-sm text-muted-foreground hover:text-foreground mb-1">
            ← Alle Bewerbungen
          </button>
          <h1 className="text-2xl font-serif font-semibold">
            {app.job_title || "Bewerbung"}
            {app.job_company && <span className="text-muted-foreground font-normal"> · {app.job_company}</span>}
          </h1>
          {app.profile_name && (
            <p className="text-sm text-muted-foreground mt-0.5">Profil: {app.profile_name}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={app.status}
            onChange={(e) => updateStatus(e.target.value as ApplicationStatus)}
            className={`h-8 rounded-lg border border-border px-2.5 text-sm font-medium cursor-pointer ${STATUS_COLORS[app.status as ApplicationStatus] || ""}`}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <Button
            size="sm" variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={async () => {
              if (!confirm("Bewerbung löschen?")) return;
              await api.applications.delete(id);
              router.push("/applications");
            }}
          >
            Löschen
          </Button>
        </div>
      </div>

      {/* Notes */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Notizen</CardTitle>
            {editingNotes ? (
              <div className="flex gap-2">
                <Button size="sm" onClick={saveNotes}>Speichern</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingNotes(false)}>Abbruch</Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setEditingNotes(true)}>Bearbeiten</Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editingNotes ? (
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Notizen zu dieser Bewerbung…"
              autoFocus
            />
          ) : (
            <p className="text-sm text-muted-foreground min-h-[2rem]">
              {notes || "Keine Notizen"}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Generation actions */}
      <div className="flex flex-wrap gap-3 items-center">
        <Button onClick={() => generate("resume")} disabled={!!generating}>
          {generating === "resume" ? "Generiere CV…" : "CV generieren"}
        </Button>
        <Button variant="outline" onClick={() => generate("cover-letter")} disabled={!!generating}>
          {generating === "cover-letter" ? "Generiere…" : "Anschreiben"}
        </Button>
        <Button variant="outline" onClick={() => generate("match")} disabled={!!generating}>
          {generating === "match" ? "Analysiere…" : "Match-Analyse"}
        </Button>
        <Button variant="secondary" onClick={handleValidate} disabled={validating}>
          {validating ? "Prüfe…" : "Validieren"}
        </Button>
        <div className="ml-auto">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="h-8 rounded-lg border border-border bg-background px-2.5 text-sm"
          >
            <option value="auto">Sprache: Auto</option>
            <option value="de">Deutsch</option>
            <option value="en">English</option>
            <option value="fr">Français</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="resume">
        <TabsList>
          <TabsTrigger value="resume">
            Lebenslauf {resumeRun && "✓"}
          </TabsTrigger>
          <TabsTrigger value="cover">
            Anschreiben {coverRun && "✓"}
          </TabsTrigger>
          <TabsTrigger value="match">
            Match {matchRun && "✓"}
          </TabsTrigger>
          <TabsTrigger value="validation">
            Validierung {validation && (validation.overall_supported ? "✓" : "⚠")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resume">
          {resumeRun ? (
            <ResumeTab
              run={resumeRun}
              compactRun={compactRun}
              onCompact={handleCompact}
              compacting={compacting}
              onOutputSaved={(updated) => setResumeRun(updated)}
              onDelete={() => deleteRun(resumeRun, () => { setResumeRun(null); setCompactRun(null); })}
            />
          ) : (
            <Placeholder text="Noch kein Lebenslauf generiert." />
          )}
        </TabsContent>

        <TabsContent value="cover">
          {coverRun ? (
            <RunCard
              run={coverRun}
              type="cover_letter"
              onOutputSaved={(r) => setCoverRun(r)}
              onDelete={() => deleteRun(coverRun, () => setCoverRun(null))}
            />
          ) : (
            <Placeholder text="Noch kein Anschreiben generiert." />
          )}
        </TabsContent>

        <TabsContent value="match">
          {matchRun ? (
            <MatchCard run={matchRun} onDelete={() => deleteRun(matchRun, () => setMatchRun(null))} />
          ) : (
            <Placeholder text="Noch keine Match-Analyse." />
          )}
        </TabsContent>

        <TabsContent value="validation">
          {validation ? (
            <ValidationCard report={validation} />
          ) : (
            <Placeholder text="Validierung starten um Behauptungen zu prüfen." />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Resume Tab with Compact toggle ───────────────────────────────────────────

function ResumeTab({
  run,
  compactRun,
  onCompact,
  compacting,
  onOutputSaved,
  onDelete,
}: {
  run: GenerationRun;
  compactRun: GenerationRun | null;
  onCompact: () => void;
  compacting: boolean;
  onOutputSaved: (updated: GenerationRun) => void;
  onDelete: () => void;
}) {
  const [view, setView] = useState<"full" | "compact">("full");
  const activeRun = view === "compact" && compactRun ? compactRun : run;
  const [latexTemplate, setLatexTemplate] = useState<"modern" | "classic" | "academic">("modern");

  const previewUrl = `${API}/export/runs/${activeRun.id}/resume/html`;
  const pdfUrl = `${API}/export/runs/${activeRun.id}/resume/pdf`;
  const latexUrl = `${API}/export/runs/${activeRun.id}/resume/latex?template=${latexTemplate}`;

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
        <CardTitle className="text-base font-serif">
          Lebenslauf{" "}
          <span className="text-muted-foreground font-mono text-xs ml-2">{activeRun.id.slice(0, 8)}</span>
        </CardTitle>
        <div className="flex flex-wrap gap-2 items-center">
          {/* Full / Compact toggle */}
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
          <button onClick={onDelete} className="text-red-400 hover:text-red-600 text-sm px-2" title="Entwurf löschen">✕</button>
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
      <CardContent className="flex flex-col gap-4">
        {compactRun && view === "compact" && (
          <CompactDroppedItems run={compactRun} />
        )}
        <InlineResumeEditor run={activeRun} onSaved={onOutputSaved} />
      </CardContent>
    </Card>
  );
}

function CompactDroppedItems({ run }: { run: GenerationRun }) {
  const dropped = (run.intermediate_repr as Record<string, unknown>)?.dropped_items as Array<{ type: string; title: string; reason: string }> | undefined;
  if (!dropped || dropped.length === 0) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
      <p className="font-semibold text-amber-800 mb-1">Entfernt beim Kürzen:</p>
      <ul className="space-y-0.5">
        {dropped.map((d, i) => (
          <li key={i} className="text-amber-700">
            <span className="font-medium">{d.title}</span> ({d.type}) — {d.reason}
          </li>
        ))}
      </ul>
    </div>
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
      {/* Summary */}
      {summary && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Zusammenfassung</p>
          <EditableField
            value={summary}
            onSave={(v) => patch("professional_summary.text", v)}
          />
        </div>
      )}

      {/* Sections */}
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
                    {/* Item header: title + delete button */}
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
                      >
                        ×
                      </button>
                    </div>
                    <EditableField
                      value={String(item.subtitle ?? "")}
                      onSave={(v) => patch(`sections.${si}.items.${ii}.subtitle`, v)}
                      compact
                      className="text-xs text-muted-foreground"
                    />
                    <EditableField
                      value={String(item.date_range ?? "")}
                      onSave={(v) => patch(`sections.${si}.items.${ii}.date_range`, v)}
                      compact
                      className="text-xs text-muted-foreground"
                    />
                    {bullets.map((b, bi) => (
                      <div key={bi} className="mt-1 flex items-start gap-1">
                        <div className="flex-1">
                          <EditableField
                            value={typeof b === "object" ? (b.text ?? "") : String(b)}
                            onSave={(v) => patch(`${bulletsPath}.${bi}.text`, v)}
                            compact
                          />
                        </div>
                        <button
                          onClick={() => patch(bulletsPath, bi, "delete")}
                          className="mt-1.5 w-6 h-6 flex-shrink-0 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-red-50 text-base leading-none transition-colors"
                          title="Bullet löschen"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => patch(bulletsPath, { text: "", evidence_ids: [] }, "append")}
                      className="mt-1.5 text-xs text-primary/70 hover:text-primary"
                    >
                      + Bullet hinzufügen
                    </button>
                  </div>
                );
              })}
            </div>
            {/* Add item to section */}
            <button
              onClick={() => patch(itemsPath, {
                item_type: "entry",
                title: "",
                subtitle: null,
                date_range: null,
                location: null,
                bullets: [],
                metadata: {},
              }, "append")}
              className="mt-2 text-xs text-primary/70 hover:text-primary"
            >
              + Eintrag hinzufügen
            </button>
          </div>
        );
      })}

      {/* Live iframe preview */}
      <div className="mt-2">
        <p className="text-xs text-muted-foreground mb-1">Vorschau</p>
        <iframe
          key={previewKey}
          src={`${API}/export/runs/${run.id}/resume/html`}
          className="w-full border border-border rounded-lg"
          style={{ height: 500 }}
          title="CV Vorschau"
        />
      </div>
    </div>
  );
}

function EditableField({
  value,
  onSave,
  compact = false,
  className = "",
}: {
  value: string;
  onSave: (v: string) => void;
  compact?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const handleSave = () => {
    onSave(draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-1">
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full text-sm border border-primary/40 rounded-md p-2 resize-y bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          rows={compact ? 2 : 4}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.ctrlKey) handleSave();
            if (e.key === "Escape") { setDraft(value); setEditing(false); }
          }}
        />
        <div className="flex gap-2 text-xs">
          <button onClick={handleSave} className="text-primary font-medium hover:underline">Speichern (Ctrl+Enter)</button>
          <button onClick={() => { setDraft(value); setEditing(false); }} className="text-muted-foreground hover:underline">Abbrechen</button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => { setDraft(value); setEditing(true); }}
      title="Klicken zum Bearbeiten"
      className={`cursor-text text-sm hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 transition-colors ${className}`}
    >
      {value || <span className="text-muted-foreground italic">Leer</span>}
    </div>
  );
}

// ── Cover Letter card (read-only preview) ────────────────────────────────────

function RunCard({ run, type, onDelete }: { run: GenerationRun; type: string; onOutputSaved?: (r: GenerationRun) => void; onDelete: () => void }) {
  const isResume = type === "resume";
  const previewUrl = isResume
    ? `${API}/export/runs/${run.id}/resume/html`
    : `${API}/export/runs/${run.id}/cover-letter/html`;
  const pdfUrl = isResume
    ? `${API}/export/runs/${run.id}/resume/pdf`
    : `${API}/export/runs/${run.id}/cover-letter/pdf`;

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-base font-serif">
          Anschreiben{" "}
          <span className="text-muted-foreground font-mono text-xs ml-2">{run.id.slice(0, 8)}</span>
        </CardTitle>
        <div className="flex gap-2 items-center">
          <a href={previewUrl} target="_blank" rel="noreferrer"
            className="inline-flex items-center rounded-lg border border-border bg-background px-2.5 text-xs h-7 font-medium hover:bg-muted">
            Vorschau
          </a>
          <a href={pdfUrl} download
            className="inline-flex items-center rounded-lg bg-primary text-primary-foreground px-2.5 text-xs h-7 font-medium hover:bg-accent">
            PDF
          </a>
          <button onClick={onDelete} className="text-red-400 hover:text-red-600 text-sm px-2" title="Entwurf löschen">✕</button>
        </div>
      </CardHeader>
      <CardContent>
        <iframe src={previewUrl} className="w-full border border-border rounded-lg" style={{ height: 600 }} title="Anschreiben Vorschau" />
      </CardContent>
    </Card>
  );
}

// ── Match Analysis ─────────────────────────────────────────────────────────

function MatchCard({ run, onDelete }: { run: GenerationRun; onDelete: () => void }) {
  const out = run.generation_outputs as Record<string, unknown>;
  const strengths = (out.strengths as Array<{ area: string; description: string }>) || [];
  const gaps = (out.gaps as Array<{ requirement: string; gap_type: string; suggestion: string }>) || [];
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base font-serif flex items-center gap-3 flex-wrap">
          Fit: <Badge>{String(out.fit_level)}</Badge>
          <span className="text-muted-foreground text-sm font-normal">Score: {String(out.overall_fit_score)}/100</span>
          <button onClick={onDelete} className="ml-auto text-red-400 hover:text-red-600 text-sm" title="Löschen">✕</button>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm">{String(out.summary || "")}</p>
        {strengths.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2 text-sm">Stärken</h3>
            <ul className="space-y-1">
              {strengths.map((s, i) => (
                <li key={i} className="text-sm text-green-800 bg-green-50 rounded-lg px-3 py-1.5">✓ {s.description}</li>
              ))}
            </ul>
          </div>
        )}
        {gaps.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2 text-sm">Lücken</h3>
            <ul className="space-y-1">
              {gaps.map((g, i) => (
                <li key={i} className="text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-1.5">
                  ⚠ {g.requirement} ({g.gap_type}): {g.suggestion}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Validation Report ──────────────────────────────────────────────────────

function ValidationCard({ report }: { report: ValidationReport }) {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base font-serif flex items-center gap-3">
          Validierungsbericht
          <Badge variant={report.overall_supported ? "default" : "destructive"}>
            {report.overall_supported ? "Belegt" : "Probleme gefunden"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm">{report.summary}</p>
        <div className="flex gap-4 text-sm">
          <span className="text-red-700">Unbelegt: {report.unsupported_count}</span>
          <span className="text-orange-700">Hohes Risiko: {report.high_risk_count}</span>
        </div>
        <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
          {report.claims.map((c, i) => (
            <div
              key={i}
              className={`text-xs rounded-lg p-2.5 border ${
                c.risk_level === "high"
                  ? "bg-red-50 border-red-200"
                  : c.risk_level === "medium"
                  ? "bg-amber-50 border-amber-200"
                  : "bg-green-50 border-green-200"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs">{c.risk_level}</Badge>
                {c.supported ? "✓ belegt" : "✗ unbelegt"}
              </div>
              <p>{c.claim}</p>
              {c.reason && <p className="text-muted-foreground mt-1">{c.reason}</p>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="mt-4 border border-dashed border-border rounded-xl p-10 text-center text-muted-foreground bg-card">
      {text}
    </div>
  );
}
