"use client";

import { create } from "zustand";
import type { Song, StationSettings } from "@/lib/types";
import { DEFAULT_SETTINGS, isLiveOn, nowIST } from "@/lib/types";

interface PlayerState {
  audio: HTMLAudioElement | null;
  tracks: Song[]; // ACTIVE queue: admin playlist order when set, else all songs
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
  playSongNow: (song: Song) => void;
}

/** Order songs by the admin's saved live playlist (JSON ids). Fallback: all songs. */
function buildQueue(settings: StationSettings, songs: Song[]): Song[] {
  const raw = (settings.playlist || "").trim();
  if (!raw) return songs;
  try {
    const ids = JSON.parse(raw) as string[];
    if (!Array.isArray(ids) || ids.length === 0) return songs;
    const byId = new Map(songs.map((s) => [s.id, s]));
    const queue = ids.map((id) => byId.get(id)).filter((s): s is Song => !!s);
    return queue.length > 0 ? queue : songs;
  } catch {
    return songs;
  }
}

function loadSrc(state: PlayerState): string | null {
  const { settings, tracks, index } = state;
  // Manual stream jeet + Gurbani time-table window vich vi live chalugi
  if (isLiveOn(settings, nowIST()) && settings.liveUrl) return settings.liveUrl;
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
      // 24x7 auto-pilot: loop the live queue forever (live stream chaldi khatam nahi hundi)
      const s = get();
      if (isLiveOn(s.settings, nowIST())) return;
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

    // Gurbani time-table tick (30s) — window shuru/bandi hove te source auto-swap
    // (user play kar rya hove ta gurbani/songs apne aap switch ho jaande ne)
    setInterval(() => {
      const s = get();
      if (!s.audio || !s.currentSrc) return;
      const src = loadSrc(s);
      if (!src || src === s.currentSrc) return;
      s.audio.src = src;
      set({ currentSrc: src });
      if (s.playing) s.audio.play().catch(() => {});
    }, 30000);
  },

  refreshContext: async () => {
    try {
      const [settingsRes, songsRes] = await Promise.all([
        fetch("/api/settings", { cache: "no-store" }),
        fetch("/api/songs", { cache: "no-store" }),
      ]);
      const settings = (await settingsRes.json()) as StationSettings;
      const songs = (await songsRes.json()) as Song[];
      const prevSrc = get().currentSrc;
      const wasPlaying = get().playing;
      const ordered = buildQueue(settings, Array.isArray(songs) ? songs : []);
      set({ settings, tracks: ordered, bootstrapped: true });
      const audio = get().audio;
      if (!audio) return;
      const src = loadSrc(get());
      // only swap source if nothing loaded yet or mode changed to stream
      if (src && !prevSrc) {
        audio.src = src;
        set({ currentSrc: src });
        if (wasPlaying) audio.play().catch(() => {});
      } else if (src && prevSrc && isLiveOn(get().settings, nowIST()) && src !== prevSrc) {
        // mode flipped to live (manual ON ya schedule window shuru) — swap + chalao
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
    const { audio, settings } = get();
    if (!audio) return;
    const src = loadSrc(get());
    if (!src) return;
    if (audio.src !== new URL(src, window.location.href).href) {
      audio.src = src;
      set({ currentSrc: src });
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
    const { tracks, index } = get();
    if (isLiveOn(get().settings, nowIST()) || tracks.length === 0) return;
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
    const { tracks, index } = get();
    if (isLiveOn(get().settings, nowIST()) || tracks.length === 0) return;
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

  /** Play any song immediately; if it is not in the live queue, add it to the end first. */
  playSongNow: (song: Song) => {
    const { tracks } = get();
    const i = tracks.findIndex((t) => t.id === song.id);
    if (i >= 0) {
      get().playIndex(i);
      return;
    }
    set({ tracks: [...tracks, song] });
    get().playIndex(tracks.length);
  },
}));
