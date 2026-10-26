"use client";

import { useEffect, useState } from "react";
import { Music2, Pause, Play, Radio, SkipBack, SkipForward, Square, Volume2, VolumeX, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Equalizer } from "@/components/site/hero";
import { usePlayer } from "@/lib/store";
import { adminFetch, getToken } from "@/lib/client-auth";
import { artistImageFor, parseStreamLibrary } from "@/lib/types";

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PlayerBar() {
  const playing = usePlayer((s) => s.playing);
  const toggle = usePlayer((s) => s.toggle);
  const next = usePlayer((s) => s.next);
  const prev = usePlayer((s) => s.prev);
  const tracks = usePlayer((s) => s.tracks);
  const index = usePlayer((s) => s.index);
  const settings = usePlayer((s) => s.settings);
  const volume = usePlayer((s) => s.volume);
  const setVolume = usePlayer((s) => s.setVolume);
  const bootstrapped = usePlayer((s) => s.bootstrapped);
  const initAudio = usePlayer((s) => s.initAudio);

  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [tuning, setTuning] = useState(false);
  // radio-style: visitors only get play/pause + volume; skip buttons are admin-only
  const [isAdmin, setIsAdmin] = useState(false);
  const isStream = settings.liveMode === "stream" && !!settings.liveUrl;
  const current = tracks.length > 0 ? tracks[index % tracks.length] : null;
  const artistImg = !isStream && current ? artistImageFor(settings.artistImages, current.artist) : null;
  const canGurbani = !!settings.liveUrl || parseStreamLibrary(settings.streamLibrary).length > 0;

  /** admin one-click: Gurbani ON (stream) / OFF (songs auto-pilot) */
  const gurbaniToggle = async () => {
    if (tuning) return;
    setTuning(true);
    try {
      const s = usePlayer.getState();
      const toStream = s.settings.liveMode !== "stream";
      let liveUrl = s.settings.liveUrl;
      if (toStream && !liveUrl) {
        liveUrl = parseStreamLibrary(s.settings.streamLibrary)[0]?.url || "";
        if (!liveUrl) return;
      }
      await adminFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveMode: toStream ? "stream" : "auto", liveUrl }),
      });
      await s.refreshContext();
    } catch {
      // ignore — button just stays as-is
    } finally {
      setTuning(false);
    }
  };

  // ensure audio element exists on mount
  useEffect(() => {
    initAudio();
  }, [initAudio]);

  useEffect(() => {
    setIsAdmin(!!getToken());
  }, []);

  // subscribe to audio time updates (resets automatically on new track)
  useEffect(() => {
    const audio = usePlayer.getState().audio;
    if (!audio) return;
    const onTime = () => setElapsed(audio.currentTime);
    const onLoaded = () => setElapsed(0);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
    };
  }, []);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-amber-400/25 bg-[oklch(0.17_0.015_60)]/95 backdrop-blur-md [padding-bottom:env(safe-area-inset-bottom)]"
      data-testid="player-bar"
    >
      <div className="mx-auto flex h-[76px] max-w-7xl items-center gap-3 px-3 sm:gap-4 sm:px-6">
        {/* Play controls */}
        <button
          type="button"
          onClick={toggle}
          data-testid="player-toggle"
          aria-label={playing ? "Pause radio" : "Play radio"}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-black transition-transform hover:scale-105 active:scale-95 ${
            playing
              ? "bg-gradient-to-br from-amber-400 to-orange-600 shadow-[0_0_18px_rgba(245,158,11,0.5)]"
              : "bg-gradient-to-br from-amber-300 to-orange-500"
          }`}
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
        </button>

        {isAdmin && !isStream && tracks.length > 1 && (
          <div className="hidden shrink-0 items-center gap-1 sm:flex">
            <button
              type="button"
              onClick={prev}
              aria-label="Pichla song"
              className="rounded-full p-2 text-amber-200/80 transition hover:bg-amber-400/10 hover:text-amber-100"
            >
              <SkipBack className="h-4.5 w-4.5" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Agla song"
              className="rounded-full p-2 text-amber-200/80 transition hover:bg-amber-400/10 hover:text-amber-100"
            >
              <SkipForward className="h-4.5 w-4.5" />
            </button>
          </div>
        )}

        {isAdmin && canGurbani && (
          <button
            type="button"
            onClick={gurbaniToggle}
            aria-label={isStream ? "Gurbani band karo — songs chalu" : "Gurbani chalao"}
            title={isStream ? "Gurbani BAND karo (songs chalu)" : "Gurbani ON karo"}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition ${
              isStream
                ? "border-red-400/50 bg-red-500/20 text-red-300"
                : "border-amber-400/30 text-amber-200/80 hover:bg-amber-400/10"
            }`}
          >
            {isStream ? <Square className="h-3.5 w-3.5" /> : <Radio className="h-4 w-4" />}
          </button>
        )}

        {/* Track info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {isStream ? (
              <Badge className="live-dot shrink-0 gap-1 border-0 bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                <Wifi className="h-3 w-3" /> LIVE STREAM
              </Badge>
            ) : (
              <Badge variant="outline" className="shrink-0 border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                Auto-Pilot 24x7
              </Badge>
            )}
            <Equalizer playing={playing} bars={4} className="hidden h-5 sm:flex" />
          </div>
          {isStream ? (
            <p className="mt-0.5 truncate text-sm font-semibold text-amber-50" data-testid="player-track">
              🔴 {settings.liveTitle || "Darbar Sahib Live"}
            </p>
          ) : current ? (
            <div className="mt-0.5 flex items-center gap-2" data-testid="player-track">
              {artistImg && (
                <button
                  type="button"
                  onClick={toggle}
                  aria-label={playing ? "Pause karo" : "Chalao"}
                  title={playing ? "Pause (hari ring = chal raha)" : "Chalao (laal ring = rukya)"}
                  className={`shrink-0 rounded-full outline-none ring-2 transition-all duration-300 active:scale-95 ${
                    playing ? "ring-green-400" : "ring-red-500"
                  }`}
                >
                  <img
                    src={artistImg}
                    alt={current.artist || "Singer"}
                    className="h-9 w-9 rounded-full border border-black/40 object-cover"
                  />
                </button>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight text-amber-50">🎵 {current.title}</p>
                {current.artist && (
                  <p className="truncate text-xs leading-tight text-amber-200/75">🎤 {current.artist}</p>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-0.5 truncate text-sm font-semibold text-amber-50" data-testid="player-track">
              {bootstrapped
                ? "Playlist khali hai — Admin ton songs add karo"
                : "Radio load ho rahi hai..."}
            </p>
          )}
        </div>

        {/* elapsed */}
        {playing && (
          <span className="hidden shrink-0 font-mono text-xs tabular-nums text-amber-300/70 md:block">
            {isStream ? "ON AIR" : fmt(elapsed)}
          </span>
        )}

        {/* volume */}
        <div className="hidden w-32 shrink-0 items-center gap-2 md:flex">
          <button
            type="button"
            onClick={() => {
              const next = !muted;
              setMuted(next);
              setVolume(next ? 0 : 0.85);
            }}
            aria-label={muted ? "Unmute" : "Mute"}
            className="text-amber-200/80 hover:text-amber-100"
          >
            {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <Slider
            value={[Math.round(volume * 100)]}
            max={100}
            step={1}
            onValueChange={(v) => {
              setVolume((v[0] ?? 80) / 100);
              setMuted(false);
            }}
            aria-label="Volume"
            className="flex-1"
          />
        </div>

        {/* track count */}
        {!isStream && tracks.length > 0 && (
          <span className="hidden shrink-0 items-center gap-1 rounded-lg border border-amber-400/20 bg-amber-400/5 px-2 py-1 font-mono text-[11px] text-amber-300/80 lg:flex">
            <Music2 className="h-3 w-3" />
            {index % tracks.length + 1}/{tracks.length}
          </span>
        )}
      </div>
    </div>
  );
}
