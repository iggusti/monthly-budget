/* eslint-disable no-undef */
/**
 * Firebase Cloud Messaging service worker — build template.
 *
 * `vite.config.ts` emits this file as `/firebase-messaging-sw.js` at the site
 * root (and serves it in dev), replacing two build tokens: the Firebase SDK
 * version (from the `firebase` dependency) and the project config (from
 * `src/lib/firebase-config.ts`). Keeping both injected means the app and the
 * worker cannot drift apart.
 * The Cloud Function sends **data-only** messages, so this worker is fully in
 * charge of what the notification looks like and where a tap takes the user.
 */
importScripts(
  "https://www.gstatic.com/firebasejs/__FIREBASE_SDK_VERSION__/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/__FIREBASE_SDK_VERSION__/firebase-messaging-compat.js"
);

firebase.initializeApp(__FIREBASE_CONFIG__);

const messaging = firebase.messaging();

/** Display the notification described by a message payload. */
function showMessage(payload) {
  // When the push includes a `notification` block the browser already shows
  // it; showing it again here would duplicate the notification.
  if (payload.notification) return;

  const data = payload.data || {};
  const title = data.title || "Monthly Budget";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || undefined,
    data: { url: data.url || "/" }
  };

  self.registration.showNotification(title, options);
}

messaging.onBackgroundMessage(showMessage);

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target =
    (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true
      });

      // Focus an existing tab when possible, otherwise open a new one.
      for (const client of windows) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(target);
            } catch (error) {
              // Cross-document navigation can be rejected; the focus is enough.
            }
          }
          return;
        }
      }

      await self.clients.openWindow(target);
    })()
  );
});
