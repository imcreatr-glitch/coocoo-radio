"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Clock, ExternalLink, PlayCircle, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DAY_SHORT, isOnAir, ytId, ytThumb, type ShowItem } from "@/lib/types";

function SectionTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3">
        <h2 className="font-gur text-2xl font-bold text-amber-100 sm:text-3xl">{title}</h2>
        <div className="section-title-line mt-1 flex-1" />
      </div>
      <p className="mt-1 text-sm text-amber-100/60">{sub}</p>
    </div>
  );
}

export { SectionTitle };

export default function ScheduleSection() {
  const [shows, setShows] = useState<ShowItem[]>([]);
  const [today, setToday] = useState(1); // default Monday until client mount
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [active, setActive] = useState<ShowItem | null>(null);
  const [nowTick, setNowTick] = useState(0);

  useEffect(() => {
    fetch("/api/shows", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: ShowItem[]) => {
        if (Array.isArray(data)) setShows(data);
      })
      .catch(() => {});
    const t0 = window.setTimeout(() => {
      const d = new Date();
      setToday(d.getDay());
      setSelectedDay(d.getDay());
    }, 0);
    const t = window.setInterval(() => setNowTick((n) => n + 1), 60000);
    return () => {
      window.clearTimeout(t0);
      window.clearInterval(t);
    };
  }, []);

  const dayShows = useMemo(() => {
    const day = selectedDay ?? today;
    return shows
      .filter((s) => s.days.split(",").map(Number).includes(day))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
     
  }, [shows, selectedDay, today]);

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const currentDay = new Date().getDay();

  return (
    <section id="schedule" className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <SectionTitle title="ਸ਼ੋਅ ਟਾਈਮਿੰਗ • Show Schedule" sub="Har show da time fix — YouTube video naal. Je show chal raha hove, ON AIR badge vekho!" />

      {/* Day tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1 nice-scroll" data-testid="day-tabs">
        {DAY_SHORT.map((d, i) => (
          <button
            key={d}
            type="button"
            onClick={() => setSelectedDay(i)}
            className={`shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold transition-all ${
              (selectedDay ?? today) === i
                ? "border-amber-400 bg-gradient-to-br from-amber-400 to-orange-500 text-black shadow-[0_4px_18px_rgba(245,158,11,0.4)]"
                : "border-amber-400/25 bg-amber-400/5 text-amber-200/80 hover:border-amber-400/50 hover:bg-amber-400/10"
            }`}
          >
            {d}
            {i === today && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-red-500" title="Aaj" />}
          </button>
        ))}
      </div>

      {dayShows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-amber-400/30 bg-amber-400/5 p-10 text-center" data-testid="schedule-empty">
          <CalendarDays className="mx-auto h-10 w-10 text-amber-400/50" />
          <p className="mt-3 font-gur text-amber-100/70">Is din koi show schedule nahi hai. Admin ton shows add karwao!</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="schedule-grid">
          {dayShows.map((show, i) => {
            const onAir = isOnAir(show, currentDay, nowMin) && nowTick >= 0;
            const thumb = ytThumb(show.youtubeUrl);
            const vid = ytId(show.youtubeUrl);
            return (
              <motion.article
                key={show.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className={`group overflow-hidden rounded-2xl border bg-[oklch(0.21_0.018_60)] transition-all hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(245,158,11,0.18)] ${
                  onAir ? "border-red-500/60 shadow-[0_0_24px_rgba(239,68,68,0.25)]" : "border-amber-400/15"
                }`}
                data-testid={`show-card-${i}`}
              >
                <div className="relative aspect-video overflow-hidden bg-black/50">
                  {thumb ? (
                     
                    <img
                      src={thumb}
                      alt={`${show.title} video thumbnail`}
                      className="h-full w-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Radio className="h-10 w-10 text-amber-400/40" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                  <button
                    type="button"
                    onClick={() => setActive(show)}
                    className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100"
                    aria-label={`Play ${show.title} YouTube video`}
                  >
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/95 text-black shadow-xl">
                      <PlayCircle className="h-8 w-8" />
                    </span>
                  </button>
                  <div className="absolute left-3 top-3 flex gap-2">
                    {onAir && (
                      <Badge className="live-dot gap-1 border-0 bg-red-600 text-[10px] font-bold text-white">
                        <Radio className="h-3 w-3" /> ON AIR
                      </Badge>
                    )}
                  </div>
                  <div className="absolute bottom-2 left-3 flex items-center gap-1.5 text-xs font-semibold text-amber-200">
                    <Clock className="h-3.5 w-3.5" />
                    {show.startTime} – {show.endTime}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="truncate text-base font-bold text-amber-50">{show.title}</h3>
                  {show.description && (
                    <p className="font-gur mt-1 line-clamp-2 text-sm text-amber-100/65">{show.description}</p>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <Badge variant="outline" className="border-amber-400/30 bg-amber-400/5 font-mono text-[10px] text-amber-300">
                      {show.days
                        .split(",")
                        .map((d) => DAY_SHORT[Number(d)])
                        .join(" ")}
                    </Badge>
                    {vid && (
                      <a
                        href={`https://www.youtube.com/watch?v=${vid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-semibold text-amber-300 hover:text-amber-200"
                      >
                        YouTube <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}

      {/* YouTube player dialog */}
      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-3xl border-amber-400/25 bg-[oklch(0.19_0.02_60)] p-3 sm:p-4">
          <DialogHeader className="px-1 pb-2">
            <DialogTitle className="font-gur text-left text-amber-50">{active?.title}</DialogTitle>
            <DialogDescription className="text-left font-mono text-xs text-amber-300/80">
              {active?.startTime} – {active?.endTime} • {active ? DAY_SHORT[Number(active.days.split(",")[0])] : ""}
            </DialogDescription>
          </DialogHeader>
          {active && ytId(active.youtubeUrl) && (
            <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
              <iframe
                key={ytId(active.youtubeUrl) || ""}
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${ytId(active.youtubeUrl)}?autoplay=1&rel=0`}
                title={`${active.title} YouTube video`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          )}
          <div className="flex justify-end px-1 pt-2">
            <Button size="sm" variant="outline" onClick={() => setActive(null)} className="border-amber-400/40 text-amber-200">
              Band karo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
