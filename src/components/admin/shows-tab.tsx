"use client";

import { useEffect, useState } from "react";
import { Loader2, Tv } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { DAY_SHORT, ytThumb, type ShowItem } from "@/lib/types";
import { adminFetch } from "@/lib/client-auth";
import { DangerButton, EmptyRow, FieldLabel } from "@/components/admin/shared";

export default function ShowsTab() {
  const { toast } = useToast();
  const [shows, setShows] = useState<ShowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [startTime, setStartTime] = useState("06:00");
  const [endTime, setEndTime] = useState("09:00");
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  const load = async () => {
    try {
      const res = await fetch("/api/shows", { cache: "no-store" });
      const data = (await res.json()) as ShowItem[];
      setShows(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleDay = (d: number) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  const submit = async () => {
    if (!title.trim() || !youtubeUrl.trim()) {
      toast({ title: "Title te YouTube link dono bharo", variant: "destructive" });
      return;
    }
    if (days.length === 0) {
      toast({ title: "Ghatt vadde 1 din chuno", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await adminFetch("/api/shows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), youtubeUrl: youtubeUrl.trim(), startTime, endTime, days: days.map(String) }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error || "Save fail");
      }
      toast({ title: "📺 Show schedule ho gaya!", description: `${title} — ${startTime} se ${endTime}` });
      setTitle("");
      setDescription("");
      setYoutubeUrl("");
      load();
    } catch (e) {
      toast({ title: "Show add nahi hoya", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const res = await adminFetch(`/api/shows/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Show delete ho gaya" });
      load();
    } else {
      toast({ title: "Delete nahi hoya", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-400/20 bg-[color:var(--bg-card)] p-5">
        <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-amber-100">
          <Tv className="h-4.5 w-4.5 text-amber-400" /> Nava Show Schedule Karo
        </h3>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>Show da title</FieldLabel>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="jiven: Morning Jago Punjab" data-testid="show-title" />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>YouTube video link</FieldLabel>
              <Input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." inputMode="url" data-testid="show-youtube" />
            </div>
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Description (optional)</FieldLabel>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Show bare thoda likho..." />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>Shuru time (Punjab)</FieldLabel>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} data-testid="show-start" />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Khatam time (Punjab)</FieldLabel>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} data-testid="show-end" />
            </div>
          </div>
          <p className="text-[11px] text-amber-100/50">🕐 Show da time Punjab (India) de hisaab naal — duniya de sare listeners ohda hi ON AIR vekhnge</p>
          <div className="space-y-1.5">
            <FieldLabel>Consar (din)</FieldLabel>
            <div className="flex flex-wrap gap-2" data-testid="show-days">
              {DAY_SHORT.map((d, i) => (
                <label
                  key={d}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    days.includes(i)
                      ? "border-amber-400 bg-amber-400/20 text-amber-200"
                      : "border-amber-400/20 bg-black/25 text-amber-100/50"
                  }`}
                >
                  <Checkbox checked={days.includes(i)} onCheckedChange={() => toggleDay(i)} aria-label={d} />
                  {d}
                </label>
              ))}
            </div>
          </div>
          <Button
            onClick={submit}
            disabled={saving}
            data-testid="show-submit"
            className="border-0 bg-gradient-to-r from-amber-400 to-orange-500 font-bold text-black hover:from-amber-300 hover:to-orange-400"
          >
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Show schedule karo
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-400/20 bg-[color:var(--bg-card)] p-5">
        <h3 className="mb-3 text-base font-bold text-amber-100">Saare Shows ({shows.length})</h3>
        {loading ? (
          <EmptyRow text="Load ho raha hai..." />
        ) : shows.length === 0 ? (
          <EmptyRow text="Hale koi show nahi." />
        ) : (
          <div className="nice-scroll max-h-96 space-y-2 overflow-y-auto pr-1" data-testid="shows-admin-list">
            {shows.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl border border-amber-400/10 bg-black/25 px-3 py-2.5">
                {ytThumb(s.youtubeUrl) ? (
                   
                  <img src={ytThumb(s.youtubeUrl) || ""} alt="" className="h-10 w-16 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded-lg bg-amber-400/10">
                    <Tv className="h-4 w-4 text-amber-400/60" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-amber-50">{s.title}</p>
                  <p className="font-mono text-xs text-amber-100/50">
                    {s.startTime}–{s.endTime} • {s.days.split(",").map((d) => DAY_SHORT[Number(d)]).join(" ")}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 border-amber-400/30 font-mono text-[10px] text-amber-300">
                  {s.startTime}
                </Badge>
                <DangerButton onConfirm={() => remove(s.id)} label="Show delete" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
