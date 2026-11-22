/* eslint-disable no-undef */
importScripts(
  "https://www.gstatic.com/firebasejs/__FIREBASE_SDK_VERSION__/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/__FIREBASE_SDK_VERSION__/firebase-messaging-compat.js"
);

firebase.initializeApp(__FIREBASE_CONFIG__);
const messaging = firebase.messaging();

const CACHE = `monthly-budget-${__APP_VERSION__}`;
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

function showMessage(payload) {
  if (payload.notification) return;
  const data = payload.data || {};
  self.registration.showNotification(data.title || "Monthly Budget", {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || undefined,
    data: { url: data.url || "/" }
  });
}

messaging.onBackgroundMessage(showMessage);

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(target);
            } catch {
              // Focus is enough when cross-document navigation is rejected.
            }
          }
          return;
        }
      }
      await self.clients.openWindow(target);
    })()
  );
});
