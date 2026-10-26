export interface Song {
  id: string;
  title: string;
  artist?: string | null;
  source: string; // upload | link
  url: string;
  addedAt: string;
}

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  language: string; // punjabi | english
  imageUrl?: string | null;
  addedAt: string;
}

export interface ShowItem {
  id: string;
  title: string;
  description?: string | null;
  youtubeUrl: string;
  startTime: string; // "06:00"
  endTime: string; // "09:00"
  days: string; // "0,1,2,3,4,5,6"
  addedAt: string;
}

export interface AdItem {
  id: string;
  title: string;
  type: string; // image | video
  mediaUrl: string;
  link?: string | null;
  active: boolean;
  addedAt: string;
}

export interface ListenerMessageItem {
  id: string;
  name: string;
  city?: string | null;
  type: string; // request | greeting | shoutout
  message: string;
  showTitle?: string | null;
  read: boolean;
  addedAt: string;
}

export interface StationSettings {
  stationName: string;
  tagline: string;
  liveMode: string; // auto | stream
  liveUrl: string;
  playlist?: string; // JSON array of song ids — admin's manual live queue (""/absent = all songs)
  liveTitle?: string; // label shown while stream plays (e.g. "Darbar Sahib Live")
  liveImage?: string; // vertical photo shown in the hero live player card
  streamLibrary?: string; // JSON array of StreamEntry — admin's saved live streams
  artistImages?: string; // JSON map singerName -> stamp-size photo URL (shown with now-playing)
}

export const DEFAULT_SETTINGS: StationSettings = {
  stationName: "CooCoo Radio 24x7",
  tagline: "ਹਰ ਪੱਲ ਤੁਹਾਡੇ ਨਾਲ • Punjabi • English",
  liveMode: "auto",
  liveUrl: "",
  playlist: "",
  liveTitle: "",
  liveImage: "",
  streamLibrary: "",
  artistImages: "",
};

/** One saved live stream in the admin's library */
export interface StreamEntry {
  name: string;
  url: string;
}

/** Find the stamp-size photo for a singer (case-insensitive name match, never throws) */
export function artistImageFor(raw: string | undefined | null, artist?: string | null): string | null {
  if (!raw || !artist || !artist.trim()) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (!v || typeof v !== "object") return null;
    const want = artist.trim().toLowerCase();
    const key = Object.keys(v).find((k) => k.trim().toLowerCase() === want);
    if (key && typeof v[key] === "string" && (v[key] as string).trim()) {
      return (v[key] as string).trim();
    }
  } catch {
    /* ignore bad JSON */
  }
  return null;
}

/** Safe-parse the streamLibrary setting (never throws, always returns array) */
export function parseStreamLibrary(raw?: string | null): StreamEntry[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter((e): e is StreamEntry => !!e && typeof e.url === "string" && !!e.url.trim())
      .map((e) => ({ name: typeof e.name === "string" && e.name.trim() ? e.name.trim() : "Live Stream", url: e.url.trim() }));
  } catch {
    return [];
  }
}

export const DAY_NAMES = ["ਐਤਵਾਰ", "ਸੋਮਵਾਰ", "ਮੰਗਲਵਾਰ", "ਬੁੱਧਵਾਰ", "ਵੀਰਵਾਰ", "ਸ਼ੁੱਕਰਵਾਰ", "ਸ਼ਨਿੱਚਰਵਾਰ"];
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ytId(url: string): string | null {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?[^ ]*v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/
  );
  if (m) return m[1];
  if (/^[\w-]{11}$/.test(url.trim())) return url.trim();
  return null;
}

export function ytThumb(url: string): string | null {
  const id = ytId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

/** YouTube nocookie embed URL with ad-style autoplay (muted, looping) */
export function ytEmbed(url: string): string | null {
  const id = ytId(url);
  return id
    ? `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&modestbranding=1&rel=0&playsinline=1`
    : null;
}

/** Parse "HH:MM" to minutes */
export function toMin(t: string): number {
  const [h, m] = (t || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Is this show on air at the given day/hour/minute? Handles overnight shows. */
export function isOnAir(show: ShowItem, day: number, minutes: number): boolean {
  const days = show.days.split(",").map((d) => Number(d.trim()));
  const start = toMin(show.startTime);
  const end = toMin(show.endTime);
  if (start === end) return days.includes(day); // 24h show
  if (start < end) {
    // same-day show
    return days.includes(day) && minutes >= start && minutes < end;
  }
  // overnight: e.g. 22:00 -> 02:00
  const yest = (day + 6) % 7;
  return (
    (days.includes(day) && minutes >= start) || (days.includes(yest) && minutes < end)
  );
}
