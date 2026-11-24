/* eslint-disable no-undef */
/**
 * App-shell service worker template. `vite.config.ts` replaces
 * `__APP_VERSION__` with the build version when it emits `/service-worker.js`.
 * Messages are handled by Telegram; this worker only keeps the app available
 * offline.
 */

// The placeholder is inside a string so a raw git hash stays valid JavaScript.
const CACHE = "monthly-budget-__APP_VERSION__";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./favicon.svg", "./favicon-dark.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Immutable assets can be served from the cache straight away.
  if (url.pathname.startsWith("/_app/immutable/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
    return;
  }

  // Navigations are network-first with a cached index.html fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
  }
});
