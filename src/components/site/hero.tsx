"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Pause, Play, Radio, Sunrise, Tv } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePlayer } from "@/lib/store";
import { useNow } from "@/lib/use-now";
import { artistImageFor, isLiveOn, isOnAir, nowAmPm, parsePlayerStyle, ytId, ytThumb, type ShowItem } from "@/lib/types";

export function Equalizer({ playing, bars = 7, className = "" }: { playing: boolean; bars?: number; className?: string }) {
  const heights = useMemo(() => Array.from({ length: bars }, (_, i) => 0.35 + ((i * 37) % 65) / 100), [bars]);
  return (
    <div className={`flex h-8 items-end gap-1 ${className}`} aria-hidden="true">
      {heights.map((h, i) => (
        <span
          key={i}
          className={`eq-bar w-1.5 rounded-full bg-gradient-to-t from-orange-600 to-amber-300 ${playing ? "" : "!transform-none opacity-30"}`}
          style={{ height: `${h * 100}%`, animationDelay: `${i * 0.12}s`, animationDuration: `${0.7 + (i % 3) * 0.18}s` }}
        />
      ))}
    </div>
  );
}

export default function Hero({ shows }: { shows: ShowItem[] }) {
  const playing = usePlayer((s) => s.playing);
  const toggle = usePlayer((s) => s.toggle);
  const settings = usePlayer((s) => s.settings);
  const tracks = usePlayer((s) => s.tracks);
  const index = usePlayer((s) => s.index);

  // ON AIR NOW card ch admin di YouTube video (thumbnail -> click -> autoplay embed)
  const onAirVid = ytId(settings.onAirVideo || "");
  const [vidPlay, setVidPlay] = useState(false);

  const onAir = useMemo(() => {
    const now = new Date();
    return shows.filter((s) => isOnAir(s, now.getDay(), now.getHours() * 60 + now.getMinutes()));
  }, [shows]);

  // Gurbani live ON? Manual stream ya time-table window — dono check karda
  const nowT = useNow(30000);
  const liveOn = isLiveOn(settings, nowT);

  const currentTrack = tracks.length > 0 ? tracks[index % tracks.length] : null;
  const artistImg =
    currentTrack && !liveOn ? artistImageFor(settings.artistImages, currentTrack.artist) : null;
  const pStyle = parsePlayerStyle(settings.playerStyle);

  return (
    <section className="hero-bg relative overflow-hidden border-b border-amber-400/10">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[1.2fr_1fr] lg:py-12">
        {/* Left — compact spacing: dono frame (live card + ON AIR) pehli screen ch without scroll */}
        {/* Left */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col justify-center"
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge className="gap-1.5 border-0 bg-red-600 px-3 py-1 text-xs font-bold text-white">
              <span className="live-dot inline-block h-2 w-2 rounded-full bg-white" /> LIVE 24x7
            </Badge>
            <Badge variant="outline" className="gap-1 border-amber-400/40 bg-amber-400/10 text-amber-300">
              <Sunrise className="h-3 w-3" /> ਸਵੇਰੇ ਮੁਰਗਾ ਕੂਕਦਾ 🐓
            </Badge>
          </div>

          <h2 className="font-gur text-3xl font-extrabold leading-tight tracking-tight text-transparent sm:text-4xl lg:text-5xl">
            <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-orange-500 bg-clip-text">
              {settings.stationName}
            </span>
          </h2>
          <p className="font-gur mt-2 text-base text-amber-100/85 sm:text-lg">{settings.tagline}</p>
          <p className="mt-2 max-w-xl text-xs text-amber-100/60 sm:text-sm">
            Latest Punjabi te English music non-stop, fresh news updates, scheduled
            shows with YouTube videos — te saver saver murge da swagat!
          </p>

          {/* Live player card — vertical photo (jive video player) jado Gurbani live chaldi + photo set.
              Manual ON ya time-table window — dono vich dikhegi. Eh card vi play/pause button hai. */}
          {liveOn && settings.liveImage && (() => {
            const liveStateColor = playing ? pStyle.playColor : pStyle.pauseColor;
            return (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                onClick={toggle}
                data-testid="live-player-card"
                aria-label={playing ? "Live stream pause karo" : "Live stream chalao"}
                title={playing ? "Click = Pause" : "Click = Chalao"}
                className="relative mt-4 h-40 w-full max-w-[160px] cursor-pointer overflow-hidden rounded-xl shadow-[0_12px_36px_rgba(0,0,0,0.5)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                style={
                  liveStateColor
                    ? { border: `4px solid ${liveStateColor}`, boxShadow: `0 0 22px ${liveStateColor}80` }
                    : { border: "1px solid rgba(var(--amb-rgb),0.3)" }
                }
              >
                <img src={settings.liveImage} alt={settings.liveTitle || "Live"} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/20" />
                <span
                  className={`absolute inset-0 m-auto flex h-9 w-9 items-center justify-center rounded-full text-white backdrop-blur-[2px] ${
                    playing ? "bg-black/40" : "bg-black/60"
                  }`}
                >
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
                </span>
                <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 p-2">
                  <Badge className="live-dot gap-1 border-0 bg-red-600 px-1.5 py-0 text-[8px] font-bold text-white">
                    LIVE
                  </Badge>
                  <span className="truncate text-[10px] font-bold leading-tight text-white">{settings.liveTitle || "Darbar Sahib Live"}</span>
                  <span className="ml-auto flex shrink-0 items-center gap-0.5 font-mono text-[9px] font-bold text-white/90">
                    <Clock className="h-2.5 w-2.5" /> {nowAmPm(nowT)}
                  </span>
                  <Equalizer playing={playing} bars={3} className="h-2.5 shrink-0" />
                </div>
              </motion.div>
            );
          })()}

          <div className="mt-5 flex flex-wrap items-center gap-4">
            {(() => {
              // EK HI BUTTON: singer photo hove ta ohdi photo (play/pause icon naal),
              // nahi ta simple orange circle. Purana vakhra chhota button hata ditta —
              // hun sirf ik hi button hovega, photo hove ja na hove.
              const showLiveCard = liveOn && !!settings.liveImage;
              if (showLiveCard) return null; // live card khud hi button hai
              const img = !liveOn && pStyle.showImage ? artistImg : null;
              const stateColor = playing ? pStyle.playColor : pStyle.pauseColor;
              const ringStyle = stateColor
                ? { border: `4px solid ${stateColor}`, boxShadow: `0 0 22px ${stateColor}80` }
                : img
                  ? { border: "1px solid rgba(var(--amb-rgb),0.4)" }
                  : undefined;
              return (
                <button
                  type="button"
                  onClick={toggle}
                  data-testid="hero-play"
                  aria-label={playing ? "Pause radio" : "Play radio"}
                  title={playing ? "Click = Pause" : "Click = Chalao"}
                  className="relative shrink-0 rounded-full outline-none transition-all duration-300 hover:scale-105 active:scale-95"
                  style={ringStyle}
                >
                  {img ? (
                    <>
                      <img
                        src={img}
                        alt={currentTrack?.artist || "Singer"}
                        className="h-20 w-20 rounded-full border-2 border-black/40 object-cover sm:h-24 sm:w-24"
                      />
                      <span
                        className={`absolute inset-0 m-auto flex h-9 w-9 items-center justify-center rounded-full text-white backdrop-blur-[2px] ${
                          playing ? "bg-black/40" : "bg-black/60"
                        }`}
                      >
                        {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
                      </span>
                    </>
                  ) : (
                    <span
                      className={`flex h-20 w-20 items-center justify-center rounded-full sm:h-24 sm:w-24 ${
                        stateColor
                          ? "text-white"
                          : "glow-pulse bg-gradient-to-br from-amber-400 to-orange-600 text-black"
                      }`}
                      style={stateColor ? { backgroundColor: stateColor } : undefined}
                    >
                      {playing ? <Pause className="h-8 w-8" /> : <Play className="ml-1 h-8 w-8" />}
                    </span>
                  )}
                </button>
              );
            })()}
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/80">
                {playing ? "Now Playing" : "Tap to tune in"}
              </p>
              {liveOn ? (
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm font-medium text-amber-50" data-testid="hero-track">
                  <span>🔴 {settings.liveTitle || "Darbar Sahib Live"}</span>
                  <span className="flex items-center gap-1 font-mono text-xs font-bold text-amber-300">
                    <Clock className="h-3 w-3" /> {nowAmPm(nowT)}
                  </span>
                </p>
              ) : currentTrack ? (
                <div className="mt-1.5" data-testid="hero-track">
                  <p className="text-sm font-bold leading-snug text-amber-50">🎵 {currentTrack.title}</p>
                  {currentTrack.artist && (
                    <p className="text-xs leading-snug text-amber-300">🎤 {currentTrack.artist}</p>
                  )}
                </div>
              ) : (
                <p className="mt-0.5 text-sm font-medium text-amber-50">Auto-Pilot 24x7 playlist ready</p>
              )}
            </div>
            <Equalizer playing={playing} bars={9} className="ml-auto hidden sm:flex" />
          </div>
        </motion.div>

        {/* Right — ON AIR card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="flex items-center"
        >
          <div className="relative w-full overflow-hidden rounded-2xl border border-amber-400/25 bg-gradient-to-br from-[color:var(--bg-grad-start)] to-[color:var(--bg-grad-end)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="live-dot h-2.5 w-2.5 rounded-full bg-red-500" />
                <span className="text-xs font-bold uppercase tracking-widest text-red-400">
                  {onAir.length > 0 ? "On Air Now" : "Auto-Pilot Mode"}
                </span>
              </div>
              <div
                className={`relative h-12 w-12 rounded-full border-4 border-amber-900/70 bg-gradient-to-br from-amber-500 to-orange-700 ${playing ? "spin-slow" : ""}`}
                aria-hidden="true"
              >
                <span className="absolute inset-0 m-auto h-3 w-3 rounded-full bg-amber-950" />
              </div>
            </div>

            {onAirVid && (
              <div
                className="relative overflow-hidden rounded-xl border border-amber-400/20 bg-black"
                data-testid="onair-video"
              >
                {vidPlay ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${onAirVid}?autoplay=1&rel=0&playsinline=1`}
                    title="On Air video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="aspect-video w-full"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setVidPlay(true)}
                    aria-label="Video chalao"
                    data-testid="onair-video-play"
                    className="group relative block w-full cursor-pointer"
                  >
                    <img
                      src={ytThumb(settings.onAirVideo || "") || ""}
                      alt="On Air video thumbnail"
                      className="aspect-video w-full object-cover"
                    />
                    <span className="absolute inset-0 bg-black/25 transition group-hover:bg-black/10" />
                    <span className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-600/90 text-white shadow-[0_4px_24px_rgba(220,38,38,0.6)] transition group-hover:scale-110">
                      <Play className="ml-1 h-7 w-7" />
                    </span>
                    <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg bg-black/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                      <Play className="h-3 w-3" /> Video chalao
                    </span>
                  </button>
                )}
              </div>
            )}

            {onAir.length > 0 ? (
              <div className="mt-3 space-y-3" data-testid="on-air-card">
                {onAir.slice(0, 2).map((show) => (
                  <div key={show.id} className="rounded-xl border border-amber-400/20 bg-black/25 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-bold text-amber-50">{show.title}</h3>
                        {show.description && (
                          <p className="font-gur mt-1 line-clamp-2 text-sm text-amber-100/70">{show.description}</p>
                        )}
                      </div>
                      <Badge className="shrink-0 border-0 bg-amber-400 font-mono text-xs font-bold text-black">
                        {show.startTime}–{show.endTime}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-amber-400/20 bg-black/25 p-4" data-testid="on-air-card">
                <h3 className="text-lg font-bold text-amber-50">Non-stop 24x7 Auto-Pilot</h3>
                <p className="mt-1 text-sm text-amber-100/70">
                  Koi scheduled show nahi — playlist apne aap chal rahi hai, din raat bina ruke.
                </p>
              </div>
            )}

            <div className="mt-3 flex items-center gap-2 text-xs text-amber-200/60">
              <Tv className="h-3.5 w-3.5" />
              Poora schedule vekhan layi thale scroll karo
              <Radio className="ml-auto h-3.5 w-3.5" />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
