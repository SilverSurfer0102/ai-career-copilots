"use client";
import { useState } from "react";
import { toast } from "sonner";
import { api, type GenerationRun, type ValidationReport } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function WorkspacePage() {
  const [profileId, setProfileId] = useState("");
  const [jobId, setJobId] = useState("");
  const [evidenceIds, setEvidenceIds] = useState("");
  const [language, setLanguage] = useState("auto");
  const [resumeRun, setResumeRun] = useState<GenerationRun | null>(null);
  const [coverRun, setCoverRun] = useState<GenerationRun | null>(null);
  const [matchRun, setMatchRun] = useState<GenerationRun | null>(null);
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  const req = () => ({
    profile_id: profileId,
    job_id: jobId,
    selected_evidence_ids: evidenceIds
      ? evidenceIds.split(",").map((s) => s.trim()).filter(Boolean)
      : [],
    options: language !== "auto" ? { language_override: language } : {},
  });

  const generate = async (type: "resume" | "cover-letter" | "match") => {
    if (!profileId || !jobId) {
      toast.error("Profile ID and Job ID are required");
      return;
    }
    setGenerating(type);
    try {
      if (type === "resume") {
        const run = await api.generate.resume(req());
        setResumeRun(run);
        toast.success("Resume generated!");
      } else if (type === "cover-letter") {
        const run = await api.generate.coverLetter(req());
        setCoverRun(run);
        toast.success("Cover letter generated!");
      } else {
        const run = await api.generate.matchAnalysis(req());
        setMatchRun(run);
        toast.success("Match analysis done!");
      }
    } catch (e: unknown) {
      toast.error(String(e));
    } finally {
      setGenerating(null);
    }
  };

  const validate = async () => {
    const run = resumeRun || coverRun;
    if (!run) { toast.error("Generate a resume or cover letter first"); return; }
    setValidating(true);
    try {
      const report = await api.validate.run(run.id);
      setValidation(report);
      toast.success("Validation complete");
    } catch (e: unknown) {
      toast.error(String(e));
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Generation Workspace</h1>

      <Card>
        <CardHeader><CardTitle>Setup</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <Label>Profile ID *</Label>
            <Input value={profileId} onChange={(e) => setProfileId(e.target.value)} placeholder="from Profile page" />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Job ID *</Label>
            <Input value={jobId} onChange={(e) => setJobId(e.target.value)} placeholder="from Jobs page" />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Evidence IDs (optional, comma-separated)</Label>
            <Input value={evidenceIds} onChange={(e) => setEvidenceIds(e.target.value)} placeholder="leave blank to auto-select" />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Output Language</Label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="h-8 rounded-lg border border-border bg-background px-2.5 text-sm"
            >
              <option value="auto">Auto (from job description)</option>
              <option value="de">Deutsch</option>
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="es">Español</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => generate("resume")} disabled={!!generating}>
          {generating === "resume" ? "Generating Resume…" : "Generate Resume"}
        </Button>
        <Button variant="outline" onClick={() => generate("cover-letter")} disabled={!!generating}>
          {generating === "cover-letter" ? "Generating…" : "Generate Cover Letter"}
        </Button>
        <Button variant="outline" onClick={() => generate("match")} disabled={!!generating}>
          {generating === "match" ? "Analyzing…" : "Match Analysis"}
        </Button>
        <Button variant="secondary" onClick={validate} disabled={validating}>
          {validating ? "Validating…" : "Validate Output"}
        </Button>
      </div>

      <Tabs defaultValue="resume">
        <TabsList>
          <TabsTrigger value="resume">Resume</TabsTrigger>
          <TabsTrigger value="cover">Cover Letter</TabsTrigger>
          <TabsTrigger value="match">Match Analysis</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
        </TabsList>

        <TabsContent value="resume">
          {resumeRun ? (
            <RunCard run={resumeRun} type="resume" />
          ) : (
            <Placeholder text="No resume generated yet." />
          )}
        </TabsContent>

        <TabsContent value="cover">
          {coverRun ? (
            <RunCard run={coverRun} type="cover_letter" />
          ) : (
            <Placeholder text="No cover letter generated yet." />
          )}
        </TabsContent>

        <TabsContent value="match">
          {matchRun ? (
            <MatchCard run={matchRun} />
          ) : (
            <Placeholder text="No match analysis yet." />
          )}
        </TabsContent>

        <TabsContent value="validation">
          {validation ? (
            <ValidationCard report={validation} />
          ) : (
            <Placeholder text="Run validation to check evidence support." />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RunCard({ run, type }: { run: GenerationRun; type: string }) {
  const exportBase = `/api-proxy/export/runs/${run.id}`;
  const isResume = type === "resume";
  const previewUrl = isResume
    ? `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/export/runs/${run.id}/resume/html`
    : `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/export/runs/${run.id}/cover-letter/html`;
  const pdfUrl = isResume
    ? `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/export/runs/${run.id}/resume/pdf`
    : `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/export/runs/${run.id}/cover-letter/pdf`;

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          {isResume ? "Resume" : "Cover Letter"}{" "}
          <span className="text-gray-400 font-mono text-xs ml-2">{run.id.slice(0, 8)}</span>
        </CardTitle>
        <div className="flex gap-2">
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] h-7 font-medium hover:bg-muted"
          >
            Preview HTML
          </a>
          <a
            href={pdfUrl}
            download
            className="inline-flex items-center rounded-lg bg-primary text-primary-foreground px-2.5 text-[0.8rem] h-7 font-medium hover:bg-primary/80"
          >
            Download PDF
          </a>
        </div>
      </CardHeader>
      <CardContent>
        <iframe
          src={previewUrl}
          className="w-full border rounded"
          style={{ height: 600 }}
          title="Document preview"
        />
      </CardContent>
    </Card>
  );
}

function MatchCard({ run }: { run: GenerationRun }) {
  const out = run.generation_outputs as Record<string, unknown>;
  const strengths = (out.strengths as Array<{ area: string; description: string }>) || [];
  const gaps = (out.gaps as Array<{ requirement: string; gap_type: string; suggestion: string }>) || [];
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-3">
          Fit: <Badge className="text-base">{String(out.fit_level)}</Badge>
          <span className="text-gray-500">Score: {String(out.overall_fit_score)}/100</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm">{String(out.summary || "")}</p>
        {strengths.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2 text-sm">Strengths</h3>
            <ul className="space-y-1">
              {strengths.map((s, i) => (
                <li key={i} className="text-sm text-green-800 bg-green-50 rounded px-3 py-1">✓ {s.description}</li>
              ))}
            </ul>
          </div>
        )}
        {gaps.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2 text-sm">Gaps</h3>
            <ul className="space-y-1">
              {gaps.map((g, i) => (
                <li key={i} className="text-sm text-amber-800 bg-amber-50 rounded px-3 py-1">
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

function ValidationCard({ report }: { report: ValidationReport }) {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-3">
          Validation Report
          <Badge variant={report.overall_supported ? "default" : "destructive"}>
            {report.overall_supported ? "Supported" : "Issues Found"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm">{report.summary}</p>
        <div className="flex gap-4 text-sm">
          <span className="text-red-700">Unsupported: {report.unsupported_count}</span>
          <span className="text-orange-700">High Risk: {report.high_risk_count}</span>
        </div>
        <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
          {report.claims.map((c, i) => (
            <div
              key={i}
              className={`text-xs rounded p-2 border ${
                c.risk_level === "high"
                  ? "bg-red-50 border-red-200"
                  : c.risk_level === "medium"
                  ? "bg-amber-50 border-amber-200"
                  : "bg-green-50 border-green-200"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs">{c.risk_level}</Badge>
                {c.supported ? "✓ supported" : "✗ unsupported"}
              </div>
              <p>{c.claim}</p>
              {c.reason && <p className="text-gray-500 mt-1">{c.reason}</p>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="mt-4 border rounded-lg p-8 text-center text-gray-400 bg-white">{text}</div>
  );
}
