"use client";

import { create } from "zustand";
import type { Song, StationSettings } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";

interface PlayerState {
  audio: HTMLAudioElement | null;
  tracks: Song[];
  index: number;
  playing: boolean;
  settings: StationSettings;
  volume: number;
  currentSrc: string | null;
  bootstrapped: boolean;

  initAudio: () => void;
  refreshContext: () => Promise<void>;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  setVolume: (v: number) => void;
  playIndex: (i: number) => void;
  playSong: (id: string) => void;
}

function loadSrc(state: PlayerState): string | null {
  const { settings, tracks, index } = state;
  if (settings.liveMode === "stream" && settings.liveUrl) return settings.liveUrl;
  if (tracks.length === 0) return null;
  return tracks[((index % tracks.length) + tracks.length) % tracks.length].url;
}

export const usePlayer = create<PlayerState>((set, get) => ({
  audio: null,
  tracks: [],
  index: 0,
  playing: false,
  settings: DEFAULT_SETTINGS,
  volume: 0.85,
  currentSrc: null,
  bootstrapped: false,

  initAudio: () => {
    const existing = get().audio;
    if (existing) return;
    const audio = new Audio();
    audio.preload = "auto";
    audio.volume = get().volume;
    const state = get();
    const src = loadSrc(state);
    if (src) {
      audio.src = src;
      set({ currentSrc: src });
    }
    audio.addEventListener("ended", () => {
      // 24x7 auto-pilot: loop the playlist forever
      const s = get();
      if (s.settings.liveMode === "stream") return;
      s.next();
      const after = get();
      if (after.audio && after.currentSrc) {
        after.audio.src = after.currentSrc;
        after.audio.play().catch(() => {});
      }
    });
    audio.addEventListener("play", () => set({ playing: true }));
    audio.addEventListener("pause", () => set({ playing: false }));
    set({ audio });
  },

  refreshContext: async () => {
    try {
      const [settingsRes, songsRes] = await Promise.all([
        fetch("/api/settings", { cache: "no-store" }),
        fetch("/api/songs", { cache: "no-store" }),
      ]);
      const settings = (await settingsRes.json()) as StationSettings;
      const tracks = (await songsRes.json()) as Song[];
      const prevSrc = get().currentSrc;
      const wasPlaying = get().playing;
      set({ settings, tracks, bootstrapped: true });
      const audio = get().audio;
      if (!audio) return;
      const src = loadSrc(get());
      // only swap source if nothing loaded yet or mode changed to stream
      if (src && !prevSrc) {
        audio.src = src;
        set({ currentSrc: src });
        if (wasPlaying) audio.play().catch(() => {});
      } else if (src && prevSrc && get().settings.liveMode === "stream" && src !== prevSrc) {
        audio.src = src;
        set({ currentSrc: src });
        audio.play().catch(() => {});
      }
      if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
        const cur = get().tracks[get().index];
        if (cur) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: cur.title,
            artist: cur.artist || get().settings.stationName,
            album: get().settings.stationName,
          });
        }
      }
    } catch {
      // ignore network errors silently
    }
  },

  play: () => {
    get().initAudio();
    const { audio, tracks, settings } = get();
    if (!audio) return;
    let src = loadSrc(get());
    if (!src) {
      if (settings.liveMode === "auto" && tracks.length === 0) {
        // no songs yet
      }
      return;
    }
    if (audio.src !== new URL(src, window.location.href).href) {
      audio.src = src;
      set({ currentSrc: src, audio });
    }
    audio.play().catch(() => {});
  },

  pause: () => {
    const { audio } = get();
    audio?.pause();
  },

  toggle: () => {
    const { playing, pause, play } = get();
    if (playing) pause();
    else play();
  },

  next: () => {
    const { tracks, index, settings } = get();
    if (settings.liveMode === "stream" || tracks.length === 0) return;
    const newIndex = (index + 1) % tracks.length;
    set({ index: newIndex });
    const { audio, playing } = get();
    const src = loadSrc(get());
    if (audio && src) {
      audio.src = src;
      set({ currentSrc: src });
      if (playing) audio.play().catch(() => {});
    }
  },

  prev: () => {
    const { tracks, index, settings } = get();
    if (settings.liveMode === "stream" || tracks.length === 0) return;
    const newIndex = (index - 1 + tracks.length) % tracks.length;
    set({ index: newIndex });
    const { audio, playing } = get();
    const src = loadSrc(get());
    if (audio && src) {
      audio.src = src;
      set({ currentSrc: src });
      if (playing) audio.play().catch(() => {});
    }
  },

  setVolume: (v: number) => {
    const { audio } = get();
    if (audio) audio.volume = v;
    set({ volume: v });
  },

  playIndex: (i: number) => {
    const { tracks } = get();
    if (i < 0 || i >= tracks.length) return;
    set({ index: i });
    get().play();
  },

  playSong: (id: string) => {
    const { tracks } = get();
    const i = tracks.findIndex((t) => t.id === id);
    if (i >= 0) get().playIndex(i);
  },
}));
