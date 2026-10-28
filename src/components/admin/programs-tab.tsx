"use client";

import { useEffect, useState } from "react";
import { CalendarClock, ListMusic, Loader2, Megaphone, Plus, Save, Trash2, Volume1 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { usePlayer } from "@/lib/store";
import { adminFetch } from "@/lib/client-auth";
import type { Song, StationSettings } from "@/lib/types";
import { fmtAmPm, parseAudioAds, parsePlaylists, parsePrograms, type AudioAd, type Playlist, type Program } from "@/lib/types";
import { FieldLabel } from "@/components/admin/shared";

function newId(prefix: string): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  }
}

/** Songs chunno + ORDER set karo (checkbox = jodo, ▲▼ = order badlo, ✕ = kado) */
function SongPicker({
  songs,
  pick,
  setPick,
}: {
  songs: Song[];
  pick: string[];
  setPick: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const toggle = (id: string, on: boolean) => setPick((cur) => (on ? [...cur, id] : cur.filter((x) => x !== id)));
  const move = (i: number, dir: -1 | 1) =>
    setPick((cur) => {
      const j = i + dir;
      if (j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const find = (id: string) => songs.find((s) => s.id === id);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="h-7 text-xs text-amber-200" onClick={() => setPick((cur) => (cur.length > 0 ? cur : songs.map((s) => s.id)))}>
          Sab chuno
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs text-amber-200" onClick={() => setPick([])}>
          Saaf karo
        </Button>
        <span className="flex items-center text-xs text-amber-100/50">{pick.length} songs — ohde ORDER ch chalange (1, 2, 3...)</span>
      </div>
      {pick.length > 0 && (
        <div className="nice-scroll max-h-40 space-y-1 overflow-y-auto rounded-lg border border-amber-400/25 bg-black/30 p-2">
          {pick.map((id, i) => {
            const s = find(id);
            return (
              <div key={`${id}-${i}`} className="flex items-center gap-1.5 rounded px-1.5 py-1 text-xs text-amber-100/80">
                <span className="w-6 shrink-0 text-center font-mono font-bold text-amber-300">{i + 1}.</span>
                <span className="min-w-0 flex-1 truncate">
                  🎵 {s ? s.title : "(song nahi millya)"}
                  {s?.artist ? ` — ${s.artist}` : ""}
                </span>
                <button
                  type="button"
                  aria-label="Upar karo"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="px-1 text-amber-200/70 hover:text-amber-100 disabled:opacity-25"
                >
                  ▲
                </button>
                <button
                  type="button"
                  aria-label="Thale karo"
                  onClick={() => move(i, 1)}
                  disabled={i === pick.length - 1}
                  className="px-1 text-amber-200/70 hover:text-amber-100 disabled:opacity-25"
                >
                  ▼
                </button>
                <button type="button" aria-label="List ton kado" onClick={() => toggle(id, false)} className="px-1 text-red-300 hover:text-red-200">
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="nice-scroll max-h-44 space-y-1 overflow-y-auto rounded-lg border border-amber-400/15 bg-black/30 p-2">
        {songs.length === 0 && <p className="p-2 text-xs text-amber-100/50">Songs load ho rahe ne...</p>}
        {songs.map((s) => (
          <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-amber-100/80 hover:bg-amber-400/5">
            <input type="checkbox" checked={pick.includes(s.id)} onChange={(e) => toggle(s.id, e.target.checked)} className="accent-amber-400" />
            <span className="truncate">
              🎵 {s.title}
              {s.artist ? ` — ${s.artist}` : ""}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function ProgramsTab() {
  const { toast } = useToast();
  const refreshContext = usePlayer((s) => s.refreshContext);

  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [ads, setAds] = useState<AudioAd[]>([]);

  // navi playlist form
  const [plTitle, setPlTitle] = useState("");
  const [plPick, setPlPick] = useState<string[]>([]);
  const [plSaving, setPlSaving] = useState(false);
  // playlist edit (naam + order badlo)
  const [openPlId, setOpenPlId] = useState<string | null>(null);
  const [editPlTitle, setEditPlTitle] = useState("");
  const [editPlPick, setEditPlPick] = useState<string[]>([]);

  // nava program form
  const [prTitle, setPrTitle] = useState("");
  const [prPl, setPrPl] = useState("");
  const [prStart, setPrStart] = useState("05:00");
  const [prEnd, setPrEnd] = useState("06:00");
  const [prSaving, setPrSaving] = useState(false);

  // navi audio ad form
  const [aTitle, setATitle] = useState("");
  const [aTime, setATime] = useState("17:15");
  const [aUrl, setAUrl] = useState("");
  const [aSaving, setASaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json() as Promise<StationSettings>)
      .then((data) => {
        setPlaylists(parsePlaylists(data.playlists));
        setPrograms(parsePrograms(data.programs));
        setAds(parseAudioAds(data.audioAds));
      })
      .catch(() => {});
    fetch("/api/songs", { cache: "no-store" })
      .then((r) => r.json() as Promise<Song[]>)
      .then((list) => setSongs(Array.isArray(list) ? list : []))
      .catch(() => {});
  }, []);

  const putSetting = async (key: string, value: string) => {
    const res = await adminFetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    if (!res.ok) throw new Error("Save fail");
    await refreshContext();
  };

  const savePlaylists = async (next: Playlist[], okMsg: string) => {
    await putSetting("playlists", JSON.stringify(next));
    setPlaylists(next);
    toast({ title: okMsg });
  };

  const savePrograms = async (next: Program[], okMsg: string) => {
    await putSetting("programs", JSON.stringify(next));
    setPrograms(next);
    toast({ title: okMsg });
  };

  const saveAds = async (next: AudioAd[], okMsg: string) => {
    await putSetting("audioAds", JSON.stringify(next));
    setAds(next);
    toast({ title: okMsg });
  };

  // ── playlists ──
  const addPlaylist = async () => {
    if (!plTitle.trim()) {
      toast({ title: "Playlist da naam likho", variant: "destructive" });
      return;
    }
    if (plPick.length === 0) {
      toast({ title: "Kalle 1 song vi chuno", variant: "destructive" });
      return;
    }
    setPlSaving(true);
    try {
      const pl: Playlist = { id: newId("pl"), title: plTitle.trim(), songIds: plPick };
      await savePlaylists([...playlists, pl], `📃 "${pl.title}" playlist ban gayi — ${pl.songIds.length} songs (order vich)!`);
      setPlTitle("");
      setPlPick([]);
    } catch {
      toast({ title: "Add nahi hoya — dubara koshish karo", variant: "destructive" });
    } finally {
      setPlSaving(false);
    }
  };

  const openEditPlaylist = (pl: Playlist) => {
    if (openPlId === pl.id) {
      setOpenPlId(null);
      return;
    }
    setOpenPlId(pl.id);
    setEditPlTitle(pl.title);
    setEditPlPick([...pl.songIds]);
  };

  const saveEditPlaylist = async (pl: Playlist) => {
    if (!editPlTitle.trim() || editPlPick.length === 0) {
      toast({ title: "Naam te kalle 1 song vi chahide", variant: "destructive" });
      return;
    }
    try {
      const next = playlists.map((p) => (p.id === pl.id ? { ...p, title: editPlTitle.trim(), songIds: editPlPick } : p));
      await savePlaylists(next, "📃 Playlist badal gayi!");
      setOpenPlId(null);
    } catch {
      toast({ title: "Save nahi hoya", variant: "destructive" });
    }
  };

  const delPlaylist = async (pl: Playlist) => {
    try {
      await savePlaylists(
        playlists.filter((p) => p.id !== pl.id),
        "📃 Playlist kadh ditti (program jehda ohdi varatda si — oh hun sab songs chalauga)"
      );
    } catch {
      toast({ title: "Delete nahi hoya", variant: "destructive" });
    }
  };

  // ── programs ──
  const plName = (prog: Program) => {
    if (prog.playlistId) {
      const pl = playlists.find((p) => p.id === prog.playlistId);
      return pl ? pl.title : "(playlist kadh ditti — navi chuno)";
    }
    return "(purane embedded songs)";
  };

  const addProgram = async () => {
    if (!prTitle.trim()) {
      toast({ title: "Program da naam likho", variant: "destructive" });
      return;
    }
    if (!prPl) {
      toast({ title: "Playlist chuno", variant: "destructive" });
      return;
    }
    setPrSaving(true);
    try {
      const prog: Program = {
        id: newId("prog"),
        title: prTitle.trim(),
        playlistId: prPl,
        start: prStart || "05:00",
        end: prEnd || "06:00",
        days: "0,1,2,3,4,5,6",
        songIds: "[]",
        active: true,
      };
      await savePrograms([...programs, prog], `📻 "${prog.title}" jud gaya — ${fmtAmPm(prog.start)}–${fmtAmPm(prog.end)} te auto chalega!`);
      setPrTitle("");
      setPrPl("");
      setPrStart("05:00");
      setPrEnd("06:00");
    } catch {
      toast({ title: "Add nahi hoya — dubara koshish karo", variant: "destructive" });
    } finally {
      setPrSaving(false);
    }
  };

  const toggleProgram = async (prog: Program, active: boolean) => {
    try {
      await savePrograms(programs.map((p) => (p.id === prog.id ? { ...p, active } : p)), active ? "📻 Program ON" : "📻 Program OFF");
    } catch {
      toast({ title: "Nahi hoya", variant: "destructive" });
    }
  };

  const changeProgPlaylist = async (prog: Program, playlistId: string) => {
    try {
      await savePrograms(programs.map((p) => (p.id === prog.id ? { ...p, playlistId: playlistId || undefined } : p)), "📻 Program di playlist badal gayi!");
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

  // ── audio ads ──
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

  return (
    <div className="space-y-6">
      {/* ── Playlists — ordered lists ── */}
      <div className="rounded-2xl border border-amber-400/20 bg-[color:var(--bg-card)] p-5" data-testid="playlists-manager">
        <h3 className="mb-1 flex items-center gap-2 text-base font-bold text-amber-100">
          <ListMusic className="h-4.5 w-4.5 text-amber-400" /> 📃 Playlists (Ginte naal order)
        </h3>
        <p className="mb-3 text-xs text-amber-100/60">
          Jinni marzi playlists banao — <b className="text-amber-300">naam pao te songs chuno</b> (song, podcast, gurbani vichar — kuj vi jo songs vich upload hoya).
          Jithe number ohda order — <b className="text-amber-300">1, 2, 3... radio vangu ohde hisaab nal chalange</b>. ▲▼ naal order badlo.
        </p>

        {playlists.length > 0 && (
          <div className="nice-scroll mb-4 space-y-2">
            {playlists.map((pl) => (
              <div key={pl.id} className="rounded-xl border border-amber-400/10 bg-black/25 px-3 py-2.5" data-testid="playlist-row">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-amber-50">📃 {pl.title}</p>
                    <p className="truncate text-xs text-amber-100/50">🎵 {pl.songIds.length} songs (order vich)</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-amber-400/30 text-xs text-amber-200"
                    onClick={() => openEditPlaylist(pl)}
                  >
                    {openPlId === pl.id ? "Band karo" : "Naam/Order badlo"}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`${pl.title} kado`}
                    onClick={() => delPlaylist(pl)}
                    className="h-8 w-8 shrink-0 text-red-300 hover:bg-red-400/15"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {openPlId === pl.id && (
                  <div className="mt-2 space-y-2 border-t border-amber-400/15 pt-2">
                    <Input value={editPlTitle} onChange={(e) => setEditPlTitle(e.target.value)} placeholder="Playlist da naam" aria-label="Playlist da naam" />
                    <SongPicker songs={songs} pick={editPlPick} setPick={setEditPlPick} />
                    <Button size="sm" onClick={() => saveEditPlaylist(pl)} className="border-0 bg-gradient-to-r from-amber-400 to-orange-500 text-xs font-bold text-black">
                      <Save className="mr-1 h-3.5 w-3.5" /> Playlist save karo
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 border-t border-amber-400/15 pt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-300/80">Navi playlist banao</p>
          <Input value={plTitle} onChange={(e) => setPlTitle(e.target.value)} placeholder="Playlist da naam (jiven: Savere Old Songs)" data-testid="playlist-title" />
          <SongPicker songs={songs} pick={plPick} setPick={setPlPick} />
          <Button onClick={addPlaylist} disabled={plSaving} data-testid="playlist-add" className="border-0 bg-gradient-to-r from-amber-400 to-orange-500 font-bold text-black">
            {plSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
            Playlist banao
          </Button>
        </div>
      </div>

      {/* ── Programs — playlist + time window ── */}
      <div className="rounded-2xl border border-amber-400/20 bg-[color:var(--bg-card)] p-5" data-testid="programs-manager">
        <h3 className="mb-1 flex items-center gap-2 text-base font-bold text-amber-100">
          <CalendarClock className="h-4.5 w-4.5 text-amber-400" /> 📻 Programs (Playlist da Time-Table)
        </h3>
        <p className="mb-3 text-xs text-amber-100/60">
          Program banao — <b className="text-amber-300">naam + playlist + time</b>. Us time te (Punjab time) player khud us playlist de songs
          <b className="text-amber-300"> ginte naal</b> chaluga. <b className="text-amber-300">Refresh te vi ohvi song bajega jo us vele chal rya hovega</b> — list shuru ton kabbo nahi (sachchi radio vangu).
        </p>

        {programs.length > 0 && (
          <div className="nice-scroll mb-4 space-y-2">
            {programs.map((prog) => (
              <div key={prog.id} className="rounded-xl border border-amber-400/10 bg-black/25 px-3 py-2.5" data-testid="program-row">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-amber-50">
                      📻 {prog.title} {!prog.active && <span className="text-xs font-normal text-amber-100/40">(band hai)</span>}
                    </p>
                    <p className="truncate text-xs text-amber-100/50">
                      ⏰ {fmtAmPm(prog.start)} – {fmtAmPm(prog.end)} Punjab • 📃 {plName(prog)}
                    </p>
                  </div>
                  <Switch checked={prog.active} onCheckedChange={(v) => toggleProgram(prog, v)} aria-label={`${prog.title} ON/OFF`} />
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
                <div className="mt-2 flex items-center gap-2 border-t border-amber-400/15 pt-2">
                  <span className="text-xs text-amber-100/50">Playlist badlo:</span>
                  <select
                    value={prog.playlistId || ""}
                    onChange={(e) => changeProgPlaylist(prog, e.target.value)}
                    aria-label={`${prog.title} di playlist`}
                    className="max-w-[220px] flex-1 rounded-lg border border-amber-400/30 bg-black/40 px-2 py-1.5 text-xs text-amber-50 [color-scheme:dark]"
                  >
                    <option value="">— Playlist chuno —</option>
                    {playlists.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 border-t border-amber-400/15 pt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-300/80">Nava program banao</p>
          <div className="grid gap-2 sm:grid-cols-[1.2fr_1fr_0.7fr_0.7fr]">
            <div>
              <FieldLabel>Naam</FieldLabel>
              <Input value={prTitle} onChange={(e) => setPrTitle(e.target.value)} placeholder="jiven: Savere Old Songs" data-testid="program-title" />
            </div>
            <div>
              <FieldLabel>Playlist</FieldLabel>
              <select
                value={prPl}
                onChange={(e) => setPrPl(e.target.value)}
                aria-label="Program di playlist"
                className="w-full rounded-lg border border-amber-400/30 bg-black/40 px-2 py-2 text-sm text-amber-50 [color-scheme:dark]"
              >
                <option value="">— Chuno —</option>
                {playlists.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Shuru (Punjab)</FieldLabel>
              <input
                type="time"
                value={prStart}
                onChange={(e) => setPrStart(e.target.value)}
                className="w-full rounded-lg border border-amber-400/30 bg-black/40 px-2 py-2 text-sm text-amber-50 [color-scheme:dark]"
                aria-label="Program shuru time"
              />
            </div>
            <div>
              <FieldLabel>Khatam (Punjab)</FieldLabel>
              <input
                type="time"
                value={prEnd}
                onChange={(e) => setPrEnd(e.target.value)}
                className="w-full rounded-lg border border-amber-400/30 bg-black/40 px-2 py-2 text-sm text-amber-50 [color-scheme:dark]"
                aria-label="Program akhri time"
              />
            </div>
          </div>
          <Button onClick={addProgram} disabled={prSaving} data-testid="program-add" className="border-0 bg-gradient-to-r from-amber-400 to-orange-500 font-bold text-black">
            {prSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
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
          ad chalegi — ad jitni der di hai ohni der baad <b className="text-amber-300">song di awaaj wapis normal</b>. Roz chalegi (din ch ek vaar).
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

      {playlists.length === 0 && programs.length === 0 && ads.length === 0 && (
        <Badge variant="outline" className="border-amber-400/30 text-[10px] uppercase text-amber-300/70">
          Hun koi playlist/program/ad nahi — radio 24x7 apne sab songs chal rahi hai
        </Badge>
      )}
    </div>
  );
}
