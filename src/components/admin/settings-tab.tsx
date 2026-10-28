"use client";

import { useEffect, useState } from "react";
import { ImagePlus, KeyRound, Loader2, Palette, Plus, Radio, Save, Square, Trash2, Wifi, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { usePlayer } from "@/lib/store";
import { adminFetch } from "@/lib/client-auth";
import { fileToDataUrl } from "@/lib/image-client";
import type { StationSettings } from "@/lib/types";
import {
  fmtAmPm,
  inGurbaniWindow,
  parseGurbaniSchedule,
  parsePlayerStyle,
  parseTickerStyle,
  parseStreamLibrary,
  parseTheme,
  THEME_PRESETS,
  ytId,
  ytThumb,
  type GurbaniSchedule,
  type PlayerStyle,
  type StreamEntry,
  type TickerStyle,
} from "@/lib/types";
import { FieldLabel, FilePick } from "@/components/admin/shared";

/** Built-in preset — hamesha library ch dikhega (jadon tak khud add nahi kitta) */
const SGPC_PRESET: StreamEntry = {
  name: "SGPC Darbar Sahib Live (128kbps)",
  url: "https://live.sgpc.net:8443/;",
};

export default function SettingsTab() {
  const { toast } = useToast();
  const refreshContext = usePlayer((s) => s.refreshContext);
  const [settings, setSettings] = useState<StationSettings>({
    stationName: "",
    tagline: "",
    liveMode: "auto",
    liveUrl: "",
    liveTitle: "",
    liveImage: "",
    streamLibrary: "",
  });
  const [saving, setSaving] = useState(false);

  // gurbani library form
  const [libName, setLibName] = useState("");
  const [libUrl, setLibUrl] = useState("");
  const [libSaving, setLibSaving] = useState(false);

  // live photo upload
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [imgUploading, setImgUploading] = useState(false);

  // singer photos (stamp-size artist image shown with now-playing)
  const [singerName, setSingerName] = useState("");
  const [singerUrl, setSingerUrl] = useState("");
  const [singerUploading, setSingerUploading] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  // Gurbani auto time-table + ticker colors (local editable copies)
  const [sched, setSched] = useState<GurbaniSchedule>({ enabled: false, windows: [] });
  const [tStyle, setTStyle] = useState<TickerStyle>(() => parseTickerStyle(""));

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: StationSettings) => {
        setSettings((s) => ({ ...s, ...data }));
        setSched(parseGurbaniSchedule(data.gurbaniSchedule));
        setTStyle(parseTickerStyle(data.tickerStyle));
      })
      .catch(() => {});
  }, []);

  /** PATCH-karo style save: sirf eh keys bhejde aan, local state + player refresh */
  const putSettings = async (patch: Partial<StationSettings>, okMsg: string) => {
    const res = await adminFetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error("Save fail");
    setSettings((s) => ({ ...s, ...patch }));
    await refreshContext();
    toast({ title: okMsg });
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await adminFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Save fail");
      await refreshContext();
      toast({ title: "⚙️ Settings save ho gayian!", description: "Radio hun navi settings naal chalegi" });
    } catch {
      toast({ title: "Save nahi hoyian", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── gurbani library helpers ──
  const library: StreamEntry[] = parseStreamLibrary(settings.streamLibrary);
  const shownLib: StreamEntry[] = library.length > 0 ? library : [SGPC_PRESET];

  const streamOn = async (entry: StreamEntry) => {
    try {
      await putSettings(
        { liveMode: "stream", liveUrl: entry.url, liveTitle: settings.liveTitle || entry.name },
        `🔴 ${entry.name} ON ho gayi!`
      );
    } catch {
      toast({ title: "ON nahi hoya — dubara koshish karo", variant: "destructive" });
    }
  };

  const streamOff = async () => {
    try {
      await putSettings({ liveMode: "auto" }, "🎵 Live BAND — hun songs auto-pilot chalnge");
    } catch {
      toast({ title: "BAND nahi hoya — dubara koshish karo", variant: "destructive" });
    }
  };

  const addStream = async () => {
    if (!libUrl.trim()) {
      toast({ title: "Stream da URL pao", variant: "destructive" });
      return;
    }
    const base = library.length > 0 ? library : [SGPC_PRESET];
    const next = [...base.filter((e) => e.url !== libUrl.trim()), { name: libName.trim() || "Live Stream", url: libUrl.trim() }];
    setLibSaving(true);
    try {
      await putSettings({ streamLibrary: JSON.stringify(next) }, "📺 Library ch add ho gaya!");
      setLibName("");
      setLibUrl("");
    } catch {
      toast({ title: "Add nahi hoya", variant: "destructive" });
    } finally {
      setLibSaving(false);
    }
  };

  const delStream = async (url: string) => {
    const next = library.filter((e) => e.url !== url);
    try {
      await putSettings({ streamLibrary: JSON.stringify(next) }, "Library ton kadh gaya");
    } catch {
      toast({ title: "Delete nahi hoya", variant: "destructive" });
    }
  };

  // ── live photo upload — browser ch resize hoke data URL, te FORAN save ho jandi hai
  //    (alag 'Save karo' di lor nahi — singer photo warga galti-proof, Vercel-safe) ──
  const uploadLiveImg = async (f: File) => {
    setImgFile(f);
    setImgUploading(true);
    try {
      const dataUrl = await fileToDataUrl(f, 1024, 0.82);
      await putSettings({ liveImage: dataUrl }, "🖼️ Darbar Sahib di photo jud gayi — live player ch dikh rahi hai!");
    } catch (e) {
      toast({ title: "Photo upload nahi hoi", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setImgUploading(false);
    }
  };

  // ── singer photos ──
  const singers: Record<string, string> = (() => {
    try {
      const v = JSON.parse(settings.artistImages || "{}") as unknown;
      return v && typeof v === "object" ? (v as Record<string, string>) : {};
    } catch {
      return {};
    }
  })();

  // ── singer photo — browser ch resize hoke data URL (server upload di lor nahi —
  //    eh Vercel te vi 100% chaluga, Blob token di kami vi nahi) ──
  const uploadSingerImg = async (f: File) => {
    setSingerUploading(true);
    try {
      const dataUrl = await fileToDataUrl(f, 512, 0.85);
      setSingerUrl(dataUrl);
      toast({ title: "🖼️ Photo jud gayi!", description: "Hun singer da naam likh ke 'Add karo' dabao" });
    } catch (e) {
      toast({ title: "Photo upload nahi hoi", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSingerUploading(false);
    }
  };

  const addSinger = async () => {
    if (!singerName.trim() || !singerUrl) {
      toast({ title: "Singer da naam te photo dono chahide", variant: "destructive" });
      return;
    }
    const next = { ...singers, [singerName.trim()]: singerUrl };
    try {
      await putSettings({ artistImages: JSON.stringify(next) }, `🧑‍🎤 ${singerName.trim()} di photo jud gayi!`);
      setSingerName("");
      setSingerUrl("");
    } catch {
      toast({ title: "Add nahi hoya", variant: "destructive" });
    }
  };

  const delSinger = async (name: string) => {
    const next = { ...singers };
    delete next[name];
    try {
      await putSettings({ artistImages: JSON.stringify(next) }, "Singer di photo kad ditte");
    } catch {
      toast({ title: "Delete nahi hoya", variant: "destructive" });
    }
  };

  // ── play/pause button style (image/circle + colors) ──
  const pStyle: PlayerStyle = parsePlayerStyle(settings.playerStyle);
  const savePlayerStyle = async (patch: Partial<PlayerStyle>) => {
    const next = { ...pStyle, ...patch };
    try {
      await putSettings({ playerStyle: JSON.stringify(next) }, "🎨 Button di setting save ho gayi!");
    } catch {
      toast({ title: "Save nahi hoya", variant: "destructive" });
    }
  };

  // ── Gurbani auto time-table (jadon window hove ta live auto ON) ──
  const saveSched = async (next: GurbaniSchedule) => {
    setSched(next);
    try {
      await putSettings({ gurbaniSchedule: JSON.stringify(next) }, "⏰ Gurbani Time-Table save ho gayi!");
    } catch {
      toast({ title: "Save nahi hoya", variant: "destructive" });
    }
  };

  // ── Breaking News ticker de rang ──
  const saveTStyle = async (next: TickerStyle) => {
    setTStyle(next);
    try {
      await putSettings({ tickerStyle: JSON.stringify(next) }, "🟡 Ticker de rang save ho gaye!");
    } catch {
      toast({ title: "Save nahi hoya", variant: "destructive" });
    }
  };

  const TICKER_DEFAULT: TickerStyle = { bg: "#facc15", text: "#18181b", labelBg: "#09090b", labelText: "#ffffff" };

  // ── Site theme (professional color presets) ──
  const saveTheme = async (key: string) => {
    try {
      await putSettings(
        { theme: key },
        key === "sunrise" ? "🌅 Sunrise Gold theme lag gaya!" : "🎨 Nava theme lag gaya — poori site da rang badal gaya!"
      );
    } catch {
      toast({ title: "Theme nahi badla", variant: "destructive" });
    }
  };

  // ── ON AIR video (YouTube) ──
  const saveOnAirVideo = async () => {
    const url = (settings.onAirVideo || "").trim();
    if (url && !ytId(url)) {
      toast({ title: "Eh YouTube link nahi lagda", description: "Poora link pao — youtu.be/... ja youtube.com/watch?v=...", variant: "destructive" });
      return;
    }
    try {
      await putSettings(
        { onAirVideo: url },
        url ? "📺 Video ON AIR NOW card ch lag gaya!" : "📺 Video hata ditta"
      );
    } catch {
      toast({ title: "Save nahi hoya", variant: "destructive" });
    }
  };

  const clearOnAirVideo = async () => {
    try {
      await putSettings({ onAirVideo: "" }, "📺 Video hata ditta — purana text design wapis");
      setSettings((s) => ({ ...s, onAirVideo: "" }));
    } catch {
      toast({ title: "Nahi hoya", variant: "destructive" });
    }
  };

  const changePw = async () => {
    if (!currentPw || !newPw) {
      toast({ title: "Dono fields bharo", variant: "destructive" });
      return;
    }
    if (newPw !== confirmPw) {
      toast({ title: "Nava password te confirm match nahi karde", variant: "destructive" });
      return;
    }
    setPwSaving(true);
    try {
      const res = await adminFetch("/api/admin/session", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error || "Fail");
      }
      toast({ title: "🔒 Password badal gaya!" });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (e) {
      toast({ title: "Password nahi badla", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setPwSaving(false);
    }
  };

  const isStreamOn = settings.liveMode === "stream";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-400/20 bg-[color:var(--bg-card)] p-5">
        <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-amber-100">
          <Radio className="h-4.5 w-4.5 text-amber-400" /> Station Settings
        </h3>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>Station da naam</FieldLabel>
              <Input
                value={settings.stationName}
                onChange={(e) => setSettings((s) => ({ ...s, stationName: e.target.value }))}
                data-testid="settings-name"
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Tagline</FieldLabel>
              <Input
                value={settings.tagline}
                onChange={(e) => setSettings((s) => ({ ...s, tagline: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>24x7 Live Mode</FieldLabel>
            <RadioGroup
              value={settings.liveMode}
              onValueChange={(v) => setSettings((s) => ({ ...s, liveMode: v }))}
              className="grid gap-3 sm:grid-cols-2"
              data-testid="live-mode-group"
            >
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                  settings.liveMode === "auto"
                    ? "border-amber-400 bg-amber-400/10"
                    : "border-amber-400/20 bg-black/25"
                }`}
              >
                <RadioGroupItem value="auto" className="mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-100">🎵 Auto-Pilot Playlist</p>
                  <p className="mt-0.5 text-xs text-amber-100/60">
                    Tuhadi uploaded songs te cloud links din-raat 24 ghante non-stop loop honde rehnde ne.
                  </p>
                </div>
              </label>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                  settings.liveMode === "stream"
                    ? "border-amber-400 bg-amber-400/10"
                    : "border-amber-400/20 bg-black/25"
                }`}
              >
                <RadioGroupItem value="stream" className="mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-100">📡 Live Stream URL</p>
                  <p className="mt-0.5 text-xs text-amber-100/60">
                    Gurbani Library ton ek click ON kar sakde ho (hethan card vekho) ja URL khud pao.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>

          {isStreamOn && (
            <div className="space-y-1.5" data-testid="live-url-wrap">
              <FieldLabel>Live Stream URL</FieldLabel>
              <Input
                value={settings.liveUrl}
                onChange={(e) => setSettings((s) => ({ ...s, liveUrl: e.target.value }))}
                placeholder="https://your-stream-server.com/stream.mp3"
                inputMode="url"
              />
              <p className="flex items-center gap-1.5 text-xs text-amber-100/50">
                <Wifi className="h-3 w-3" /> Pehla stream URL browser vich test karke hi save karo — ja Gurbani Library card ton ON karo.
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>Live da naam (uthe likhea hovega)</FieldLabel>
              <Input
                value={settings.liveTitle || ""}
                onChange={(e) => setSettings((s) => ({ ...s, liveTitle: e.target.value }))}
                placeholder="Darbar Sahib Live"
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Live di vertical photo (optional — hero player ch dikhegi)</FieldLabel>
              <FilePick
                accept="image/*"
                fileName={imgFile?.name}
                onChange={(f) => {
                  if (f) uploadLiveImg(f);
                }}
              />
              {imgUploading && (
                <p className="flex items-center gap-1.5 text-xs text-amber-300">
                  <Loader2 className="h-3 w-3 animate-spin" /> Upload ho rahi hai...
                </p>
              )}
              {!imgUploading && settings.liveImage && (
                <p className="flex items-center gap-2 text-xs text-green-400">
                  <ImagePlus className="h-3.5 w-3.5" /> Photo set hai — jado Gurbani live chalegi (manual ON ya Time-Table) tab hero ch dikhegi
                </p>
              )}
            </div>
          </div>

          <Button
            onClick={save}
            disabled={saving || imgUploading}
            data-testid="settings-save"
            className="border-0 bg-gradient-to-r from-amber-400 to-orange-500 font-bold text-black hover:from-amber-300 hover:to-orange-400"
          >
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Save karo
          </Button>
        </div>
      </div>

      {/* ── Gurbani Library — ek click ON/OFF ── */}
      <div className="rounded-2xl border border-red-400/25 bg-[color:var(--bg-card)] p-5" data-testid="gurbani-library">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-bold text-amber-100">
            📺 Gurbani / Live Library <span className="text-xs font-normal text-amber-100/50">(ek click ON/OFF)</span>
          </h3>
          {isStreamOn ? (
            <Badge className="live-dot gap-1 border-0 bg-red-600 text-[10px] font-bold text-white">LIVE CHAL RYA HAAN</Badge>
          ) : (
            <Badge variant="outline" className="border-amber-400/40 text-[10px] uppercase text-amber-300">Band hai — songs chal rahe ne</Badge>
          )}
        </div>
        <p className="mb-3 text-xs text-amber-100/60">
          Live stream ethe save rehnda hai. Jado gurbani chalani hove — <b className="text-amber-300">ON karo</b> dabao.
          Khatam karni hove — <b className="text-amber-300">BAND karo</b> dabao, fer apne songs auto chalne ge.
        </p>

        <div className="nice-scroll max-h-56 space-y-2 overflow-y-auto pr-1">
          {shownLib.map((entry) => {
            const active = isStreamOn && settings.liveUrl === entry.url;
            return (
              <div key={entry.url} className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-400/10 bg-black/25 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-amber-50">{entry.name}</p>
                  <p className="truncate text-xs text-amber-100/50">{entry.url}</p>
                </div>
                {active ? (
                  <Badge className="shrink-0 gap-1 border-0 bg-green-600 text-[10px] font-bold text-white">● CHAL RYA</Badge>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => streamOn(entry)}
                    className="shrink-0 border-0 bg-gradient-to-r from-red-500 to-orange-500 text-xs font-bold text-white hover:from-red-400 hover:to-orange-400"
                  >
                    🔴 ON karo
                  </Button>
                )}
                {library.some((e) => e.url === entry.url) && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`${entry.name} library ton kado`}
                    onClick={() => delStream(entry.url)}
                    className="h-8 w-8 shrink-0 text-red-300 hover:bg-red-400/15"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            onClick={streamOff}
            disabled={!isStreamOn}
            variant="outline"
            className="border-red-400/40 text-red-300 disabled:opacity-40"
          >
            <Square className="mr-1.5 h-3.5 w-3.5" /> ⏹ BAND karo (songs chalu)
          </Button>
        </div>

        <div className="mt-4 space-y-2 border-t border-amber-400/15 pt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-300/80">Nava stream library ch add karo</p>
          <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr]">
            <Input value={libName} onChange={(e) => setLibName(e.target.value)} placeholder="Naam (jiven: 24kbps slow)" />
            <Input value={libUrl} onChange={(e) => setLibUrl(e.target.value)} placeholder="https://stream-url..." inputMode="url" />
          </div>
          <Button onClick={addStream} disabled={libSaving} variant="outline" className="border-amber-400/40 text-amber-200">
            {libSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
            Library ch add karo
          </Button>
        </div>
      </div>

      {/* ── Gurbani Auto Time-Table — fix time te live auto ON, bahar songs ── */}
      <div className="rounded-2xl border border-amber-400/20 bg-[color:var(--bg-card)] p-5" data-testid="gurbani-schedule">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-bold text-amber-100">
            ⏰ Gurbani da Time-Table (Auto)
            <span className="text-xs font-normal text-amber-100/50">(fix time te gurbani, baaki songs)</span>
          </h3>
          {sched.enabled ? (
            <Badge className="border-0 bg-green-600 text-[10px] font-bold text-white">AUTO ON</Badge>
          ) : (
            <Badge variant="outline" className="border-amber-400/40 text-[10px] uppercase text-amber-300">AUTO BAND</Badge>
          )}
        </div>
        <p className="mb-3 text-xs text-amber-100/60">
          Time fix karo — os window vich <b className="text-amber-300">Darbar Sahib live khud ON ho jaugegi</b>, window ton bahar apne songs chalnge.
          Manual ON/BAND button vi kam karda rehuga — ohdi hamesha jeet hundi (je tusi khud ON kitta, schedule vi nahi banda).
        </p>

        <div className="mb-3 flex items-center justify-between rounded-xl border border-amber-400/15 bg-black/25 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-amber-100">🤖 Auto Time-Table chalu karo</p>
            <p className="mt-0.5 text-xs text-amber-100/50">ON karo, time windows pao — site khud gurbani/songs switch karegi</p>
          </div>
          <Switch
            checked={sched.enabled}
            onCheckedChange={(v) => saveSched({ ...sched, enabled: v })}
            aria-label="Gurbani auto time-table ON/OFF"
            data-testid="schedule-toggle"
          />
        </div>

        {sched.windows.length > 0 && (
          <div className="space-y-2">
            {sched.windows.map((w, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-400/10 bg-black/25 px-3 py-2.5">
                <span className="text-xs font-bold uppercase tracking-wide text-amber-300/80">Window {i + 1}</span>
                <input
                  type="time"
                  value={w.start}
                  onChange={(e) =>
                    saveSched({ ...sched, windows: sched.windows.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)) })
                  }
                  aria-label="Window shuru time"
                  className="rounded-lg border border-amber-400/30 bg-black/40 px-2 py-1.5 text-sm text-amber-50 [color-scheme:dark]"
                />
                <span className="text-amber-100/50">→</span>
                <input
                  type="time"
                  value={w.end}
                  onChange={(e) =>
                    saveSched({ ...sched, windows: sched.windows.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)) })
                  }
                  aria-label="Window akhri time"
                  className="rounded-lg border border-amber-400/30 bg-black/40 px-2 py-1.5 text-sm text-amber-50 [color-scheme:dark]"
                />
                <span className="font-mono text-xs font-bold text-amber-200/80">
                  {fmtAmPm(w.start)} – {fmtAmPm(w.end)}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Window ${i + 1} kado`}
                  onClick={() => saveSched({ ...sched, windows: sched.windows.filter((_, j) => j !== i) })}
                  className="ml-auto h-8 w-8 shrink-0 text-red-300 hover:bg-red-400/15"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button
          onClick={() => saveSched({ ...sched, windows: [...sched.windows, { start: "04:00", end: "10:00" }] })}
          variant="outline"
          data-testid="schedule-add"
          className="mt-3 border-amber-400/40 text-amber-200"
        >
          <Plus className="mr-1 h-4 w-4" />
          Navi window add karo
        </Button>

        {sched.enabled && sched.windows.length > 0 && (
          <p className="mt-2 text-xs text-green-400">
            ✅ Time-table chal rahi hai — hun:{" "}
            {inGurbaniWindow(sched, new Date()) ? "GURBANI window chal rahi hai (live bajegi)" : "window bahar — songs chal rahe ne"}
          </p>
        )}
        {sched.enabled && sched.windows.length === 0 && (
          <p className="mt-2 text-xs text-amber-300">Windows add karo — bina window koi auto-switch nahi hovega</p>
        )}
      </div>

      {/* ── Singer Photos — stamp-size image with now-playing ── */}
      <div className="rounded-2xl border border-amber-400/20 bg-[color:var(--bg-card)] p-5" data-testid="singer-photos">
        <h3 className="mb-2 flex items-center gap-2 text-base font-bold text-amber-100">
          🧑‍🎤 Singer Photos <span className="text-xs font-normal text-amber-100/50">(song chaldi vakat now-playing naal dikhegi)</span>
        </h3>
        <p className="mb-3 text-xs text-amber-100/60">
          Singer da naam <b className="text-amber-300">bilkul ohida likho</b> jiven song ch artist likhya a (jiven: Mahendra Kapoor) — fer ohdi photo now-playing vich dikhegi.
        </p>

        {Object.keys(singers).length > 0 && (
          <div className="nice-scroll mb-3 max-h-40 space-y-2 overflow-y-auto pr-1">
            {Object.entries(singers).map(([name, url]) => (
              <div key={name} className="flex items-center gap-3 rounded-xl border border-amber-400/10 bg-black/25 px-3 py-2">
                <img src={url} alt={name} className="h-9 w-9 shrink-0 rounded-full border border-amber-400/30 object-cover" />
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-amber-50">{name}</p>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`${name} di photo kado`}
                  onClick={() => delSinger(name)}
                  className="h-8 w-8 shrink-0 text-red-300 hover:bg-red-400/15"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 border-t border-amber-400/15 pt-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>Singer da naam</FieldLabel>
              <Input value={singerName} onChange={(e) => setSingerName(e.target.value)} placeholder="jiven: Mahendra Kapoor" />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Singer di photo (chhoti square, max 4MB)</FieldLabel>
              <FilePick
                accept="image/*"
                fileName={singerUrl ? "✓ photo upload ho gayi" : undefined}
                onChange={(f) => {
                  if (f) uploadSingerImg(f);
                }}
              />
            </div>
          </div>
          {singerUploading && (
            <p className="flex items-center gap-1.5 text-xs text-amber-300">
              <Loader2 className="h-3 w-3 animate-spin" /> Upload ho rahi hai...
            </p>
          )}
          <Button
            onClick={addSinger}
            disabled={singerUploading}
            variant="outline"
            data-testid="singer-add"
            className="border-amber-400/40 text-amber-200"
          >
            {singerUploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
            Singer photo add karo
          </Button>
        </div>
      </div>

      {/* ── Play/Pause Button di Setting — image/circle + rang ── */}
      <div className="rounded-2xl border border-amber-400/20 bg-[color:var(--bg-card)] p-5" data-testid="player-style">
        <h3 className="mb-2 flex items-center gap-2 text-base font-bold text-amber-100">
          <Palette className="h-4.5 w-4.5 text-amber-400" /> Chalao/Roko Button di Setting
          <span className="text-xs font-normal text-amber-100/50">(now-playing vali image ja circle)</span>
        </h3>
        <p className="mb-4 text-xs text-amber-100/60">
          Eh button site te geet chaldi vakat dikhega — usde vich image lagao ja simple circle rakho, te play/pause de apne pasand de rang chuno. Dono rang same vi ho sakde ne te alag-alag vi.
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-amber-400/15 bg-black/25 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-amber-100">🖼️ Singer image vekhao</p>
              <p className="mt-0.5 text-xs text-amber-100/50">
                ON = singer photo (jithon photo nahi hove othe simple circle) • OFF = hamesha simple circle
              </p>
            </div>
            <Switch
              checked={pStyle.showImage}
              onCheckedChange={(v) => savePlayerStyle({ showImage: v })}
              aria-label="Singer image on/off"
              data-testid="player-style-image"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-amber-400/15 bg-black/25 p-4">
              <p className="text-sm font-bold text-amber-100">▶️ Play da rang (geet chal rya)</p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="color"
                  value={pStyle.playColor || "#4ade80"}
                  onChange={(e) => savePlayerStyle({ playColor: e.target.value })}
                  aria-label="Play da rang chuno"
                  data-testid="player-style-play-color"
                  className="h-10 w-16 cursor-pointer rounded-lg border border-amber-400/30 bg-transparent"
                />
                <span className="font-mono text-xs text-amber-100/60">{pStyle.playColor || "koi rang nahi"}</span>
                {pStyle.playColor && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Play da rang hatao"
                    onClick={() => savePlayerStyle({ playColor: "" })}
                    className="ml-auto h-8 w-8 text-red-300 hover:bg-red-400/15"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-amber-400/15 bg-black/25 p-4">
              <p className="text-sm font-bold text-amber-100">⏸️ Pause da rang (geet rukya)</p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="color"
                  value={pStyle.pauseColor || "#4ade80"}
                  onChange={(e) => savePlayerStyle({ pauseColor: e.target.value })}
                  aria-label="Pause da rang chuno"
                  data-testid="player-style-pause-color"
                  className="h-10 w-16 cursor-pointer rounded-lg border border-amber-400/30 bg-transparent"
                />
                <span className="font-mono text-xs text-amber-100/60">{pStyle.pauseColor || "koi rang nahi"}</span>
                {pStyle.pauseColor && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Pause da rang hatao"
                    onClick={() => savePlayerStyle({ pauseColor: "" })}
                    className="ml-auto h-8 w-8 text-red-300 hover:bg-red-400/15"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          <p className="text-xs text-amber-100/50">
            💡 Rang chuno te foran save ho jauga — site te vikh jauga. Kisi rang nu hatuna hove ta osde nadd ✕ dabao.
          </p>
        </div>
      </div>

      {/* ── Site Theme — professional color presets ── */}
      <div className="rounded-2xl border border-amber-400/20 bg-[color:var(--bg-card)] p-5" data-testid="theme-settings">
        <h3 className="mb-2 flex items-center gap-2 text-base font-bold text-amber-100">
          🎨 Site da Rang Theme
          <span className="text-xs font-normal text-amber-100/50">(professional color templates)</span>
        </h3>
        <p className="mb-3 text-xs text-amber-100/60">
          Ik click ch poori site da rang badal jauuga — navbar, hero, cards, sab kuch. Jo theme pasand aave osde button dabao, foran save ho jauga.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {THEME_PRESETS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => saveTheme(t.key)}
              data-testid={`theme-${t.key}`}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                parseTheme(settings.theme) === t.key
                  ? "border-amber-400 bg-amber-400/10"
                  : "border-amber-400/20 bg-black/25 hover:border-amber-400/40"
              }`}
            >
              <span className="h-5 w-5 shrink-0 rounded-full border-2 border-white/30" style={{ backgroundColor: t.dot }} />
              <span className="text-sm font-bold text-amber-50">{t.label}</span>
              {parseTheme(settings.theme) === t.key && (
                <Badge className="ml-auto shrink-0 border-0 bg-amber-400 text-[10px] font-bold text-black">LAGG RYA</Badge>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Breaking News Ticker de Rang — admin-configurable colors ── */}
      <div className="rounded-2xl border border-amber-400/20 bg-[color:var(--bg-card)] p-5" data-testid="ticker-style">
        <h3 className="mb-2 flex items-center gap-2 text-base font-bold text-amber-100">
          🟡 Breaking News Ticker de Rang
          <span className="text-xs font-normal text-amber-100/50">(apni pasand de karo)</span>
        </h3>
        <p className="mb-3 text-xs text-amber-100/60">
          Upar wali news strip de rang chuno — label da background, label de text, scrolling area da background te text. Rang chuno te foran save ho jauga, site te vikh jauga.
        </p>

        {/* Live preview */}
        <div className="overflow-hidden rounded-xl border border-black/25" style={{ backgroundColor: tStyle.bg }}>
          <div className="flex items-stretch">
            <div className="flex shrink-0 items-center px-3 py-2" style={{ backgroundColor: tStyle.labelBg }}>
              <span className="text-xs font-extrabold uppercase tracking-wider" style={{ color: tStyle.labelText }}>
                Breaking News
              </span>
            </div>
            <div className="flex flex-1 items-center px-3 py-2">
              <span className="font-gur text-sm font-semibold" style={{ color: tStyle.text }}>
                📰 Sample khabar — eh vekh ke rang chuno
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-amber-400/15 bg-black/25 p-4">
            <p className="text-sm font-bold text-amber-100">⬛ Label da background</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="color"
                value={tStyle.labelBg}
                onChange={(e) => saveTStyle({ ...tStyle, labelBg: e.target.value })}
                aria-label="Label background rang"
                className="h-10 w-16 cursor-pointer rounded-lg border border-amber-400/30 bg-transparent"
              />
              <span className="font-mono text-xs text-amber-100/60">{tStyle.labelBg}</span>
            </div>
          </div>
          <div className="rounded-xl border border-amber-400/15 bg-black/25 p-4">
            <p className="text-sm font-bold text-amber-100">Breaking News de text da rang</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="color"
                value={tStyle.labelText}
                onChange={(e) => saveTStyle({ ...tStyle, labelText: e.target.value })}
                aria-label="Label text rang"
                className="h-10 w-16 cursor-pointer rounded-lg border border-amber-400/30 bg-transparent"
              />
              <span className="font-mono text-xs text-amber-100/60">{tStyle.labelText}</span>
            </div>
          </div>
          <div className="rounded-xl border border-amber-400/15 bg-black/25 p-4">
            <p className="text-sm font-bold text-amber-100">🟡 Scrolling area da background</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="color"
                value={tStyle.bg}
                onChange={(e) => saveTStyle({ ...tStyle, bg: e.target.value })}
                aria-label="Scroll background rang"
                className="h-10 w-16 cursor-pointer rounded-lg border border-amber-400/30 bg-transparent"
              />
              <span className="font-mono text-xs text-amber-100/60">{tStyle.bg}</span>
            </div>
          </div>
          <div className="rounded-xl border border-amber-400/15 bg-black/25 p-4">
            <p className="text-sm font-bold text-amber-100">Scrolling khabra de text da rang</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="color"
                value={tStyle.text}
                onChange={(e) => saveTStyle({ ...tStyle, text: e.target.value })}
                aria-label="Scroll text rang"
                className="h-10 w-16 cursor-pointer rounded-lg border border-amber-400/30 bg-transparent"
              />
              <span className="font-mono text-xs text-amber-100/60">{tStyle.text}</span>
            </div>
          </div>
        </div>
        <Button
          onClick={() => saveTStyle(TICKER_DEFAULT)}
          variant="outline"
          className="mt-3 border-amber-400/40 text-amber-200"
        >
          Default rang wapis karo (peela + kaala)
        </Button>
      </div>

      {/* ── ON AIR NOW card ch YouTube video ── */}
      <div className="rounded-2xl border border-amber-400/20 bg-[color:var(--bg-card)] p-5" data-testid="onair-video-settings">
        <h3 className="mb-2 flex items-center gap-2 text-base font-bold text-amber-100">
          📺 ON AIR NOW ch Video
          <span className="text-xs font-normal text-amber-100/50">(YouTube)</span>
        </h3>
        <p className="mb-3 text-xs text-amber-100/60">
          YouTube da link pao — hero de <b className="text-amber-300">ON AIR NOW</b> card ch video da thumbnail lag jauga, listener click kare te video chal jaugegi. Khaali rakho ta purana text design dikhega.
        </p>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
          <Input
            value={settings.onAirVideo || ""}
            onChange={(e) => setSettings((s) => ({ ...s, onAirVideo: e.target.value }))}
            placeholder="https://youtu.be/... ja youtube.com/watch?v=..."
            inputMode="url"
            data-testid="onair-video-input"
          />
          <div className="flex gap-2">
            <Button onClick={saveOnAirVideo} variant="outline" data-testid="onair-video-save" className="border-amber-400/40 text-amber-200">
              <Save className="mr-1 h-4 w-4" /> Save karo
            </Button>
            {settings.onAirVideo && (
              <Button onClick={clearOnAirVideo} variant="ghost" aria-label="ON AIR video hatao" className="text-red-300 hover:bg-red-400/15">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        {ytThumb(settings.onAirVideo || "") && (
          <img src={ytThumb(settings.onAirVideo || "") || ""} alt="Video thumbnail preview" className="mt-2 h-24 w-40 rounded-lg border border-amber-400/30 object-cover" />
        )}
      </div>

      <div className="rounded-2xl border border-amber-400/20 bg-[color:var(--bg-card)] p-5">
        <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-amber-100">
          <KeyRound className="h-4.5 w-4.5 text-amber-400" /> Password Badlo
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <FieldLabel>Current password</FieldLabel>
            <Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Nava password</FieldLabel>
            <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Confirm nava password</FieldLabel>
            <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" />
          </div>
        </div>
        <Button onClick={changePw} disabled={pwSaving} variant="outline" className="mt-3 border-amber-400/40 text-amber-200">
          {pwSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <KeyRound className="mr-1 h-4 w-4" />}
          Password update karo
        </Button>
      </div>
    </div>
  );
}
