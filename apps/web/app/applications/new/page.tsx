"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, type Profile, type Job } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ProfilePicker } from "@/components/profile-picker";

export default function NewApplicationPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [profileId, setProfileId] = useState("");
  const [jobMode, setJobMode] = useState<"existing" | "new">("existing");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [jobText, setJobText] = useState("");
  const [label, setLabel] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    Promise.all([api.profiles.list(), api.jobs.list()])
      .then(([p, j]) => {
        setProfiles(p);
        setJobs(j);
        if (p.length > 0) setProfileId(p[0].id);
        if (j.length > 0) setSelectedJobId(j[0].id);
      })
      .catch(() => toast.error("Daten konnten nicht geladen werden — läuft das Backend?"));
  }, []);

  const handleCreate = async () => {
    if (!profileId) { toast.error("Profil wählen"); return; }

    let jobId = selectedJobId;

    if (jobMode === "new") {
      if (!jobText.trim()) { toast.error("Stellenbeschreibung eingeben"); return; }
      setAnalyzing(true);
      try {
        const job = await api.jobs.analyze(jobText);
        jobId = job.id;
        toast.success(`Job analysiert: ${job.title || "Stelle"}`);
      } catch (e) {
        toast.error(String(e));
        return;
      } finally {
        setAnalyzing(false);
      }
    }

    if (!jobId) { toast.error("Job wählen oder analysieren"); return; }

    setCreating(true);
    try {
      const app = await api.applications.create({
        profile_id: profileId,
        job_id: jobId,
        label: label || undefined,
      });
      toast.success("Bewerbung angelegt!");
      router.push(`/applications/${app.id}`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <button onClick={() => router.back()} className="text-sm text-muted-foreground hover:text-foreground mb-2">
          ← Zurück
        </button>
        <h1 className="text-3xl font-serif font-semibold">Neue Bewerbung</h1>
      </div>

      <Card>
        <CardHeader><CardTitle className="font-serif">Profil</CardTitle></CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Kein Profil gefunden.{" "}
              <button onClick={() => router.push("/profile")} className="text-primary underline">
                Profil anlegen
              </button>
            </p>
          ) : (
            <ProfilePicker
              profiles={profiles}
              selectedId={profileId || null}
              onSelect={setProfileId}
              onCreateNew={() => router.push("/profile")}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-serif">Stelle</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setJobMode("existing")}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                jobMode === "existing"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Aus Liste wählen
            </button>
            <button
              onClick={() => setJobMode("new")}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                jobMode === "new"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Neu analysieren
            </button>
          </div>

          {jobMode === "existing" ? (
            jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Noch keine Jobs gespeichert — wechsle zu "Neu analysieren".
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                <Label>Job wählen</Label>
                <select
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
                >
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title || "Unbekannt"}{j.company ? ` · ${j.company}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )
          ) : (
            <div className="flex flex-col gap-1">
              <Label>Stellenbeschreibung einfügen</Label>
              <Textarea
                rows={10}
                placeholder="Vollständige Stellenbeschreibung hier einfügen…"
                value={jobText}
                onChange={(e) => setJobText(e.target.value)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-serif">Details (optional)</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1">
            <Label>Label / Notiz</Label>
            <Input
              placeholder="z.B. 'Top-Priorität', 'über LinkedIn gefunden'"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button
          onClick={handleCreate}
          disabled={analyzing || creating || !profileId || (jobMode === "existing" && !selectedJobId)}
        >
          {analyzing ? "Analysiere Stelle…" : creating ? "Erstelle…" : "Bewerbung anlegen"}
        </Button>
        <Button variant="outline" onClick={() => router.back()}>Abbrechen</Button>
      </div>
    </div>
  );
}
