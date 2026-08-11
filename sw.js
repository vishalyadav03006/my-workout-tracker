/* Service worker for My Workout Tracker.
   All app data lives in localStorage on the client — this worker only
   caches the static app shell so the app still loads when offline.

   Strategy: NETWORK-FIRST for the app shell (HTML/CSS/JS/manifest), falling
   back to the cache only when there's no network. This means a fresh
   deploy (e.g. a GitHub Pages update) is always picked up immediately
   instead of the old service worker's cache "sticking" and making it look
   like your fix never went live. Icons (which rarely change) use
   cache-first for speed. */

const CACHE_VERSION = "wt-cache-v2";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/exercises.js",
  "./js/storage.js",
  "./js/app.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      // Cache each file independently so one missing/failed file can't
      // abort the whole install (which would otherwise leave the app with
      // no offline support at all).
      return Promise.all(
        APP_SHELL.map((url) =>
          fetch(url, { cache: "reload" })
            .then((res) => { if (res && res.ok) return cache.put(url, res); })
            .catch(() => { /* ignore individual failures */ })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

const ICON_PATTERN = /\/icons\//;

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Icons: cache-first (rarely change, safe to serve instantly from cache).
  if (ICON_PATTERN.test(req.url)) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req))
    );
    return;
  }

  // Everything else (HTML/CSS/JS/manifest): network-first, cache fallback.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => {
          if (cached) return cached;
          if (req.mode === "navigate") return caches.match("./index.html");
          return undefined;
        })
      )
  );
});
