// Minimal network-first service worker for CooCoo Radio.
// Strategy: try network first, fall back to cache when offline.
// Static shell (HTML, icons, manifest) is precached on install so the app
// can boot offline. Live audio stream is NOT cached (always fetched fresh).
const CACHE = "coocoo-v1";
const PRECACHE = [
  "/",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
  "/logo.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) =>
      // addAll fails entirely if any single request fails; use individual puts
      Promise.all(
        PRECACHE.map((url) =>
          fetch(url, { cache: "reload" })
            .then((res) => (res.ok ? c.put(url, res) : null))
            .catch(() => null)
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Never cache live audio streams or media — always fetch fresh
  if (req.destination === "audio" || req.destination === "video") return;
  if (url.pathname.startsWith("/api/")) return; // APIs always network-first

  // Same-origin GET: network-first, fall back to cache, fall back to cached shell
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match("/"))
        )
    );
  }
  // Cross-origin (e.g. live.sgpc.net, cdn.jsdelivr.net, YouTube) — let browser handle
});
