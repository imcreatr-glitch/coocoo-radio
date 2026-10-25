export interface Song {
  id: string;
  title: string;
  artist: string | null;
  source: string; // "upload" | "link"
  url: string;
  addedAt: string;
}

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  addedAt: string;
}

export interface ShowItem {
  id: string;
  title: string;
  description: string | null;
  days: string; // comma separated day numbers (0=Sunday)
  startMin: number; // minutes from midnight
  endMin: number;
  active: boolean;
}

export interface AdItem {
  id: string;
  title: string;
  type: string; // "image" | "video"
  mediaUrl: string;
  link: string | null;
  active: boolean;
  addedAt: string;
}

export interface ListenerMessage {
  id: string;
  name: string;
  message: string;
  read: boolean;
  addedAt: string;
}

export interface StationSettings {
  stationName: string;
  tagline: string;
  liveMode: string; // auto | stream
  liveUrl: string;
  playlist?: string; // JSON array of song ids — admin's manual live queue (""/absent = all songs)
}

export const DEFAULT_SETTINGS: StationSettings = {
  stationName: "CooCoo Radio 24x7",
  tagline: "ਹਰ ਪੱਲ ਤੁਹਾਡੇ ਨਾਲ • Punjabi • English",
  liveMode: "auto",
  liveUrl: "",
};

export const DAY_NAMES = ["ਐਤਵਾਰ", "ਸੋਮਵਾਰ", "ਮੰਗਲਵਾਰ", "ਬੁੱਧਵਾਰ", "ਵੀਰਵਾਰ", "ਸ਼ੁੱਕਰਵਾਰ", "ਸ਼ਨਿੱਚਰਵਾਰ"];
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ytId(url: string): string | null {
  if (!url) return null;
  const m =
    url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/) ||
    null;
  return m ? m[1] : null;
}
