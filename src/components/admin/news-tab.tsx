"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Newspaper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { NewsItem } from "@/lib/types";
import { adminFetch } from "@/lib/client-auth";
import { DangerButton, EmptyRow, FieldLabel, FilePick } from "@/components/admin/shared";

const LANGS = [
  { value: "punjabi", label: "ਪੰਜਾਬੀ" },
  { value: "english", label: "English" },
];

export default function NewsTab() {
  const { toast } = useToast();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [language, setLanguage] = useState("punjabi");
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const imgRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/news", { cache: "no-store" });
      const data = (await res.json()) as NewsItem[];
      setItems(Array.isArray(data) ? data : []);
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
    if (!title.trim() || !content.trim()) {
      toast({ title: "Title te content dono bharo", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("content", content.trim());
      fd.append("language", language);
      if (image) fd.append("image", image);
      else if (imageUrl.trim()) fd.append("imageUrl", imageUrl.trim());
      const res = await adminFetch("/api/news", { method: "POST", body: fd });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error || "Save fail");
      }
      toast({ title: "📰 News add ho gayi!", description: `${language} news update ho gayi` });
      setTitle("");
      setContent("");
      setImage(null);
      setImageUrl("");
      if (imgRef.current) imgRef.current.value = "";
      load();
    } catch (e) {
      toast({ title: "News add nahi hoi", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const res = await adminFetch(`/api/news/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "News delete ho gayi" });
      load();
    } else {
      toast({ title: "Delete nahi hoya", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-400/20 bg-[oklch(0.21_0.018_60)] p-5">
        <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-amber-100">
          <Newspaper className="h-4.5 w-4.5 text-amber-400" /> Navi News Add Karo
        </h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <FieldLabel>Headline</FieldLabel>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Khabar da title..." data-testid="news-title" />
          </div>
          <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
            <div className="space-y-1.5">
              <FieldLabel>Bhasha</FieldLabel>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger data-testid="news-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Poora content</FieldLabel>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Khabar da poora detail likho..."
                rows={5}
                data-testid="news-content"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>Image (optional — PC ton)</FieldLabel>
              <FilePick accept="image/*" fileName={image?.name} onChange={setImage} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Ja Image URL (optional)</FieldLabel>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://.../photo.jpg" inputMode="url" />
            </div>
          </div>
          <Button
            onClick={submit}
            disabled={saving}
            data-testid="news-submit"
            className="border-0 bg-gradient-to-r from-amber-400 to-orange-500 font-bold text-black hover:from-amber-300 hover:to-orange-400"
          >
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            News publish karo
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-400/20 bg-[oklch(0.21_0.018_60)] p-5">
        <h3 className="mb-3 text-base font-bold text-amber-100">Saarian News ({items.length})</h3>
        {loading ? (
          <EmptyRow text="Load ho raha hai..." />
        ) : items.length === 0 ? (
          <EmptyRow text="Hale koi news nahi." />
        ) : (
          <div className="nice-scroll max-h-96 space-y-2 overflow-y-auto pr-1" data-testid="news-admin-list">
            {items.map((n) => (
              <div key={n.id} className="flex items-center gap-3 rounded-xl border border-amber-400/10 bg-black/25 px-3 py-2.5">
                {n.imageUrl ? (
                   
                  <img src={n.imageUrl} alt="" className="h-10 w-14 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg bg-amber-400/10">
                    <Newspaper className="h-4 w-4 text-amber-400/60" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-gur truncate text-sm font-semibold text-amber-50">{n.title}</p>
                  <p className="text-xs text-amber-100/50">
                    {new Date(n.addedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 border-amber-400/30 text-[10px] capitalize text-amber-300">
                  {n.language}
                </Badge>
                <DangerButton onConfirm={() => remove(n.id)} label="News delete" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
