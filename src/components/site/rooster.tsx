"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * CooCoo the Rooster — site mascot.
 * Sleeps at night, and every morning (5 AM - 11 AM) crows "ਕੁਕੜੂੰ ਕੂੰ! COO COO KDOOO!"
 * with a synthesized rooster crow (Web Audio). Click him anytime for a crow.
 * Auto-crow is calm: once on load + every 30 minutes (configurable via prop).
 */

const CROW_TEXT = "ਕੁਕੜੂੰ ਕੂੰ! COO COO KDOOO!";

function isMorningHour(d: Date): boolean {
  const h = d.getHours();
  return h >= 5 && h < 11;
}

export function useCrowSound() {
  const ctxRef = useRef<AudioContext | null>(null);

  return useCallback(() => {
    try {
      type WithWebkit = typeof window & { webkitAudioContext?: typeof AudioContext };
      const w = window as WithWebkit;
      const Ctx = w.AudioContext || w.webkitAudioContext;
      if (!Ctx) return;
      if (!ctxRef.current) ctxRef.current = new Ctx();
      const ctx = ctxRef.current;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});

      const master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);

      const now = ctx.currentTime;
      const syllable = (
        t0: number,
        f0: number,
        f1: number,
        dur: number,
        vol: number,
        type: OscillatorType
      ) => {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(f0, t0);
        osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 40), t0 + dur);

        const lfo = ctx.createOscillator();
        lfo.frequency.value = 21;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = f0 * 0.07;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(vol, t0 + 0.03);
        g.gain.setValueAtTime(vol, t0 + dur * 0.6);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = (f0 + f1) / 2;
        bp.Q.value = 1.6;

        osc.connect(g);
        g.connect(bp);
        bp.connect(master);
        osc.start(t0);
        osc.stop(t0 + dur + 0.05);
        lfo.start(t0);
        lfo.stop(t0 + dur + 0.05);
      };

      // "coo" — "coo" — "kdooooo!"
      syllable(now + 0.0, 620, 790, 0.16, 0.45, "square");
      syllable(now + 0.24, 700, 900, 0.16, 0.5, "square");
      syllable(now + 0.5, 980, 520, 0.75, 0.62, "sawtooth");
    } catch {
      // audio blocked or unsupported — stay silent, keep animation
    }
  }, []);
}

interface RoosterProps {
  className?: string;
  /** seconds between automatic morning crows (default 30 minutes) */
  autoCrowEverySec?: number;
}

export default function Rooster({ className = "", autoCrowEverySec = 1800 }: RoosterProps) {
  const [crowing, setCrowing] = useState(false);
  const [bubble, setBubble] = useState(false);
  const [morning, setMorning] = useState(false);
  const interactedRef = useRef(false);
  const crow = useCrowSound();
  const busyRef = useRef(false);

  const doCrow = useCallback(
    (withSound: boolean) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setCrowing(true);
      setBubble(true);
      if (withSound) crow();
      window.setTimeout(() => setCrowing(false), 1250);
      window.setTimeout(() => {
        setBubble(false);
        busyRef.current = false;
      }, 3000);
    },
    [crow]
  );

  // track user interaction so morning auto-crow can attempt sound
  useEffect(() => {
    const mark = () => {
      interactedRef.current = true;
    };
    window.addEventListener("pointerdown", mark, { once: true });
    window.addEventListener("keydown", mark, { once: true });
    return () => {
      window.removeEventListener("pointerdown", mark);
      window.removeEventListener("keydown", mark);
    };
  }, []);

  // morning detection every 30s
  useEffect(() => {
    const check = () => setMorning(isMorningHour(new Date()));
    check();
    const t = window.setInterval(check, 30000);
    return () => window.clearInterval(t);
  }, []);

  // welcome crow shortly after load when morning
  useEffect(() => {
    if (!morning) return;
    const t = window.setTimeout(() => doCrow(interactedRef.current), 2200);
    return () => window.clearTimeout(t);
     
  }, [morning]);

  // periodic morning crows
  useEffect(() => {
    if (!morning) return;
    const t = window.setInterval(() => doCrow(interactedRef.current), autoCrowEverySec * 1000);
    return () => window.clearInterval(t);
     
  }, [morning, autoCrowEverySec]);

  return (
    <div
      className={`fixed bottom-24 left-3 z-40 sm:bottom-[104px] sm:left-5 select-none ${className}`}
      data-testid="rooster"
    >
      {/* Speech bubble */}
      {bubble && (
        <div className="bubble-pop absolute bottom-[92%] left-[-6px] w-max max-w-[250px]">
          <div className="relative rounded-2xl border-2 border-amber-400 bg-amber-50 px-4 py-2.5 shadow-[0_10px_40px_rgba(var(--amb-rgb),0.35)]">
            <p className="font-gur text-center text-[15px] font-bold leading-snug text-amber-950">
              {CROW_TEXT}
            </p>
            <div className="absolute -bottom-2 left-9 h-4 w-4 rotate-45 border-b-2 border-r-2 border-amber-400 bg-amber-50" />
          </div>
        </div>
      )}

      {/* Floating crow notes */}
      {crowing && (
        <>
          <span className="crow-note absolute -top-3 right-0 text-lg">🎵</span>
          <span className="crow-note absolute top-2 -left-1 text-base [animation-delay:0.25s]">🎶</span>
          <span className="crow-note absolute top-0 left-10 text-lg [animation-delay:0.5s]">🎵</span>
        </>
      )}

      {/* The rooster himself */}
      <button
        type="button"
        aria-label="CooCoo murga — dabao te uh bolega"
        onClick={() => doCrow(true)}
        className={`block cursor-pointer outline-none transition-transform hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-amber-400 rounded-full ${
          crowing ? "rooster-crowing" : "rooster-idle"
        }`}
      >
        <svg
          width="118"
          height="118"
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-[0_8px_20px_rgba(0,0,0,0.55)]"
        >
          {/* ground shadow */}
          <ellipse cx="100" cy="182" rx="62" ry="9" fill="#000" opacity="0.35" />

          {/* tail feathers */}
          <path d="M62 118 C18 100 12 58 44 36 C36 78 44 98 66 110 Z" fill="#78350f" />
          <path d="M62 126 C14 122 2 80 28 52 C26 96 38 112 68 120 Z" fill="#b45309" />
          <path d="M66 134 C26 144 8 112 24 84 C28 116 44 126 70 130 Z" fill="#92400e" />
          <path d="M72 142 C40 156 22 132 34 108 C36 132 50 140 74 138 Z" fill="#d97706" />

          {/* legs */}
          <g stroke="#f59e0b" strokeWidth="6" strokeLinecap="round" fill="none">
            <path d="M92 152 L92 178" />
            <path d="M92 178 L82 188 M92 178 L100 190 M92 178 L104 184" />
            <path d="M116 154 L117 180" />
            <path d="M117 180 L107 190 M117 180 L125 192 M117 180 L129 186" />
          </g>

          {/* body */}
          <ellipse cx="105" cy="118" rx="50" ry="42" fill="#b45309" />
          <ellipse cx="118" cy="126" rx="30" ry="25" fill="#d97706" opacity="0.55" />

          {/* wing */}
          <path d="M84 112 Q112 94 134 112 Q118 138 88 130 Q80 122 84 112 Z" fill="#92400e" />
          <path d="M92 118 Q112 106 126 116" stroke="#78350f" strokeWidth="3" strokeLinecap="round" fill="none" />

          {/* neck */}
          <path d="M116 96 Q118 72 138 64 L154 84 Q146 104 128 110 Z" fill="#b45309" />

          {/* head group (tilts when crowing) */}
          <g style={{ transformOrigin: "138px 70px" }} transform={crowing ? "rotate(-9 138 70)" : undefined}>
            {/* head */}
            <circle cx="138" cy="66" r="24" fill="#b45309" />
            {/* comb */}
            <circle cx="126" cy="42" r="8" fill="#dc2626" />
            <circle cx="138" cy="35" r="9.5" fill="#ef4444" />
            <circle cx="150" cy="43" r="7" fill="#dc2626" />
            {/* beak (lower opens when crowing) */}
            <path d="M158 62 L184 69 L158 76 Z" fill="#f59e0b" />
            <g style={{ transformOrigin: "158px 76px" }} transform={crowing ? "rotate(16 158 76)" : undefined}>
              <path d="M158 76 L179 81 L158 87 Z" fill="#d97706" />
            </g>
            {/* wattle */}
            <ellipse cx="155" cy="90" rx="6" ry="9" fill="#ef4444" />
            {/* eye */}
            <circle cx="142" cy="60" r="5.5" fill="#fffbeb" />
            <circle cx="143.5" cy="60" r="2.7" fill="#1c1917" />
            <circle cx="144.6" cy="58.6" r="0.9" fill="#fff" />
          </g>

          {/* wing shine */}
          <path d="M95 108 Q112 100 124 108" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" opacity="0.5" fill="none" />
        </svg>
      </button>

      {/* Morning hint chip */}
      {!bubble && morning && (
        <div className="pointer-events-none absolute -top-8 left-[-6px] w-max rounded-full border border-amber-400/40 bg-black/60 px-3 py-1 text-[11px] font-semibold tracking-wide text-white/90 backdrop-blur">
          🌅 Saver hoi — murga jaag gaya!
        </div>
      )}
    </div>
  );
}
