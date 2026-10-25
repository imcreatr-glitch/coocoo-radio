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

// Files bigger than this go through the chunked upload flow
// (Netlify functions reject request bodies over 6MB).
const CHUNK_LIMIT = 4 * 1024 * 1024;

export default function SongsTab({ onChanged }: { onChanged?: () => void }) {
  const { toast } = useToast();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");

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

  /** big files: slice into 4MB pieces and upload one by one */
  const uploadChunked = async (f: File) => {
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
      setProgress(`${i + 1}/${total}`);
    }

    const doneRes = await adminFetch("/api/uploads?action=complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadId,
        filename: f.name,
        count: total,
        title: upTitle.trim(),
        artist: upArtist.trim(),
      }),
    });
    if (!doneRes.ok) {
      const j = (await doneRes.json().catch(() => ({}))) as { error?: string };
      throw new Error(j.error || "Upload poora nahi hoya");
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
      if (file.size > CHUNK_LIMIT) {
        await uploadChunked(file);
      } else {
        const fd = new FormData();
        fd.append("file", file);
        if (upTitle.trim()) fd.append("title", upTitle.trim());
        if (upArtist.trim()) fd.append("artist", upArtist.trim());
        const res = await adminFetch("/api/songs", { method: "POST", body: fd });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || "Upload fail");
        }
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
              {uploading ? (progress ? `Upload ho rahi hai... ${progress}` : "Upload ho rahi hai...") : "Upload karo"}
            </Button>
          </TabsContent>

          <TabsContent value="
