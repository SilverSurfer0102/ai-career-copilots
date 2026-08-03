"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, type Profile, type JobLead } from "@/lib/api";
import { ProfilePicker } from "@/components/profile-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const SOURCE_LABEL: Record<string, string> = {
  bundesagentur: "Bundesagentur für Arbeit",
  paste: "Manuell eingefügt",
};

function formatAge(dateStr?: string): string | null {
  if (!dateStr) return null;
  const posted = new Date(dateStr);
  if (isNaN(posted.getTime())) return null;
  const days = Math.floor((Date.now() - posted.getTime()) / 86_400_000);
  if (days <= 0) return "heute veröffentlicht";
  if (days === 1) return "vor 1 Tag veröffentlicht";
  if (days < 14) return `vor ${days} Tagen veröffentlicht`;
  return `vor ${Math.round(days / 7)} Wochen veröffentlicht`;
}

export default function SwipePage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [queue, setQueue] = useState<JobLead[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [deciding, setDeciding] = useState(false);

  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [excludeSenior, setExcludeSenior] = useState(true);
  const [maxAgeWeeks, setMaxAgeWeeks] = useState("5");
  const [searching, setSearching] = useState(false);

  const [pasteText, setPasteText] = useState("");
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteCompany, setPasteCompany] = useState("");
  const [pasteLocation, setPasteLocation] = useState("");
  const [pasteUrl, setPasteUrl] = useState("");
  const [pasting, setPasting] = useState(false);

  useEffect(() => {
    api.profiles.list()
      .then((ps) => {
        setProfiles(ps);
        if (ps.length > 0) setSelectedProfileId(ps[0].id);
      })
      .catch(() => toast.error("Profile konnten nicht geladen werden — läuft das Backend?"));
  }, []);

  const loadQueue = useCallback(() => {
    setLoadingQueue(true);
    api.leads.list("new")
      .then(setQueue)
      .catch(() => toast.error("Stellen-Feed konnte nicht geladen werden — läuft das Backend?"))
      .finally(() => setLoadingQueue(false));
  }, []);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  const current = queue[0] ?? null;

  const advance = (leadId: string) => {
    setQueue((prev) => prev.filter((l) => l.id !== leadId));
  };

  const handlePass = async (lead: JobLead) => {
    setDeciding(true);
    try {
      await api.leads.updateStatus(lead.id, "passed");
      advance(lead.id);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setDeciding(false);
    }
  };

  const handleLike = async (lead: JobLead) => {
    if (!selectedProfileId) {
      toast.error("Bitte zuerst ein Profil auswählen");
      return;
    }
    setDeciding(true);
    try {
      const { application_id } = await api.leads.convert(lead.id, selectedProfileId);
      advance(lead.id);
      toast.success("Bewerbung angelegt", {
        action: { label: "Öffnen", onClick: () => router.push(`/applications/${application_id}`) },
      });
    } catch (e) {
      toast.error(String(e));
    } finally {
      setDeciding(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current || deciding) return;
      if (e.key === "ArrowLeft") handlePass(current);
      if (e.key === "ArrowRight") handleLike(current);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, deciding, selectedProfileId]);

  const handleSearch = async () => {
    if (!query.trim()) { toast.error("Suchbegriff eingeben"); return; }
    setSearching(true);
    try {
      const weeks = maxAgeWeeks.trim() ? parseInt(maxAgeWeeks, 10) : null;
      const created = await api.leads.searchBundesagentur(query.trim(), location.trim(), 25, 25, excludeSenior, weeks);
      toast.success(`${created.length} neue Stelle(n) gefunden`);
      loadQueue();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSearching(false);
    }
  };

  const handlePaste = async () => {
    if (!pasteText.trim()) { toast.error("Text einfügen"); return; }
    setPasting(true);
    try {
      await api.leads.paste({
        raw_text: pasteText.trim(),
        title: pasteTitle.trim() || undefined,
        company: pasteCompany.trim() || undefined,
        location: pasteLocation.trim() || undefined,
        url: pasteUrl.trim() || undefined,
      });
      toast.success("Stelle hinzugefügt");
      setPasteText(""); setPasteTitle(""); setPasteCompany(""); setPasteLocation(""); setPasteUrl("");
      loadQueue();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setPasting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 max-w-3xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-semibold">Stellen-Feed</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bundesagentur-Suche und manuell eingefügte Stellen (z. B. von LinkedIn/Stepstone) landen hier.
          Wischen ersetzt kein Scraping — jede Stelle kommt entweder aus der öffentlichen API oder wurde
          von dir selbst hinzugefügt.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Profil für neue Bewerbungen</CardTitle></CardHeader>
        <CardContent>
          <ProfilePicker
            profiles={profiles}
            selectedId={selectedProfileId}
            onSelect={setSelectedProfileId}
            onCreateNew={() => router.push("/profile")}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Bundesagentur durchsuchen</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div>
              <Label htmlFor="query" className="text-xs">Suchbegriff</Label>
              <Input id="query" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="z. B. Data Scientist" />
            </div>
            <div>
              <Label htmlFor="loc" className="text-xs">Ort</Label>
              <Input id="loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="z. B. Nürnberg" />
            </div>
            <div>
              <Label htmlFor="maxAge" className="text-xs">Nicht älter als (Wochen, leer = kein Limit)</Label>
              <Input
                id="maxAge" type="number" min="1" value={maxAgeWeeks}
                onChange={(e) => setMaxAgeWeeks(e.target.value)}
                placeholder="5"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={excludeSenior}
                onChange={(e) => setExcludeSenior(e.target.checked)}
              />
              Senior/Lead/Head-Titel ausfiltern (die API selbst kennt keinen Erfahrungs-Filter)
            </label>
            <Button size="sm" onClick={handleSearch} disabled={searching} className="w-full">
              {searching ? "Suche…" : "Suchen"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Stelle einfügen</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Stellentext von LinkedIn/Stepstone hier einfügen…"
              rows={3}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)} placeholder="Titel (optional)" />
              <Input value={pasteCompany} onChange={(e) => setPasteCompany(e.target.value)} placeholder="Firma (optional)" />
              <Input value={pasteLocation} onChange={(e) => setPasteLocation(e.target.value)} placeholder="Ort (optional)" />
              <Input value={pasteUrl} onChange={(e) => setPasteUrl(e.target.value)} placeholder="URL (optional)" />
            </div>
            <Button size="sm" onClick={handlePaste} disabled={pasting} className="w-full">
              {pasting ? "Speichere…" : "Zum Stapel hinzufügen"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Stapel</h2>
          <span className="text-sm text-muted-foreground">{queue.length} offen</span>
        </div>

        {loadingQueue ? (
          <p className="text-sm text-muted-foreground">Lade…</p>
        ) : !current ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">
            Keine offenen Stellen. Suche oben starten oder eine Stelle einfügen.
          </CardContent></Card>
        ) : (
          <Card className="border-2">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">{current.title}</CardTitle>
                  <div className="text-sm text-muted-foreground mt-1">
                    {current.company || "Unbekannte Firma"}{current.location ? ` · ${current.location}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex gap-2 flex-wrap">
                    {formatAge(current.posted_at) && <span>{formatAge(current.posted_at)}</span>}
                    {current.starts_at && <span>· Eintritt: {current.starts_at}</span>}
                  </div>
                </div>
                <Badge variant="outline">{SOURCE_LABEL[current.source] || current.source}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {current.raw_text ? (
                <p className="text-sm whitespace-pre-wrap line-clamp-6 text-foreground/90">{current.raw_text}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Kein Volltext vorhanden — wird beim Übernehmen geladen{current.url ? " (oder öffne die Original-Stelle unten)." : "."}
                </p>
              )}
              {current.url && (
                <a href={current.url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">
                  Original-Stelle öffnen ↗
                </a>
              )}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" disabled={deciding} onClick={() => handlePass(current)}>
                  ✕ Verwerfen
                </Button>
                <Button className="flex-1" disabled={deciding} onClick={() => handleLike(current)}>
                  ✓ Bewerben
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">Pfeiltasten ← / → funktionieren auch.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
