"use client";

import { useEffect, useRef, useState } from "react";
import { Link2, Loader2, MonitorSmartphone, Music, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { usePlayer } from "@/lib/store";
import { adminFetch } from "@/lib/client-auth";
import type { Song } from "@/lib/types";
import { DangerButton, EmptyRow, FieldLabel, FilePick } from "@/components/admin/shared";

export default function SongsTab({ onChanged }: { onChanged?: () => void }) {
  const { toast } = useToast();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // upload form
  const [file, setFile] = useState<File | null>(null);
  const [upTitle, setUpTitle] = useState("");
  const [upArtist, setUpArtist] = useState("");

  // link form
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkArtist, setLinkArtist] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const playSong = usePlayer((s) => s.playSong);

  const load = async () => {
    try {
      const res = await fetch("/api/songs", { cache: "no-store" });
      const data = (await res.json()) as Song[];
      setSongs(Array.isArray(data) ? data : []);
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

  const submitUpload = async () => {
    if (!file) {
      toast({ title: "Pehla MP3 file chuno", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (upTitle.trim()) fd.append("title", upTitle.trim());
      if (upArtist.trim()) fd.append("artist", upArtist.trim());
      const res = await adminFetch("/api/songs", { method: "POST", body: fd });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error || "Upload fail");
      }
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
        const j = (await res.json()) as { error?: string };
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
      afterChange();
    } else {
      toast({ title: "Delete nahi hoya", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-400/20 bg-[oklch(0.21_0.018_60)] p-5">
        <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-amber-100">
          <Music className="h-4.5 w-4.5 text-amber-400" /> Nava Song Add Karo
        </h3>
        <Tabs defaultValue="upload">
          <TabsList className="mb-4 bg-black/30">
            <TabsTrigger value="upload" className="gap-1.5 data-[state=active]:bg-amber-400 data-[state=active]:text-black">
              <MonitorSmartphone className="h-3.5 w-3.5" /> PC Ton Upload
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
                <FieldLabel>Artist (optional)</FieldLabel>
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
              {uploading ? "Upload ho rahi hai..." : "Upload karo"}
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

      {/* Songs list */}
      <div className="rounded-2xl border border-amber-400/20 bg-[oklch(0.21_0.018_60)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-amber-100">Playlist ({songs.length} songs)</h3>
        </div>
        {loading ? (
          <EmptyRow text="Load ho raha hai..." />
        ) : songs.length === 0 ? (
          <EmptyRow text="Hale koi song nahi. Upar ton add karo!" />
        ) : (
          <div className="nice-scroll max-h-96 space-y-2 overflow-y-auto pr-1" data-testid="songs-list">
            {songs.map((s, i) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-amber-400/10 bg-black/25 px-3 py-2.5"
                data-testid={`song-row-${i}`}
              >
                <span className="w-6 shrink-0 text-center font-mono text-xs text-amber-400/70">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-amber-50">{s.title}</p>
                  <p className="truncate text-xs text-amber-100/50">
                    {s.artist ? `${s.artist} • ` : ""}
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
                    playSong(s.id);
                    toast({ title: "▶️ Chal rahi hai", description: s.title });
                  }}
                  className="h-8 w-8 shrink-0 text-amber-300 hover:bg-amber-400/15 hover:text-amber-200"
                >
                  <Play className="h-4 w-4" />
                </Button>
                <DangerButton testId={`song-delete-${i}`} onConfirm={() => remove(s.id)} label={`${s.title} delete`} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
