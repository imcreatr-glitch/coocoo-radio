"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Image as ImageIcon, Megaphone, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionTitle } from "@/components/site/schedule";
import type { AdItem } from "@/lib/types";
import { ytEmbed, ytId } from "@/lib/types";

export default function AdsSection() {
  const [ads, setAds] = useState<AdItem[]>([]);

  useEffect(() => {
    fetch("/api/ads", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: AdItem[]) => {
        if (Array.isArray(data)) setAds(data.filter((a) => a.active));
      })
      .catch(() => {});
  }, []);

  // YouTube URL = video ad, chahe admin type "image" chun de (auto-detect = user galti-proof)
  const videoAds = ads.filter((a) => a.type === "video" || ytId(a.mediaUrl));
  const imageAds = ads.filter((a) => a.type !== "video" && !ytId(a.mediaUrl));

  if (ads.length === 0) return null;

  return (
    <section id="ads" className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <SectionTitle title="ਸਾਡੇ ਸਪਾਂਸਰ • Our Sponsors" sub="Image te video dono type de ishtihar — apna business promote karvana hove ta admin naal contact karo" />

      {imageAds.length > 0 && (
        <div className="mb-8 grid gap-4 md:grid-cols-2" data-testid="image-ads">
          {imageAds.map((ad, i) => {
            const inner = (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="group relative overflow-hidden rounded-2xl border border-amber-400/20 bg-[color:var(--bg-card)] shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
              >
                <div className="relative aspect-[8/3] w-full overflow-hidden">
                  { }
                  <img
                    src={ad.mediaUrl}
                    alt={ad.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="truncate text-sm font-semibold text-amber-100">{ad.title}</span>
                  <Badge variant="outline" className="shrink-0 gap-1 border-amber-400/30 text-[10px] text-amber-300">
                    <ImageIcon className="h-3 w-3" /> Ad
                  </Badge>
                </div>
              </motion.div>
            );
            return ad.link ? (
              <a
                key={ad.id}
                href={ad.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                {inner}
              </a>
            ) : (
              <div key={ad.id}>{inner}</div>
            );
          })}
        </div>
      )}

      {videoAds.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2" data-testid="video-ads">
          {videoAds.map((ad) => {
            const yt = ytEmbed(ad.mediaUrl);
            return (
            <div
              key={ad.id}
              className="overflow-hidden rounded-2xl border border-amber-400/20 bg-[color:var(--bg-card)] shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
            >
              <div className="relative aspect-video w-full bg-black">
                {yt ? (
                  <iframe
                    src={yt}
                    title={`${ad.title} video ad`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="h-full w-full"
                  />
                ) : (
                  <video
                    src={ad.mediaUrl}
                    controls
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-contain"
                    aria-label={`${ad.title} video ad`}
                  />
                )}
              </div>
              <div className="flex items-center justify-between p-3">
                <span className="flex items-center gap-2 truncate text-sm font-semibold text-amber-100">
                  <Megaphone className="h-4 w-4 shrink-0 text-amber-400" /> {ad.title}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className="gap-1 border-amber-400/30 text-[10px] text-amber-300">
                    <Video className="h-3 w-3" /> Video Ad
                  </Badge>
                  {ad.link && (
                    <a
                      href={ad.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Visit ${ad.title} sponsor link`}
                      className="text-amber-300 hover:text-amber-200"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
