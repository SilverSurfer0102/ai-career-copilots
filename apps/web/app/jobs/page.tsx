"use client";
import { useState } from "react";
import { toast } from "sonner";
import { api, type Job } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function JobsPage() {
  const [rawText, setRawText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [job, setJob] = useState<Job | null>(null);

  const onAnalyze = async () => {
    if (!rawText.trim()) return;
    setAnalyzing(true);
    try {
      const result = await api.jobs.analyze(rawText);
      setJob(result);
      toast.success("Job description analyzed!");
    } catch (e: unknown) {
      toast.error(String(e));
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Job Description</h1>

      <Card>
        <CardHeader><CardTitle>Paste Job Description</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Textarea
            placeholder="Paste the full job description here…"
            rows={12}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />
          <Button onClick={onAnalyze} disabled={analyzing || !rawText.trim()}>
            {analyzing ? "Analyzing…" : "Analyze Job Description"}
          </Button>
        </CardContent>
      </Card>

      {job && (
        <>
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-sm">
            <strong>Job ID:</strong> <code className="font-mono">{job.id}</code>
            <span className="text-gray-500 ml-2">— save this to use in Workspace</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Overview</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm">
                <Row label="Title" value={job.title} />
                <Row label="Company" value={job.company} />
                <Row label="Seniority" value={job.seniority} />
                <Row label="Location" value={job.location} />
                <Row label="Remote" value={job.remote_hint} />
                <Row label="Language" value={job.output_language} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Must-Have Skills</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {job.must_have_skills.map((s) => (
                  <Badge key={s} className="bg-red-100 text-red-800 border-red-200">{s}</Badge>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Nice-to-Have Skills</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {job.nice_to_have_skills.map((s) => (
                  <Badge key={s} variant="secondary">{s}</Badge>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Keywords</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {job.keywords.map((k) => (
                  <Badge key={k} variant="outline">{k}</Badge>
                ))}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader><CardTitle className="text-base">Responsibilities</CardTitle></CardHeader>
              <CardContent>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {job.responsibilities.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <span className="text-gray-500 w-24 shrink-0">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
