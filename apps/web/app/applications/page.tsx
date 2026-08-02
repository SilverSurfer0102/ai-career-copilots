"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, type Application, type ApplicationStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const STATUS_ORDER: ApplicationStatus[] = [
  "draft", "ready", "submitted", "interview", "offer", "rejected", "archived",
];

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
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  ready: "bg-blue-50 text-blue-700 border-blue-200",
  submitted: "bg-amber-50 text-amber-700 border-amber-200",
  interview: "bg-purple-50 text-purple-700 border-purple-200",
  offer: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  archived: "bg-gray-50 text-gray-400 border-gray-200",
};

function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function AppCard({
  app, onClick, selected, onToggleSelect,
}: {
  app: Application; onClick: () => void; selected: boolean; onToggleSelect: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-card border rounded-xl p-4 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all ${selected ? "border-primary ring-1 ring-primary/40" : "border-border"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex items-start gap-2">
          <input
            type="checkbox"
            checked={selected}
            onClick={(e) => e.stopPropagation()}
            onChange={onToggleSelect}
            className="mt-1 shrink-0"
          />
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{app.job_title || "Unbekannte Stelle"}</p>
            <p className="text-muted-foreground text-xs mt-0.5">{app.job_company || "Unbekannte Firma"}</p>
          </div>
        </div>
        <StatusBadge status={app.status as ApplicationStatus} />
      </div>
      {app.label && (
        <p className="text-xs text-muted-foreground mt-2 italic">{app.label}</p>
      )}
      <p className="text-xs text-muted-foreground mt-2">
        {new Date(app.created_at).toLocaleDateString("de-DE")}
        {app.profile_name && <span> · {app.profile_name}</span>}
      </p>
    </div>
  );
}

export default function ApplicationsPage() {
  const router = useRouter();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBatchExport = async () => {
    if (selected.size === 0) return;
    setExporting(true);
    try {
      const { blob, skipped } = await api.export.batchExportZip(Array.from(selected));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "bewerbungen.zip";
      a.click();
      URL.revokeObjectURL(url);
      if (skipped.length > 0) {
        toast.warning(`${skipped.length} Bewerbung(en) übersprungen`, {
          description: skipped.map((s) => s.reason).join(" · "),
        });
      } else {
        toast.success("Export fertig");
      }
      setSelected(new Set());
    } catch (e) {
      toast.error(String(e));
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    api.applications.list()
      .then(setApps)
      .catch(() => toast.error("Fehler beim Laden der Bewerbungen"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = apps.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (a.job_title || "").toLowerCase().includes(q) ||
      (a.job_company || "").toLowerCase().includes(q) ||
      (a.label || "").toLowerCase().includes(q)
    );
  });

  const grouped = STATUS_ORDER.reduce<Record<ApplicationStatus, Application[]>>(
    (acc, s) => {
      acc[s] = filtered.filter((a) => a.status === s);
      return acc;
    },
    {} as Record<ApplicationStatus, Application[]>
  );

  const activeStatuses = STATUS_ORDER.filter((s) => grouped[s].length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-3xl font-serif font-semibold">Bewerbungen</h1>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <Button variant="outline" onClick={handleBatchExport} disabled={exporting}>
              {exporting ? "Exportiere…" : `${selected.size} exportieren`}
            </Button>
          )}
          <Button onClick={() => router.push("/applications/new")}>
            + Neue Bewerbung
          </Button>
        </div>
      </div>

      <div className="w-full max-w-sm">
        <Input
          placeholder="Suchen nach Titel, Firma…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Lade Bewerbungen…</p>
      ) : apps.length === 0 ? (
        <div className="border border-dashed border-border rounded-2xl p-16 text-center">
          <p className="text-lg font-serif text-muted-foreground">Noch keine Bewerbungen</p>
          <p className="text-sm text-muted-foreground mt-2">
            Erstelle deine erste Bewerbung und generiere ein maßgeschneidertes CV.
          </p>
          <Button className="mt-6" onClick={() => router.push("/applications/new")}>
            Jetzt starten
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {activeStatuses.map((status) => (
            <div key={status}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {STATUS_LABELS[status]}
                </h2>
                <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                  {grouped[status].length}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {grouped[status].map((app) => (
                  <AppCard
                    key={app.id}
                    app={app}
                    onClick={() => router.push(`/applications/${app.id}`)}
                    selected={selected.has(app.id)}
                    onToggleSelect={() => toggleSelect(app.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
