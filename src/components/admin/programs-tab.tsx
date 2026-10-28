"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Loader2, Megaphone, Plus, Save, Trash2, Volume1 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { usePlayer } from "@/lib/store";
import { adminFetch } from "@/lib/client-auth";
import type { Song, StationSettings } from "@/lib/types";
import { fmtAmPm, parseAudioAds, parsePrograms, type AudioAd, type Program } from "@/lib/types";
import { FieldLabel } from "@/components/admin/shared";

function newId(prefix: string): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  }
}

export default function ProgramsTab() {
  const { toast } = useToast();
  const refreshContext = usePlayer((s) => s.refreshContext);

  const [songs, setSongs] = useState<Song[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [ads, setAds] = useState<AudioAd[]>([]);

  // nava program form
  const [pTitle, setPTitle] = useState("");
  const [pStart, setPStart] = useState("05:00");
  const [pEnd, setPEnd] = useState("06:00");
  const [pPick, setPPick] = useState<string[]>([]);
  const [pSaving, setPSaving] = useState(false);

  // kisse purane program de songs badlo (edit mode)
  const [editId, setEditId] = useState<string | null>(null);
  const [editPick, setEditPick] = useState<string[]>([]);

  // navi audio ad form
  const [aTitle, setATitle] = useState("");
  const [aTime, setATime] = useState("17:15");
  const [aUrl, setAUrl] = useState("");
  const [aSaving, setASaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json() as Promise<StationSettings>)
      .then((data) => {
        setPrograms(parsePrograms(data.programs));
        setAds(parseAudioAds(data.audioAds));
      })
      .catch(() => {});
    fetch("/api/songs", { cache: "no-store" })
      .then((r) => r.json() as Promise<Song[]>)
      .then((list) => setSongs(Array.isArray(list) ? list : []))
      .catch(() => {});
  }, []);

  /** PUT programs JSON + player context refresh */
  const savePrograms = async (next: Program[], okMsg: string) => {
    const res = await adminFetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ programs: JSON.stringify(next) }),
    });
    if (!res.ok) throw new Error("Save fail");
    setPrograms(next);
    await refreshContext();
    toast({ title: okMsg });
  };

  const saveAds = async (next: AudioAd[], okMsg: string) => {
    const res = await adminFetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioAds: JSON.stringify(next) }),
    });
    if (!res.ok) throw new Error("Save fail");
    setAds(next);
    await refreshContext();
    toast({ title: okMsg });
  };

  const addProgram = async () => {
    if (!pTitle.trim()) {
      toast({ title: "Program da naam likho", variant: "destructive" });
      return;
    }
    if (pPick.length === 0) {
      toast({ title: "Ohde songs chuno (1 ja vadh)", variant: "destructive" });
      return;
    }
    setPSaving(true);
    try {
      const prog: Program = {
        id: newId("prog"),
        title: pTitle.trim(),
        start: pStart || "05:00",
        end: pEnd || "06:00",
        days: "0,1,2,3,4,5,6",
        songIds: JSON.stringify(pPick),
        active: true,
      };
      await savePrograms([...programs, prog], `📻 "${prog.title}" jud gaya — ${fmtAmPm(prog.start)}–${fmtAmPm(prog.end)} te auto chalega!`);
      setPTitle("");
      setPStart("05:00");
      setPEnd("06:00");
      setPPick([]);
    } catch {
      toast({ title: "Add nahi hoya — dubara koshish karo", variant: "destructive" });
    } finally {
      setPSaving(false);
    }
  };

  const saveEditSongs = async (prog: Program) => {
    if (editPick.length === 0) {
      toast({ title: "Kalle 1 song vi chuno", variant: "destructive" });
      return;
    }
    try {
      const next = programs.map((p) => (p.id === prog.id ? { ...p, songIds: JSON.stringify(editPick) } : p));
      await savePrograms(next, "📻 Program de songs badal gaye!");
      setEditId(null);
      setEditPick([]);
    } catch {
      toast({ title: "Save nahi hoya", variant: "destructive" });
    }
  };

  const toggleProgram = async (prog: Program, active: boolean) => {
    try {
      await savePrograms(programs.map((p) => (p.id === prog.id ? { ...p, active } : p)), active ? "📻 Program ON" : "📻 Program OFF");
    } catch {
      toast({ title: "Nahi hoya", variant: "destructive" });
    }
  };

  const delProgram = async (prog: Program) => {
    try {
      await savePrograms(programs.filter((p) => p.id !== prog.id), "📻 Program kadh ditta");
    } catch {
      toast({ title: "Delete nahi hoya", variant: "destructive" });
    }
  };

  const addAd = async () => {
    if (!aTitle.trim() || !aUrl.trim()) {
      toast({ title: "Ad da naam te MP3 link dono pao", variant: "destructive" });
      return;
    }
    if (!/^https?:\/\//i.test(aUrl.trim())) {
      toast({ title: "Link https:// ton shuru hona chahida", description: "MP3 di link pao (jive jsDelivr ja onlaain koi MP3 link)", variant: "destructive" });
      return;
    }
    setASaving(true);
    try {
      const ad: AudioAd = {
        id: newId("ad"),
        title: aTitle.trim(),
        url: aUrl.trim(),
        time: aTime || "17:15",
        days: "0,1,2,3,4,5,6",
        active: true,
        duck: 12,
      };
      await saveAds([...ads, ad], `📢 "${ad.title}" jud gayi — roz ${fmtAmPm(ad.time)} te song awaaj low karke bajegi!`);
      setATitle("");
      setATime("17:15");
      setAUrl("");
    } catch {
      toast({ title: "Add nahi hoya — dubara koshish karo", variant: "destructive" });
    } finally {
      setASaving(false);
    }
  };

  const toggleAd = async (ad: AudioAd, active: boolean) => {
    try {
      await saveAds(ads.map((a) => (a.id === ad.id ? { ...a, active } : a)), active ? "📢 Ad ON" : "📢 Ad OFF");
    } catch {
      toast({ title: "Nahi hoya", variant: "destructive" });
    }
  };

  const delAd = async (ad: AudioAd) => {
    try {
      await saveAds(ads.filter((a) => a.id !== ad.id), "📢 Ad kadh ditti");
    } catch {
      toast({ title: "Delete nahi hoya", variant: "destructive" });
    }
  };

  const songCount = (prog: Program) => {
    try {
      const ids = JSON.parse(prog.songIds || "[]") as string[];
      return Array.isArray(ids) ? ids.length : 0;
    } catch {
      return 0;
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Programs — auto-play time-table ── */}
      <div className="rounded-2xl border border-amber-400/20 bg-[color:var(--bg-card)] p-5" data-testid="programs-manager">
        <h3 className="mb-1 flex items-center gap-2 text-base font-bold text-amber-100">
          <CalendarClock className="h-4.5 w-4.5 text-amber-400" /> 📻 Programs (Auto Time-Table)
        </h3>
        <p className="mb-3 text-xs text-amber-100/60">
          Program banao — <b className="text-amber-300">naam + time + songs chuno</b>. Ohde time te (Punjab time) player khud ohde songs chaluga,
          program mukke te wapis apne sab songs. Jiven: <i>&quot;Old Songs 5–6&quot;</i>, <i>&quot;Podcast 6–7&quot;</i>, <i>&quot;Gurbani Katha 7–8&quot;</i>.
          Podcast/old songs vi song vangar hi upload kar sakde ho (singer = Podcast), fer program ch chuno.
        </p>

        {programs.length > 0 && (
          <div className="nice-scroll mb-4 space-y-2">
            {programs.map((prog) => (
              <div key={prog.id} className="rounded-xl border border-amber-400/10 bg-black/25 px-3 py-2.5" data-testid={`program-row`}>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-amber-50">
                      📻 {prog.title} {!prog.active && <span className="text-xs font-normal text-amber-100/40">(band hai)</span>}
                    </p>
                    <p className="truncate text-xs text-amber-100/50">
                      ⏰ {fmtAmPm(prog.start)} – {fmtAmPm(prog.end)} Punjab • 🎵 {songCount(prog)} songs
                    </p>
                  </div>
                  <Switch
                    checked={prog.active}
                    onCheckedChange={(v) => toggleProgram(prog, v)}
                    aria-label={`${prog.title} ON/OFF`}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-amber-400/30 text-xs text-amber-200"
                    onClick={() => {
                      setEditId(editId === prog.id ? null : prog.id);
                      try {
                        setEditPick(JSON.parse(prog.songIds || "[]") as string[]);
                      } catch {
                        setEditPick([]);
                      }
                    }}
                  >
                    {editId === prog.id ? "Band karo" : "Songs badlo"}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`${prog.title} kado`}
                    onClick={() => delProgram(prog)}
                    className="h-8 w-8 shrink-0 text-red-300 hover:bg-red-400/15"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {editId === prog.id && (
                  <div className="mt-2 border-t border-amber-400/15 pt-2">
                    <div className="mb-2 flex gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs text-amber-200" onClick={() => setEditPick(songs.map((s) => s.id))}>
                        Sab chuno
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs text-amber-200" onClick={() => setEditPick([])}>
                        Saaf karo
                      </Button>
                    </div>
                    <div className="nice-scroll max-h-48 space-y-1 overflow-y-auto rounded-lg border border-amber-400/15 bg-black/30 p-2">
                      {songs.map((s) => (
                        <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-amber-100/80 hover:bg-amber-400/5">
                          <input
                            type="checkbox"
                            checked={editPick.includes(s.id)}
                            onChange={(e) => setEditPick((cur) => (e.target.checked ? [...cur, s.id] : cur.filter((x) => x !== s.id)))}
                            className="accent-amber-400"
                          />
                          <span className="truncate">🎵 {s.title} {s.artist ? `— ${s.artist}` : ""}</span>
                        </label>
                      ))}
                    </div>
                    <Button size="sm" onClick={() => saveEditSongs(prog)} className="mt-2 border-0 bg-gradient-to-r from-amber-400 to-orange-500 text-xs font-bold text-black">
                      <Save className="mr-1 h-3.5 w-3.5" /> Songs save karo
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 border-t border-amber-400/15 pt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-300/80">Nava program banao</p>
          <div className="grid gap-2 sm:grid-cols-[1.4fr_0.8fr_0.8fr]">
            <Input value={pTitle} onChange={(e) => setPTitle(e.target.value)} placeholder="Program da naam (jiven: Savere Old Songs)" data-testid="program-title" />
            <div>
              <FieldLabel>Shuru (Punjab)</FieldLabel>
              <input
                type="time"
                value={pStart}
                onChange={(e) => setPStart(e.target.value)}
                className="w-full rounded-lg border border-amber-400/30 bg-black/40 px-2 py-2 text-sm text-amber-50 [color-scheme:dark]"
                aria-label="Program shuru time"
              />
            </div>
            <div>
              <FieldLabel>Khatam (Punjab)</FieldLabel>
              <input
                type="time"
                value={pEnd}
                onChange={(e) => setPEnd(e.target.value)}
                className="w-full rounded-lg border border-amber-400/30 bg-black/40 px-2 py-2 text-sm text-amber-50 [color-scheme:dark]"
                aria-label="Program akhri time"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="h-8 text-xs text-amber-200" onClick={() => setPPick(songs.map((s) => s.id))}>
              Sab songs chuno
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs text-amber-200" onClick={() => setPPick([])}>
              Saaf karo
            </Button>
            <span className="flex items-center text-xs text-amber-100/50">{pPick.length} songs chune ne</span>
          </div>

          <div className="nice-scroll max-h-48 space-y-1 overflow-y-auto rounded-lg border border-amber-400/15 bg-black/30 p-2">
            {songs.length === 0 && <p className="p-2 text-xs text-amber-100/50">Songs load ho rahe ne...</p>}
            {songs.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-amber-100/80 hover:bg-amber-400/5">
                <input
                  type="checkbox"
                  checked={pPick.includes(s.id)}
                  onChange={(e) => setPPick((cur) => (e.target.checked ? [...cur, s.id] : cur.filter((x) => x !== s.id)))}
                  className="accent-amber-400"
                />
                <span className="truncate">🎵 {s.title} {s.artist ? `— ${s.artist}` : ""}</span>
              </label>
            ))}
          </div>

          <Button onClick={addProgram} disabled={pSaving} data-testid="program-add" className="border-0 bg-gradient-to-r from-amber-400 to-orange-500 font-bold text-black">
            {pSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
            Program add karo
          </Button>
        </div>
      </div>

      {/* ── Audio Ads — auto break with ducking ── */}
      <div className="rounded-2xl border border-purple-400/25 bg-[color:var(--bg-card)] p-5" data-testid="audio-ads-manager">
        <h3 className="mb-1 flex items-center gap-2 text-base font-bold text-amber-100">
          <Megaphone className="h-4.5 w-4.5 text-purple-400" /> 📢 Audio Ads (Awaaj Down Karke)
        </h3>
        <p className="mb-3 text-xs text-amber-100/60">
          Ad da <b className="text-amber-300">naam + time + MP3 link</b> pao. Us time te (Punjab time) <b className="text-amber-300">song di awaaj apne aap down</b> ho jaugegi,
          ad chalegi — ad jitni der di hai ohni der baad <b className="text-amber-300">song di awaaj wapis normal</b>. Jiven 5:15 te 20 sec di ad — 5:15:00 song halka, ad bajegi, 20 sec baad sab normal. Roz chalegi (din ch ek vaar).
        </p>

        {ads.length > 0 && (
          <div className="nice-scroll mb-4 space-y-2">
            {ads.map((ad) => (
              <div key={ad.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-purple-400/10 bg-black/25 px-3 py-2.5">
                <Volume1 className="h-4 w-4 shrink-0 text-purple-300" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-amber-50">
                    📢 {ad.title} {!ad.active && <span className="text-xs font-normal text-amber-100/40">(band hai)</span>}
                  </p>
                  <p className="truncate text-xs text-amber-100/50">⏰ roz {fmtAmPm(ad.time)} Punjab • {ad.url}</p>
                </div>
                <Switch checked={ad.active} onCheckedChange={(v) => toggleAd(ad, v)} aria-label={`${ad.title} ON/OFF`} />
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`${ad.title} kado`}
                  onClick={() => delAd(ad)}
                  className="h-8 w-8 shrink-0 text-red-300 hover:bg-red-400/15"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 border-t border-purple-400/15 pt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-purple-300/80">Navi ad lagao</p>
          <div className="grid gap-2 sm:grid-cols-[1.2fr_0.6fr]">
            <div>
              <FieldLabel>Ad da naam</FieldLabel>
              <Input value={aTitle} onChange={(e) => setATitle(e.target.value)} placeholder="jiven: Dukaan da Ad" data-testid="audio-ad-title" />
            </div>
            <div>
              <FieldLabel>Time (Punjab)</FieldLabel>
              <input
                type="time"
                value={aTime}
                onChange={(e) => setATime(e.target.value)}
                className="w-full rounded-lg border border-amber-400/30 bg-black/40 px-2 py-2 text-sm text-amber-50 [color-scheme:dark]"
                aria-label="Ad da time"
              />
            </div>
          </div>
          <div>
            <FieldLabel>MP3 link (https://...)</FieldLabel>
            <Input value={aUrl} onChange={(e) => setAUrl(e.target.value)} placeholder="https://cdn.jsdelivr.net/gh/.../ad.mp3" inputMode="url" data-testid="audio-ad-url" />
            <p className="mt-1 text-xs text-amber-100/50">MP3 file hove ta menu bhejo — main link bana devanga; ja apna koi vi onlaain MP3 link ethe pao.</p>
          </div>
          <Button onClick={addAd} disabled={aSaving} data-testid="audio-ad-add" className="border-0 bg-gradient-to-r from-purple-500 to-fuchsia-500 font-bold text-white">
            {aSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
            Ad add karo
          </Button>
        </div>
      </div>

      {programs.length === 0 && ads.length === 0 && (
        <Badge variant="outline" className="border-amber-400/30 text-[10px] uppercase text-amber-300/70">
          Hun koi program ja ad nahi — radio 24x7 apne sab songs chal rahi hai
        </Badge>
      )}
    </div>
  );
}
