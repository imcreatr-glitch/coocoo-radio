"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import type { AdItem } from "@/lib/types";
import { ytId, ytThumb } from "@/lib/types";
import { adminFetch } from "@/lib/client-auth";
import { DangerButton, EmptyRow, FieldLabel, FilePick } from "@/components/admin/shared";

export default function AdsTab() {
  const { toast } = useToast();
  const [ads, setAds] = useState<AdItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [type, setType] = useState("image");
  const [media, setMedia] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState("");
  const [link, setLink] = useState("");
  const mediaRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/ads?all=1", { cache: "no-store" });
      const data = (await res.json()) as AdItem[];
      setAds(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    if (!title.trim()) {
      toast({ title: "Ad da title likho", variant: "destructive" });
      return;
    }
    if (!media && !mediaUrl.trim()) {
      toast({ title: "Media file chuno ja link pao", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("type", type);
      if (media) fd.append("media", media);
      else fd.append("mediaUrl", mediaUrl.trim());
      if (link.trim()) fd.append("link", link.trim());
      const res = await adminFetch("/api/ads", { method: "POST", body: fd });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error || "Save fail");
      }
      toast({ title: "📢 Ad add ho gaya!", description: title });
      setTitle("");
      setMedia(null);
      setMediaUrl("");
      setLink("");
      if (mediaRef.current) mediaRef.current.value = "";
      load();
    } catch (e) {
      toast({ title: "Ad add nahi hoya", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (ad: AdItem, active: boolean) => {
    const res = await adminFetch(`/api/ads/${ad.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    if (res.ok) {
      toast({ title: active ? "Ad site te dikhega" : "Ad site ton hat gaya" });
      load();
    }
  };

  const remove = async (id: string) => {
    const res = await adminFetch(`/api/ads/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Ad delete ho gaya" });
      load();
    } else {
      toast({ title: "Delete nahi hoya", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-400/20 bg-[oklch(0.21_0.018_60)] p-5">
        <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-amber-100">
          <Megaphone className="h-4.5 w-4.5 text-amber-400" /> Nava Ishtihar (Ad) Add Karo
        </h3>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <div className="space-y-1.5">
              <FieldLabel>Ad da title / brand</FieldLabel>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="jiven: Sharma Sweets" data-testid="ad-title" />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Type</FieldLabel>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger data-testid="ad-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">🖼️ Image Banner</SelectItem>
                  <SelectItem value="video">🎬 Video Ad</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>{type === "video" ? "Video file (mp4/webm)" : "Image file (jpg/png/webp/gif)"}</FieldLabel>
              <FilePick
                accept={type === "video" ? "video/*,.mp4,.webm,.ogv,.mov" : "image/*"}
                fileName={media?.name}
                onChange={setMedia}
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Ja media URL (optional)</FieldLabel>
              <Input
                value={mediaUrl}
                onChange={(e) => {
                  const v = e.target.value;
                  setMediaUrl(v);
                  if (ytId(v)) setType("video"); // YouTube link paste = khud Video Ad type chuno
                }}
                placeholder={type === "video" ? "https://.../ad.mp4 ja YouTube link" : "https://.../banner.jpg"}
                inputMode="url"
              />
              <p className="text-xs text-amber-100/50">
                💡 <b className="text-amber-300">YouTube da link vi chalega</b> (youtu.be ja youtube.com/watch) — paste kitta ta Video Ad type khud chun liya jauga
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Click link (optional — jithe ad te click karge oh page khulega)</FieldLabel>
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://sponsor-website.com" inputMode="url" />
          </div>
          <Button
            onClick={submit}
            disabled={saving}
            data-testid="ad-submit"
            className="border-0 bg-gradient-to-r from-amber-400 to-orange-500 font-bold text-black hover:from-amber-300 hover:to-orange-400"
          >
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Ad add karo
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-400/20 bg-[oklch(0.21_0.018_60)] p-5">
        <h3 className="mb-3 text-base font-bold text-amber-100">Saare Ads ({ads.length})</h3>
        {loading ? (
          <EmptyRow text="Load ho raha hai..." />
        ) : ads.length === 0 ? (
          <EmptyRow text="Hale koi ad nahi." />
        ) : (
          <div className="nice-scroll max-h-96 space-y-2 overflow-y-auto pr-1" data-testid="ads-admin-list">
            {ads.map((ad) => (
              <div key={ad.id} className="flex items-center gap-3 rounded-xl border border-amber-400/10 bg-black/25 px-3 py-2.5">
                {ytId(ad.mediaUrl) ? (
                  <img src={ytThumb(ad.mediaUrl) || ""} alt="" className="h-10 w-16 shrink-0 rounded-lg object-cover" />
                ) : ad.type === "image" ? (
                  <img src={ad.mediaUrl} alt="" className="h-10 w-16 shrink-0 rounded-lg object-cover" />
                ) : (
                  <video src={ad.mediaUrl} muted preload="metadata" className="h-10 w-16 shrink-0 rounded-lg object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-amber-50">{ad.title}</p>
                  <p className="truncate text-xs text-amber-100/50">{ad.link || "koi click link nahi"}</p>
                </div>
                <Badge variant="outline" className="shrink-0 border-amber-400/30 text-[10px] uppercase text-amber-300">
                  {ad.type}
                </Badge>
                <Switch
                  checked={ad.active}
                  onCheckedChange={(v) => toggleActive(ad, v)}
                  aria-label={`${ad.title} active toggle`}
                />
                <DangerButton onConfirm={() => remove(ad.id)} label="Ad delete" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
