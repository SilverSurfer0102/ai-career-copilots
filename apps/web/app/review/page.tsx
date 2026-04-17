"use client";
import { useState } from "react";
import { toast } from "sonner";
import { api, type EvidencePack, type EvidenceEntry } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function ReviewPage() {
  const [profileId, setProfileId] = useState("");
  const [jobId, setJobId] = useState("");
  const [loading, setLoading] = useState(false);
  const [pack, setPack] = useState<EvidencePack | null>(null);
  const [overrides, setOverrides] = useState<Record<string, "include" | "exclude">>({});

  const onFetch = async () => {
    if (!profileId || !jobId) return;
    setLoading(true);
    try {
      const result = await api.retrieval.evidencePack(profileId, jobId, overrides);
      setPack(result);
    } catch (e: unknown) {
      toast.error(String(e));
    } finally {
      setLoading(false);
    }
  };

  const toggle = (entityId: string, current: string | undefined) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (current === "exclude") delete next[entityId];
      else next[entityId] = "exclude";
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Evidence Review</h1>

      <Card>
        <CardHeader><CardTitle>Load Evidence Pack</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <Label>Profile ID</Label>
            <Input value={profileId} onChange={(e) => setProfileId(e.target.value)} placeholder="paste profile id" />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Job ID</Label>
            <Input value={jobId} onChange={(e) => setJobId(e.target.value)} placeholder="paste job id" />
          </div>
          <div className="col-span-2">
            <Button onClick={onFetch} disabled={loading || !profileId || !jobId}>
              {loading ? "Retrieving…" : "Fetch Evidence Pack"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {pack && (
        <>
          <div className="text-sm text-gray-500">
            {pack.entries.length} evidence blocks retrieved · Total score: {pack.total_score.toFixed(1)} · Method: {pack.retrieval_method}
          </div>

          <div className="flex flex-col gap-3">
            {pack.entries.map((entry) => (
              <EvidenceCard
                key={entry.entity_id}
                entry={entry}
                excluded={overrides[entry.entity_id] === "exclude"}
                onToggle={() => toggle(entry.entity_id, overrides[entry.entity_id])}
              />
            ))}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
            Excluded entities: {Object.keys(overrides).filter((k) => overrides[k] === "exclude").length}.
            Click <strong>Fetch Evidence Pack</strong> again to apply overrides, then go to Workspace.
          </div>
        </>
      )}
    </div>
  );
}

function EvidenceCard({
  entry,
  excluded,
  onToggle,
}: {
  entry: EvidenceEntry;
  excluded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`border rounded-lg p-4 bg-white transition-opacity ${excluded ? "opacity-40" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{entry.entity_type}</Badge>
            <span className="text-xs text-gray-400 font-mono">{entry.entity_id.slice(0, 8)}…</span>
            <span className="ml-auto text-xs font-mono text-indigo-600">score: {entry.relevance_score.toFixed(1)}</span>
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {entry.reasons.map((r, i) => (
              <span key={i} className="text-xs text-gray-600 bg-gray-100 rounded px-2 py-0.5">{r}</span>
            ))}
          </div>
        </div>
        <Button
          size="sm"
          variant={excluded ? "default" : "outline"}
          onClick={onToggle}
          className="shrink-0"
        >
          {excluded ? "Re-include" : "Exclude"}
        </Button>
      </div>
    </div>
  );
}
