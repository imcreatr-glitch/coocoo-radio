import type { MetadataRoute } from "next";

// Next.js native manifest route — auto-served at /manifest.webmanifest
// Triggers PWA install prompt on Chrome/Edge/Android. iOS uses apple-touch-icon + meta tags.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CooCoo Radio 24x7 — ਪੰਜਾਬੀ • English Live Radio",
    short_name: "CooCoo Radio",
    description:
      "24x7 live Punjabi • English radio — music, news, scheduled shows with YouTube videos, image & video ads, and a morning rooster that crows every day!",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0a0a0a",
    theme_color: "#f59e0b",
    categories: ["music", "entertainment", "news"],
    lang: "pa",
    dir: "ltr",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Live Radio", short_name: "Live", url: "/?source=pwa-shortcut", description: "Open CooCoo Radio live stream" },
      { name: "Admin Panel", short_name: "Admin", url: "/?source=pwa-shortcut#admin", description: "Open admin panel" },
    ],
  };
}
