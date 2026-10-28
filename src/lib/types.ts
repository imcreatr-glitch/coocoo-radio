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
  playerStyle?: string; // JSON PlayerStyle — now-playing button: image/circle + play/pause colors
  donationUpi?: string; // UPI ID — Seva/Donation (feature removed from UI; fields kept for DB compat)
  donationNote?: string; // optional message inside donation dialog
  donationQr?: string; // data URL — UPI QR image in donation dialog
  onAirVideo?: string; // YouTube URL — ON AIR NOW card ch video (khaali = text design)
  theme?: string; // site color theme key (sunrise | royal | emerald | violet | crimson | white | black)
  tickerStyle?: string; // JSON TickerStyle — Breaking News ticker de rang (bg/text/labelBg/labelText)
  gurbaniSchedule?: string; // JSON GurbaniSchedule — time windows jadon gurbani live auto chalegi
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
  playerStyle: "",
  donationUpi: "",
  donationNote: "",
  donationQr: "",
  onAirVideo: "",
  theme: "",
  tickerStyle: "",
  gurbaniSchedule: "",
};

/** Site color themes (admin-switchable, professional palettes) */
export const THEME_PRESETS: { key: string; label: string; dot: string }[] = [
  { key: "sunrise", label: "Sunrise Gold (Pehla)", dot: "#f59e0b" },
  { key: "royal", label: "Royal Blue", dot: "#818cf8" },
  { key: "emerald", label: "Emerald Green", dot: "#34d399" },
  { key: "violet", label: "Royal Purple", dot: "#a78bfa" },
  { key: "crimson", label: "Royal Red", dot: "#fb7185" },
  { key: "white", label: "Pure White (Safaid)", dot: "#ffffff" },
  { key: "black", label: "Pure Black (Kaala)", dot: "#1a1a1a" },
];

/** Parse saved theme — unknown/empty = sunrise (never throws). "mono" = purana gray theme, hun black mannye */
export function parseTheme(raw: string | undefined | null): string {
  const v = (raw || "").trim();
  if (v === "mono") return "black";
  return THEME_PRESETS.some((t) => t.key === v) ? v : "sunrise";
}

/** Breaking News ticker colors (admin-configurable; Sky News style default) */
export interface TickerStyle {
  bg: string; // scrolling area background
  text: string; // scrolling headline text color
  labelBg: string; // "Breaking News" label background
  labelText: string; // label text color
}

/** Parse tickerStyle setting (never throws, Sky News defaults) */
export function parseTickerStyle(raw: string | undefined | null): TickerStyle {
  const def: TickerStyle = { bg: "#facc15", text: "#18181b", labelBg: "#09090b", labelText: "#ffffff" };
  if (!raw) return def;
  try {
    const v = JSON.parse(raw) as Partial<TickerStyle>;
    const hex = (s: unknown, fb: string) => (typeof s === "string" && /^#[0-9a-fA-F]{3,8}$/.test(s) ? s : fb);
    return {
      bg: hex(v.bg, def.bg),
      text: hex(v.text, def.text),
      labelBg: hex(v.labelBg, def.labelBg),
      labelText: hex(v.labelText, def.labelText),
    };
  } catch {
    return def;
  }
}

/** One Gurbani auto window — jadon Darbar Sahib live auto chalegi ("HH:MM" 24h) */
export interface GurbaniWindow {
  start: string;
  end: string;
}

export interface GurbaniSchedule {
  enabled: boolean;
  windows: GurbaniWindow[];
}

/** Parse gurbaniSchedule setting (never throws) */
export function parseGurbaniSchedule(raw: string | undefined | null): GurbaniSchedule {
  const def: GurbaniSchedule = { enabled: false, windows: [] };
  if (!raw) return def;
  try {
    const v = JSON.parse(raw) as Partial<GurbaniSchedule>;
    const windows = Array.isArray(v.windows)
      ? v.windows
          .filter((w): w is GurbaniWindow => !!w && typeof w.start === "string" && typeof w.end === "string")
          .map((w) => ({ start: w.start, end: w.end }))
      : [];
    return { enabled: v.enabled === true, windows };
  } catch {
    return def;
  }
}

/** Kya `date` kisi schedule window vich aunda? Overnight windows (22:00-04:00) vi handle karde */
export function inGurbaniWindow(sched: GurbaniSchedule, date: Date): boolean {
  if (!sched.enabled || sched.windows.length === 0) return false;
  const mins = date.getHours() * 60 + date.getMinutes();
  return sched.windows.some((w) => {
    const s = toMin(w.start);
    const e = toMin(w.end);
    if (s === e) return true; // full-day window
    if (s < e) return mins >= s && mins < e; // same-day
    return mins >= s || mins < e; // overnight (e.g. 22:00 -> 04:00)
  });
}

/** Kya hun Gurbani live chalni chahidi? Manual stream hamesha jeet; warna schedule window. */
export function isLiveOn(
  settings: Pick<StationSettings, "liveMode" | "liveUrl" | "gurbaniSchedule">,
  now: Date = new Date()
): boolean {
  if (settings.liveMode === "stream" && !!settings.liveUrl) return true; // manual ON hamesha jeet
  if (!settings.liveUrl) return false;
  return inGurbaniWindow(parseGurbaniSchedule(settings.gurbaniSchedule), now);
}

/** "04:30" -> "4:30 AM", "22:15" -> "10:15 PM" */
export function fmtAmPm(t: string): string {
  const [h, m] = (t || "0:0").split(":").map(Number);
  const hh = (h || 0) % 24;
  const mm = (m || 0).toString().padStart(2, "0");
  const ampm = hh < 12 ? "AM" : "PM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${mm} ${ampm}`;
}

/** Hun-da time 12h AM/PM ch, e.g. "5:07 PM" */
export function nowAmPm(d: Date): string {
  return fmtAmPm(`${d.getHours()}:${d.getMinutes()}`);
}

/** Now-playing play/pause button style (admin-configurable) */
export interface PlayerStyle {
  showImage: boolean; // true = singer photo (circle fallback if missing), false = simple circle
  playColor: string; // ring/circle color while playing ("" = default no-ring look)
  pauseColor: string; // ring/circle color while paused ("" = no ring)
}

/** Parse playerStyle setting (never throws, sensible defaults) */
export function parsePlayerStyle(raw: string | undefined | null): PlayerStyle {
  const def: PlayerStyle = { showImage: true, playColor: "#4ade80", pauseColor: "" };
  if (!raw) return def;
  try {
    const v = JSON.parse(raw) as Partial<PlayerStyle>;
    return {
      showImage: typeof v.showImage === "boolean" ? v.showImage : true,
      playColor: typeof v.playColor === "string" ? v.playColor : "#4ade80",
      pauseColor: typeof v.pauseColor === "string" ? v.pauseColor : "",
    };
  } catch {
    return def;
  }
}

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
