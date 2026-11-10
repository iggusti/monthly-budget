/* eslint-disable no-undef */
/**
 * Firebase Cloud Messaging service worker.
 *
 * Served from the site root so its scope covers the whole app. The Cloud
 * Function sends **data-only** messages, which means this worker is fully in
 * charge of what the notification looks like and where a tap takes the user.
 *
 * Note: keep the Firebase config in sync with `src/lib/firebase.ts`.
 */
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyA76dfX8IPTvTx7ehorlHi9OFvr2s-Npug",
  authDomain: "monthly-budget-580b2.firebaseapp.com",
  projectId: "monthly-budget-580b2",
  storageBucket: "monthly-budget-580b2.firebasestorage.app",
  messagingSenderId: "276706600878",
  appId: "1:276706600878:web:0d8914bd9e8ecbc4048a3f"
});

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
