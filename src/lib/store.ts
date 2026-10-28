"use client";

import { create } from "zustand";
import type { Song, StationSettings } from "@/lib/types";
import {
  activeProgram,
  anchoredIndex,
  DEFAULT_SETTINGS,
  isLiveOn,
  nowIST,
  parseAudioAds,
  playlistQueue,
  programElapsedMin,
  toMin,
} from "@/lib/types";

interface PlayerState {
  audio: HTMLAudioElement | null;
  tracks: Song[]; // ACTIVE queue: program songs > admin playlist > all songs
  allSongs: Song[]; // raw song list — queue isan ton rebuild hunda (program swap)
  index: number;
  playing: boolean;
  settings: StationSettings;
  volume: number;
  currentSrc: string | null;
  bootstrapped: boolean;
  progKey: string; // active program id ("" = koi nahi) — change hove ta queue khud badaldi hai
  adTitle: string; // hun chal rahi audio ad ("" = koi nahi) — song awaaj ducked hai is vele

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

/** Order songs: (1) active program di playlist (Punjab time naal), (2) admin playlist, (3) all songs. */
function buildQueue(settings: StationSettings, songs: Song[], now?: Date): Song[] {
  const d = now || nowIST();
  const prog = activeProgram(settings, d);
  if (prog) {
    const q = playlistQueue(prog, settings, songs);
    if (q.length > 0) return q;
  }
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

/** Hun-da active program id (ya "") — 30s tick isdi nitr niga rakhdia hai */
function progKeyOf(settings: StationSettings, now?: Date): string {
  return activeProgram(settings, now || nowIST())?.id || "";
}

function loadSrc(state: PlayerState): string | null {
  const { settings, tracks, index } = state;
  // Manual stream jeet + Gurbani time-table window vich vi live chalugi
  if (isLiveOn(settings, nowIST()) && settings.liveUrl) return settings.liveUrl;
  if (tracks.length === 0) return null;
  return tracks[((index % tracks.length) + tracks.length) % tracks.length].url;
}

// ── Audio ad ducking engine (module-level — ek vele ek hi ad) ─────────────────
let adAudio: HTMLAudioElement | null = null;

/** Ad mukki ja error — song di awaaj WAPIS NORMAL karo */
function stopAdRestore() {
  const s = usePlayer.getState();
  adAudio = null;
  usePlayer.setState({ adTitle: "" });
  if (s.audio) s.audio.volume = s.volume; // 20 sec di ad mukki — awaaj normal
}

/** Punjab time de hisaab nal koi ad due hai? Hove ta song awaaj LOW karke ad chalao. */
function fireDueAd() {
  const s = usePlayer.getState();
  if (adAudio || !s.audio || !s.playing) return; // ad pehlan chal rahi / player paused
  if (isLiveOn(s.settings, nowIST())) return; // live stream vele ads nahi
  if (s.allSongs.length === 0) return;
  const ads = parseAudioAds(s.settings.audioAds).filter((a) => a.active);
  if (ads.length === 0) return;
  const now = nowIST();
  const mins = now.getHours() * 60 + now.getMinutes();
  const day = now.getDay();
  const dateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  for (const ad of ads) {
    const days = (ad.days || "0,1,2,3,4,5,6").split(",").map((x) => Number(x.trim()));
    if (!days.includes(day)) continue;
    const at = toMin(ad.time);
    if (mins < at || mins >= at + 2) continue; // 2-min catch-up (tab suti hove vi bajegi)
    let fired = false;
    try {
      const key = `coocoo-ad-${ad.id}-${dateKey}`;
      fired = localStorage.getItem(key) === "1";
      if (!fired) localStorage.setItem(key, "1"); // din ch ek vaar hi
    } catch {
      /* private mode — dedupe nahi, par ad bajegi */
    }
    if (fired) continue;
    // 📢 DUCK: song awaaj low + ad chalao
    const duckVol = Math.max(0.01, Math.min(0.6, (ad.duck || 12) / 100));
    s.audio.volume = duckVol;
    usePlayer.setState({ adTitle: ad.title });
    const a = new Audio(ad.url);
    a.volume = 1;
    adAudio = a;
    a.addEventListener("ended", stopAdRestore);
    a.addEventListener("error", stopAdRestore);
    a.play().catch(() => stopAdRestore());
    return; // ek vele ek hi ad
  }
}

export const usePlayer = create<PlayerState>((set, get) => ({
  audio: null,
  tracks: [],
  allSongs: [],
  index: 0,
  playing: false,
  settings: DEFAULT_SETTINGS,
  volume: 0.85,
  currentSrc: null,
  bootstrapped: false,
  progKey: "",
  adTitle: "",

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

    // 30s tick — 3 kam: (1) program swap (2) gurbani window swap (3) audio ad duck
    setInterval(() => {
      const s = get();
      const now = nowIST();
      // (1) Program window shuru/muki? Queue khud badal jaugegi (Punjab time).
      //     Nava program shuru hove ta position TIME ton anchor hovegi (radio-sync) —
      //     har listener nu ohda hi song sunai devega, list shuru ton nahi.
      const key = progKeyOf(s.settings, now);
      if (key !== s.progKey && s.allSongs.length > 0) {
        const ordered = buildQueue(s.settings, s.allSongs, now);
        if (ordered.length > 0) {
          const prog = activeProgram(s.settings, now);
          const idx = prog ? anchoredIndex(ordered.length, programElapsedMin(prog, now)) : s.index % ordered.length;
          set({ progKey: key, tracks: ordered, index: idx });
        } else {
          set({ progKey: key });
        }
      }
      // (2) Gurbani window src swap
      const s2 = get();
      if (!s2.audio || !s2.currentSrc) return;
      const src = loadSrc(s2);
      if (src && src !== s2.currentSrc) {
        s2.audio.src = src;
        set({ currentSrc: src });
        if (s2.playing) s2.audio.play().catch(() => {});
      }
      // (3) Audio ad da time hoya? awaaj low karke ad chalao
      fireDueAd();
    }, 30000);

    // Har 2 minute baad navi settings/songs lao — admin de badlav (program, playlist,
    // gurbani window, manual ON/BAND) khuliya siteyan te vi 2 min ch lagu ho jaande ne.
    setInterval(() => {
      const s = get();
      if (s.bootstrapped && !s.adTitle) s.refreshContext();
    }, 120000);
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
      const all = Array.isArray(songs) ? songs : [];
      const ordered = buildQueue(settings, all);
      const first = !get().bootstrapped;
      const now = nowIST();
      // RADIO-SYNC: pehli load te (ja refresh te) position TIME ton anchor hove —
      // ohvi song bajega jo is vele radio ch chal rya hai, list shuru ton nahi.
      let startIndex = ordered.length > 0 ? ((get().index % ordered.length) + ordered.length) % ordered.length : 0;
      if (first && ordered.length > 0) {
        const prog = activeProgram(settings, now);
        const elapsed = prog ? programElapsedMin(prog, now) : now.getHours() * 60 + now.getMinutes();
        startIndex = anchoredIndex(ordered.length, elapsed);
      }
      set({ settings, allSongs: all, tracks: ordered, progKey: progKeyOf(settings), bootstrapped: true, index: startIndex });
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
    // Ad ducking chal rahi hai? Slider di value save rakhange — ad mukne te ohdi awaaj restore hovegi
    if (get().adTitle) {
      set({ volume: v });
      return;
    }
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
