"use client";

import { Heart, Radio } from "lucide-react";
import { usePlayer } from "@/lib/store";

export default function Footer() {
  const stationName = usePlayer((s) => s.settings.stationName);

  return (
    <footer className="mt-auto border-t border-amber-400/15 bg-[color:var(--bg-footer)] pt-10 [padding-bottom:calc(theme(space.28)+env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 text-xl">
              🐓
            </div>
            <div>
              <p className="font-bold text-amber-50">{stationName}</p>
              <p className="font-gur text-xs text-amber-300/70">
                ਹਰ ਪੱਲ ਤੁਹਾਡੇ ਨਾਲ • Punjabi • English
              </p>
            </div>
          </div>

          <nav aria-label="Footer sections" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-amber-100/70">
            <a href="#schedule" className="hover:text-amber-300">Schedule</a>
            <a href="#news" className="hover:text-amber-300">News</a>
            <a href="#listener" className="hover:text-amber-300">Messages</a>
            <a href="#ads" className="hover:text-amber-300">Sponsors</a>
          </nav>

          <div className="flex items-center gap-1.5 text-xs text-amber-200/50">
            <Radio className="h-3.5 w-3.5" />
            Streaming 24x7 te
            <Heart className="h-3.5 w-3.5 text-red-500" />
            naal
          </div>
        </div>

        <div className="mt-8 border-t border-amber-400/10 pt-5 text-center text-xs text-amber-100/40">
          © {new Date().getFullYear()} {stationName} • Sare haq haqdaaran kol · ਸਾਰੇ ਹੱਕ ਰਾਖਵੇਂ
        </div>
      </div>
    </footer>
  );
}
