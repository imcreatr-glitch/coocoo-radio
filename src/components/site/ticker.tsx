"use client";

import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import type { NewsItem } from "@/lib/types";

export default function Ticker() {
  const [items, setItems] = useState<NewsItem[]>([]);

  useEffect(() => {
    let alive = true;
    fetch("/api/news", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: NewsItem[]) => {
        if (alive && Array.isArray(data)) setItems(data.slice(0, 6));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const headlines = items.length
    ? items.map((n) => n.title)
    : ["CooCoo Radio te swagat hai — 24x7 live music, news te masti!"];

  // duplicated array for a seamless -50% marquee loop
  const loop = [...headlines, ...headlines];

  return (
    <div className="relative overflow-hidden border-y border-yellow-500/40 bg-yellow-400">
      <div className="flex items-stretch">
        {/* Breaking News label — dark black background, yellow megaphone + white text */}
        <div className="z-10 flex shrink-0 items-center gap-2 bg-zinc-950 px-3 py-2 sm:px-4">
          <Megaphone className="h-4 w-4 text-yellow-400" />
          <span className="hidden text-xs font-extrabold uppercase tracking-wider text-white sm:inline">
            Breaking News
          </span>
        </div>
        {/* Scrolling headlines — yellow background, dark text for max contrast */}
        <div className="relative flex-1 overflow-hidden py-2">
          <div className="marquee-track gap-10 pl-6">
            {loop.map((h, i) => (
              <span key={i} className="font-gur text-sm font-semibold text-zinc-900">
                📰 {h}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
