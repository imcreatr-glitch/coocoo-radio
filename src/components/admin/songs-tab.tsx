"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  FolderOpen,
  Files,
  Link2,
  ListMusic,
  ListPlus,
  Loader2,
  MonitorSmartphone,
  Music,
  Play,
  Radio,
  Save,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { usePlayer } from "@/lib/store";
import { adminFetch } from "@/lib/client-auth";
import type { Song, StationSettings } from "@/lib/types";
import { DangerButton, EmptyRow, FieldLabel, FilePick } from "@/components/admin/shared";

// Files bigger than this go through the chunked upload flow
// (Netlify functions reject request bodies over 6MB).
const CHUNK_LIMIT = 4 * 1024 * 1024;
const AUDIO_RE = /\.(mp3|wav|ogg|m4a|aac|flac)$/i;

// folder-picker attrs TS nahi jaanda — spread naal pass karde aan
const FOLDER_ATTRS = { webkitdirectory: "", directory: "", mozdirectory: "" } as Record<string, string>;

export default function SongsTab({ onChanged }: { onChanged?: () => void }) {
  const { toast } = useToast();
  const playSongNow = usePlayer((s) => s.playSongNow);
  const refreshContext = usePlayer((s) => s.refreshContext);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");

  // live playlist (admin queue)
  const [queue, setQueue] = useState<string[]>([]);
  const [livePlaylist, setLivePlaylist] = useState<string>(""); // raw setting from server
  const [liveMode, setLiveMode] = useState<string>("auto");
  const [savingQueue, setSavingQueue] = useState(false);

  // single upload form
  const [file, setFile] = useState<File | null>(null);
  const [upTitle, setUpTitle] = useState("");
  const [upArtist, setUpArtist] = useState("");

  // bulk upload form
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkArtist, setBulkArtist] = useState("");

  // link form
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkArtist, setLinkArtist] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const [songsRes, settingsRes] = await Promise.all([
        fetch("/api/songs", { cache: "no-store" }),
        fetch("/api/settings", { cache: "no-store" }),
      ]);
      const data = (await songsRes.json()) as Song[];
      const st = (await settingsRes.json()) as StationSettings;
      setSongs(Array.isArray(data) ? data : []);
      setLiveMode(st.liveMode || "auto");
      const raw = st.playlist || "";
      setLivePlaylist(raw);
      try {
        const ids = raw ? (JSON.parse(raw) as string[]) : [];
        setQueue(Array.isArray(ids) ? ids.filter((id) => (data || []).some((s) => s.id === id)) : []);
      } catch {
        setQueue([]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const afterChange = () => {
    load();
    onChanged?.();
  };

  /** upload one file: chunked for big files, single-shot for small */
  const uploadOne = async (f: File, title: string, artist: string) => {
    if (f.size > CHUNK_LIMIT) {
      const initRes = await adminFetch("/api/uploads?action=init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: f.name, size: f.size }),
      });
      if (!initRes.ok) {
        const j = (await initRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "Upload shuru nahi hoya");
      }
      const { uploadId, chunkSize, total } = (await initRes.json()) as {
        uploadId: string;
        chunkSize: number;
        total: number;
      };
      for (let i = 0; i < total; i++) {
        const slice = f.slice(i * chunkSize, Math.min((i + 1) * chunkSize, f.size));
        const cRes = await adminFetch(
          `/api/uploads?action=chunk&uploadId=${encodeURIComponent(uploadId)}&index=${i}`,
          { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: slice }
        );
        if (!cRes.ok) {
          const j = (await cRes.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || `Chunk ${i + 1}/${total} fail ho gaya`);
        }
      }
      const doneRes = await adminFetch("/api/uploads?action=complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId, filename: f.name, count: total, title, artist }),
      });
      if (!doneRes.ok) {
        const j = (await doneRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "Upload poora nahi hoya");
      }
      return;
    }
    const fd = new FormData();
    fd.append("file", f);
    if (title) fd.append("title", title);
    if (artist) fd.append("artist", artist);
    const res = await adminFetch("/api/songs", { method: "POST", body: fd });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(j.error || "Upload fail");
    }
  };

  const submitUpload = async () => {
    if (!file) {
      toast({ title: "Pehla MP3 file chuno", variant: "destructive" });
      return;
    }
    setUploading(true);
    setProgress("");
    try {
      await uploadOne(file, upTitle.trim(), upArtist.trim());
      toast({ title: "🎵 Song upload ho gaya!", description: `${upTitle || file.name} playlist vich add ho gaya` });
      setFile(null);
      setUpTitle("");
      setUpArtist("");
      if (fileRef.current) fileRef.current.value = "";
      afterChange();
    } catch (e) {
      toast({ title: "Upload fail ho gaya", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setUploading(false);
      setProgress("");
    }
  };

  /** bulk: folder ya multiple files — har file layi artist = folder name ja input */
  const submitBulk = async () => {
    const files = bulkFiles.filter((f) => AUDIO_RE.test(f.name));
    if (files.length === 0) {
      toast({ title: "Koi audio file nahi mili (mp3/wav/ogg/m4a)", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const rel = f.webkitRelativePath || f.name;
        const folder = rel.includes("/") ? rel.split("/")[0] : "";
        const artist = (bulkArtist.trim() || folder).trim();
        const title = f.name.replace(/\.[^.]+$/, "").trim();
        setProgress(`${i + 1}/${files.length} — ${title}`);
        await uploadOne(f, title, artist);
      }
      toast({ title: `🎉 ${files.length} songs upload ho gaye!`, description: "Singer folders vich save ho gaye" });
      setBulkFiles([]);
      setBulkArtist("");
      if (folderRef.current) folderRef.current.value = "";
      if (filesRef.current) filesRef.current.value = "";
      afterChange();
    } catch (e) {
      toast({ title: "Bulk upload ch fail hoya", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setUploading(false);
      setProgress("");
    }
  };

  const submitLink = async () => {
    if (!linkUrl.trim()) {
      toast({ title: "Cloud link pao (http/https)", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const res = await adminFetch("/api/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: linkUrl.trim(), title: linkTitle.trim(), artist: linkArtist.trim() }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "Link add fail");
      }
      toast({ title: "🔗 Cloud song add ho gaya!", description: linkTitle || linkUrl });
      setLinkUrl("");
      setLinkTitle("");
      setLinkArtist("");
      afterChange();
    } catch (e) {
      toast({ title: "Link add nahi hoya", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    const res = await adminFetch(`/api/songs/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Song delete ho gaya" });
      setQueue((q) => q.filter((x) => x !== id));
      afterChange();
    } else {
      toast({ title: "Delete nahi hoya", variant: "destructive" });
    }
  };

  // ── playlist builder helpers ──
  const songById = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs]);
  const queueSongs = queue.map((id) => songById.get(id)).filter((s): s is Song => !!s);

  const addToQueue = (s: Song) => {
    if (queue.includes(s.id)) {
      toast({ title: "Eh song playlist ch pehlan to hai" });
      return;
    }
    setQueue((q) => [...q, s.id]);
    toast({ title: "➕ Playlist ch add ho gaya", description: s.title });
  };

  const moveInQueue = (idx: number, dir: -1 | 1) => {
    setQueue((q) => {
      const next = [...q];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return q;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const savePlaylist = async (clear: boolean) => {
    setSavingQueue(true);
    try {
      const value = clear ? "" : JSON.stringify(queue);
      const res = await adminFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playlist: value }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "Save fail");
      }
      setLivePlaylist(value);
      await refreshContext();
      toast(
        clear
          ? { title: "Playlist hata gayi — hun saare songs auto chalne ge" }
          : { title: "🔴 LIVE Playlist chal pae gayi!", description: `${queue.length} songs eh order ch sari site te chalne ge` }
      );
    } catch (e) {
      toast({ title: "Playlist save nahi hoyi", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSavingQueue(false);
    }
  };

  // songs grouped by singer (artist) — folder jaisa view
  const groups = useMemo(() => {
    const g: { artist: string; items: Song[] }[] = [];
    for (const s of songs) {
      const key = (s.artist || "").trim() || "Hor Songs";
      const last = g[g.length - 1];
      if (last && last.artist === key) last.items.push(s);
      else g.push({ artist: key, items: [s] });
    }
    return g;
  }, [songs]);

  let rowIndex = -1;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-400/20 bg-[color:var(--bg-card)] p-5">
        <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-amber-100">
          <Music className="h-4.5 w-4.5 text-amber-400" /> Nava Song Add Karo
        </h3>
        <Tabs defaultValue="upload">
          <TabsList className="mb-4 bg-black/30">
            <TabsTrigger value="upload" className="gap-1.5 data-[state=active]:bg-amber-400 data-[state=active]:text-black">
              <MonitorSmartphone className="h-3.5 w-3.5" /> Ik Song
            </TabsTrigger>
            <TabsTrigger value="bulk" className="gap-1.5 data-[state=active]:bg-amber-400 data-[state=active]:text-black">
              <FolderOpen className="h-3.5 w-3.5" /> Bulk / Singer Folder
            </TabsTrigger>
            <TabsTrigger value="link" className="gap-1.5 data-[state=active]:bg-amber-400 data-[state=active]:text-black">
              <Link2 className="h-3.5 w-3.5" /> Cloud Link
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-3" data-testid="upload-form">
            <FilePick
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
              fileName={file?.name}
              onChange={(f) => {
                setFile(f);
                if (f && !upTitle) setUpTitle(f.name.replace(/\.[^.]+$/, ""));
              }}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel>Song Title</FieldLabel>
                <Input value={upTitle} onChange={(e) => setUpTitle(e.target.value)} placeholder="jiven: Diljit — G.O.A.T." />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Singer / Artist (optional)</FieldLabel>
                <Input value={upArtist} onChange={(e) => setUpArtist(e.target.value)} placeholder="Artist da naam" />
              </div>
            </div>
            <Button
              onClick={submitUpload}
              disabled={uploading}
              data-testid="upload-submit"
              className="border-0 bg-gradient-to-r from-amber-400 to-orange-500 font-bold text-black hover:from-amber-300 hover:to-orange-400"
            >
              {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              {uploading ? (progress ? `Upload ho rahi hai... ${progress}` : "Upload ho rahi hai...") : "Upload karo"}
            </Button>
          </TabsContent>

          <TabsContent value="bulk" className="space-y-3" data-testid="bulk-form">
            <p className="rounded-xl border border-amber-400/20 bg-black/25 p-3 text-xs text-amber-100/70">
              💡 PC te folder ch gaane rakho (har singer da apna folder). Folder chuno — <b className="text-amber-300">folder da naam singer ban jayega</b>, saare gaane apne aap upload ho jange (badi files vi chalngiyan).
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                onClick={() => folderRef.current?.click()}
                className="border-amber-400/40 text-amber-200"
              >
                <FolderOpen className="mr-1.5 h-4 w-4" /> 📂 Folder chuno
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                onClick={() => filesRef.current?.click()}
                className="border-amber-400/40 text-amber-200"
              >
                <Files className="mr-1.5 h-4 w-4" /> Kai files ikathe chuno
              </Button>
            </div>
            <input
              ref={folderRef}
              type="file"
              multiple
              hidden
              {...FOLDER_ATTRS}
              onChange={(e) => setBulkFiles(Array.from(e.target.files || []))}
            />
            <input
              ref={filesRef}
              type="file"
              multiple
              hidden
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
              onChange={(e) => setBulkFiles(Array.from(e.target.files || []))}
            />
            {bulkFiles.length > 0 && (
              <p className="text-xs text-amber-200/80" data-testid="bulk-count">
                {bulkFiles.filter((f) => AUDIO_RE.test(f.name)).length} audio files chuniyan
                {bulkFiles[0]?.webkitRelativePath?.includes("/")
                  ? ` — folder: ${bulkFiles[0].webkitRelativePath.split("/")[0]}`
                  : ""}
              </p>
            )}
            <div className="space-y-1.5">
              <FieldLabel>Singer da naam (optional — folder da naam khud lag janda hai)</FieldLabel>
              <Input
                value={bulkArtist}
                onChange={(e) => setBulkArtist(e.target.value)}
                placeholder="jiven: Diljit Dosanjh — khali chadyo ta folder da naam vartega"
              />
            </div>
            <Button
              onClick={submitBulk}
              disabled={uploading || bulkFiles.length === 0}
              data-testid="bulk-submit"
              className="border-0 bg-gradient-to-r from-amber-400 to-orange-500 font-bold text-black hover:from-amber-300 hover:to-orange-400"
            >
              {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              {uploading && progress
                ? `Upload ho rahi hai... ${progress}`
                : `Saare upload karo${bulkFiles.length ? ` (${bulkFiles.filter((f) => AUDIO_RE.test(f.name)).length})` : ""}`}
            </Button>
          </TabsContent>

          <TabsContent value="link" className="space-y-3" data-testid="link-form">
            <div className="space-y-1.5">
              <FieldLabel>Cloud Song URL (Google Drive / Dropbox / koi bhi direct mp3 link)</FieldLabel>
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com/song.mp3"
                inputMode="url"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel>Song Title</FieldLabel>
                <Input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="Title (optional)" />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Artist (optional)</FieldLabel>
                <Input value={linkArtist} onChange={(e) => setLinkArtist(e.target.value)} placeholder="Artist da naam" />
              </div>
            </div>
            <Button
              onClick={submitLink}
              disabled={uploading}
              data-testid="link-submit"
              className="border-0 bg-gradient-to-r from-amber-400 to-orange-500 font-bold text-black hover:from-amber-300 hover:to-orange-400"
            >
              {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Link add karo
            </Button>
          </TabsContent>
        </Tabs>
      </div>

      {/* Live playlist builder */}
      <div className="rounded-2xl border border-red-400/25 bg-[color:var(--bg-card)] p-5" data-testid="playlist-builder">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-bold text-amber-100">
            <Radio className="h-4.5 w-4.5 text-red-400" /> 🔴 Live Playlist (jo visitors sune ge)
          </h3>
          {liveMode === "stream" && (
            <Badge variant="outline" className="border-red-400/50 text-[10px] uppercase text-red-300">
              Live Stream mode ON — playlist sirf Auto-Pilot mode ch chalegi
            </Badge>
          )}
        </div>
        <p className="mb-3 text-xs text-amber-100/60">
          Hethar list ton gaane chuno (+ button) — order bhi set karo (↑↓). Fer <b className="text-amber-300">LIVE chalo</b> dabao,
          sari site ohda order ch non-stop chalegi. Playlist khali hove ta saare songs auto-pilot ch chalde ne.
        </p>
        {livePlaylist && !livePlaylist.startsWith("[]") && (
          <p className="mb-2 text-xs font-bold text-green-400">
            ● Hun LIVE chal rya hai: {queue.length} songs (ehi order visitors sune ge)
          </p>
        )}
        {queueSongs.length === 0 ? (
          <EmptyRow text="Playlist khali hai — hethar list ton gaane de '+' button dabao" />
        ) : (
          <div className="nice-scroll max-h-60 space-y-2 overflow-y-auto pr-1">
            {queueSongs.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 rounded-xl border border-amber-400/10 bg-black/25 px-3 py-2">
                <span className="w-6 shrink-0 text-center font-mono text-xs text-amber-400/70">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-amber-50">{s.title}</p>
                  <p className="truncate text-xs text-amber-100/50">{s.artist || "—"}</p>
                </div>
                <Button size="icon" variant="ghost" aria-label="Upar karo" disabled={savingQueue} onClick={() => moveInQueue(i, -1)} className="h-8 w-8 shrink-0 text-amber-300 hover:bg-amber-400/15">
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label="Hethan karo" disabled={savingQueue} onClick={() => moveInQueue(i, 1)} className="h-8 w-8 shrink-0 text-amber-300 hover:bg-amber-400/15">
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label="Playlist ton kado" disabled={savingQueue} onClick={() => setQueue((q) => q.filter((x) => x !== s.id))} className="h-8 w-8 shrink-0 text-red-300 hover:bg-red-400/15">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            onClick={() => savePlaylist(false)}
            disabled={savingQueue || queueSongs.length === 0}
            data-testid="playlist-save"
            className="border-0 bg-gradient-to-r from-red-500 to-orange-500 font-bold text-white hover:from-red-400 hover:to-orange-400"
          >
            {savingQueue ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            🔴 LIVE chalo
          </Button>
          <Button
            onClick={() => savePlaylist(true)}
            disabled={savingQueue || !livePlaylist}
            variant="outline"
            className="border-amber-400/40 text-amber-200"
          >
            <ListMusic className="mr-1.5 h-4 w-4" /> Playlist hatao (sab auto)
          </Button>
        </div>
      </div>

      {/* Songs list — singer folders naal */}
      <div className="rounded-2xl border border-amber-400/20 bg-[color:var(--bg-card)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-amber-100">Playlist ({songs.length} songs)</h3>
        </div>
        {loading ? (
          <EmptyRow text="Load ho raha hai..." />
        ) : songs.length === 0 ? (
          <EmptyRow text="Hale koi song nahi. Upar ton add karo!" />
        ) : (
          <div className="nice-scroll max-h-96 space-y-2 overflow-y-auto pr-1" data-testid="songs-list">
            {groups.map((g) => (
              <div key={g.artist}>
                <p className="sticky top-0 z-10 mb-1 flex items-center gap-1.5 rounded-lg bg-[color:var(--bg-alt)] px-2 py-1 text-xs font-bold uppercase tracking-wide text-amber-300">
                  <FolderOpen className="h-3.5 w-3.5" /> {g.artist} ({g.items.length})
                </p>
                {g.items.map((s) => {
                  rowIndex += 1;
                  const i = rowIndex;
                  return (
                    <div
                      key={s.id}
                      className="mb-2 flex items-center gap-3 rounded-xl border border-amber-400/10 bg-black/25 px-3 py-2.5"
                      data-testid={`song-row-${i}`}
                    >
                      <span className="w-6 shrink-0 text-center font-mono text-xs text-amber-400/70">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-amber-50">{s.title}</p>
                        <p className="truncate text-xs text-amber-100/50">
                          {s.url.length > 46 ? `${s.url.slice(0, 46)}...` : s.url}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 border-amber-400/30 text-[10px] uppercase text-amber-300">
                        {s.source === "link" ? "Cloud" : "Upload"}
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`${s.title} play karo`}
                        onClick={() => {
                          playSongNow(s);
                          toast({ title: "▶️ Chal rahi hai", description: s.title });
                        }}
                        className="h-8 w-8 shrink-0 text-amber-300 hover:bg-amber-400/15 hover:text-amber-200"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`${s.title} live playlist ch add karo`}
                        onClick={() => addToQueue(s)}
                        className="h-8 w-8 shrink-0 text-red-300 hover:bg-red-400/15 hover:text-red-200"
                      >
                        <ListPlus className="h-4 w-4" />
                      </Button>
                      <DangerButton testId={`song-delete-${i}`} onConfirm={() => remove(s.id)} label={`${s.title} delete`} />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
