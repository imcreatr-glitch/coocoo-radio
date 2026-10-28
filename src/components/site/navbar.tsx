"use client";

import { useEffect, useState } from "react";
import { Lock, Radio, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Navbar({
  stationName,
  onAdminOpen,
}: {
  stationName: string;
  onAdminOpen: () => void;
}) {
  const [time, setTime] = useState<string>("");
  const [tz, setTz] = useState<string>("");

  // Green wala clock VISITOR de desh da time vekhda (new Date() = local).
  // Naal chhota label: India ch "Punjab time", hor desh ch "Tuhada local".
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setTime(
        d.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
      setTz(
        d.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }) ===
          d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
          ? "Punjab time"
          : "Tuhada local"
      );
    };
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-amber-400/15 bg-[color:var(--bg-base)]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 text-xl shadow-[0_4px_16px_rgba(var(--amb-rgb),0.4)]">
            🐓
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-bold tracking-tight text-amber-50 sm:text-lg">
                {stationName}
              </h1>
              <Badge className="live-dot hidden gap-1 border-0 bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white sm:inline-flex">
                <Radio className="h-3 w-3" /> LIVE 24x7
              </Badge>
            </div>
            <p className="font-gur hidden text-xs text-amber-300/80 sm:block">
              ਪੰਜਾਬੀ • English
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <span
            className="hidden flex-col items-end rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 font-mono text-sm tabular-nums text-amber-300 md:flex"
            aria-label="current time"
          >
            <span>{time || "--:--:--"}</span>
            <span className="font-sans text-[9px] font-semibold uppercase tracking-wider text-amber-300/60">{tz}</span>
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={onAdminOpen}
            className="gap-1.5 border-amber-400/40 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20 hover:text-amber-100"
            data-testid="admin-open"
          >
            <Lock className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Admin</span>
            <ShieldCheck className="h-3.5 w-3.5 sm:hidden" />
          </Button>
        </div>
      </div>
    </header>
  );
}
