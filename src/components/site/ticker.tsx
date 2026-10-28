"use client";

import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import type { NewsItem } from "@/lib/types";
import { parseTickerStyle } from "@/lib/types";
import { usePlayer } from "@/lib/store";

export default function Ticker() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const settings = usePlayer((s) => s.settings);
  const tStyle = parseTickerStyle(settings.tickerStyle);

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
    <div
      className="relative overflow-hidden border-y border-black/25"
      style={{ backgroundColor: tStyle.bg }}
      data-testid="ticker"
    >
      <div className="flex items-stretch">
        {/* Breaking News label — admin-configurable background (default dark black) */}
        <div className="z-10 flex shrink-0 items-center gap-2 px-3 py-2 sm:px-4" style={{ backgroundColor: tStyle.labelBg }}>
          <Megaphone className="h-4 w-4" style={{ color: tStyle.bg }} />
          <span
            className="hidden text-xs font-extrabold uppercase tracking-wider sm:inline"
            style={{ color: tStyle.labelText }}
          >
            Breaking News
          </span>
        </div>
        {/* Scrolling headlines — admin-configurable background + text */}
        <div className="relative flex-1 overflow-hidden py-2">
          <div className="marquee-track gap-10 pl-6">
            {loop.map((h, i) => (
              <span key={i} className="font-gur text-sm font-semibold" style={{ color: tStyle.text }}>
                📰 {h}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
