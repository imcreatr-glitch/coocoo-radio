"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Newspaper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectionTitle } from "@/components/site/schedule";
import type { NewsItem } from "@/lib/types";

const LANG_TABS = [
  { key: "punjabi", label: "ਪੰਜਾਬੀ" },
  { key: "english", label: "English" },
] as const;

export default function NewsSection() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [lang, setLang] = useState<string>("punjabi");
  const [active, setActive] = useState<NewsItem | null>(null);

  useEffect(() => {
    fetch("/api/news", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: NewsItem[]) => {
        if (Array.isArray(data)) setItems(data);
      })
      .catch(() => {});
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { punjabi: 0, english: 0 };
    items.forEach((n) => {
      if (c[n.language] !== undefined) c[n.language] += 1;
    });
    return c;
  }, [items]);

  const filtered = items.filter((n) => n.language === lang);

  return (
    <section id="news" className="border-y border-amber-400/10 bg-[color:var(--bg-panel)]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <SectionTitle title="ਤਾਜ਼ਾ ਖ਼ਬਰਾਂ • Latest News" sub="Punjabi te English — dono bhashawan vich sab ton navi khabar" />

        <Tabs value={lang} onValueChange={setLang} className="mb-6">
          <TabsList className="border border-amber-400/25 bg-black/30 p-1">
            {LANG_TABS.map((t) => (
              <TabsTrigger
                key={t.key}
                value={t.key}
                data-testid={`news-tab-${t.key}`}
                className="font-gur gap-2 data-[state=active]:bg-gradient-to-br data-[state=active]:from-amber-400 data-[state=active]:to-orange-500 data-[state=active]:text-black"
              >
                {t.label}
                <span className="rounded-full bg-black/25 px-1.5 text-[10px] font-bold">
                  {counts[t.key] ?? 0}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-amber-400/30 bg-amber-400/5 p-10 text-center" data-testid="news-empty">
            <Newspaper className="mx-auto h-10 w-10 text-amber-400/50" />
            <p className="mt-3 font-gur text-amber-100/70">Is bhasha vich hale koi news nahi. Admin panel ton add karo!</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="news-grid">
            {filtered.map((item, i) => (
              <motion.article
                key={item.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="flex flex-col overflow-hidden rounded-2xl border border-amber-400/15 bg-[color:var(--bg-card)] transition-all hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(245,158,11,0.15)]"
                data-testid={`news-card-${i}`}
              >
                {item.imageUrl && (
                  <div className="aspect-[16/8] overflow-hidden bg-black/40">
                    { }
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-2 flex items-center gap-2 text-xs text-amber-300/70">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {new Date(item.addedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                  <h3 className="font-gur line-clamp-2 text-base font-bold leading-snug text-amber-50">
                    {item.title}
                  </h3>
                  <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-amber-100/65">
                    {item.content}
                  </p>
                  <div className="mt-4 flex items-center justify-between">
                    <Badge variant="outline" className="border-amber-400/30 bg-amber-400/5 text-[10px] uppercase tracking-wider text-amber-300">
                      {item.language}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setActive(item)}
                      className="text-amber-300 hover:bg-amber-400/10 hover:text-amber-200"
                    >
                      Puri khabar parho →
                    </Button>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-2xl border-amber-400/25 bg-[color:var(--bg-grad-end)]">
          <DialogHeader>
            <DialogTitle className="font-gur text-left text-lg leading-snug text-amber-50">
              {active?.title}
            </DialogTitle>
            <DialogDescription className="text-left text-xs text-amber-300/80">
              {active &&
                new Date(active.addedAt).toLocaleString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              {" • "}
              {active?.language}
            </DialogDescription>
          </DialogHeader>
          {active?.imageUrl && (
            <div className="overflow-hidden rounded-xl">
              { }
              <img src={active.imageUrl} alt={active.title} className="max-h-72 w-full object-cover" />
            </div>
          )}
          <p className="font-gur whitespace-pre-line text-[15px] leading-relaxed text-amber-100/85">
            {active?.content}
          </p>
        </DialogContent>
      </Dialog>
    </section>
  );
}
