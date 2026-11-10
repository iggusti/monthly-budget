/**
 * Push notifications (Firebase Cloud Messaging) for the web app.
 *
 * Each device registers an FCM token and stores it in the `devices`
 * collection together with the anonymous Firebase uid of that browser. Budget
 * writes are stamped with `lastEditBy = uid`, so the sender (a Cloud Function)
 * can skip the tokens that belong to whoever made the change — you never get a
 * notification for your own edit.
 *
 * The module is import-safe during SSR: everything touching `window`,
 * `navigator` or the FCM SDK is guarded or loaded lazily.
 */

import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { app, auth, db, DEVICES_COLLECTION, FCM_VAPID_KEY } from "./firebase";

const SERVICE_WORKER_URL = "/firebase-messaging-sw.js";
const ENABLED_KEY = "fhb-notify-enabled";
const TOKEN_KEY = "fhb-notify-token";

export type NotificationStatus =
  | "unsupported"
  | "unconfigured"
  | "default"
  | "denied"
  | "enabled";

/** Message keys (see `notify.*` in i18n) that the toggle shows as a toast. */
export type NotificationMessage =
  | "unsupported"
  | "unconfigured"
  | "denied"
  | "error"
  | "disabled"
  | null;

/** Shared, reactive notification state for the UI. */
export const notify = $state<{ status: NotificationStatus; busy: boolean; message: NotificationMessage }>({
  status: "default",
  busy: false,
  message: null
});

function browserSupportsPush(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

/** Current status, derived from the browser permission and local flag. */
export function detectStatus(): NotificationStatus {
  if (typeof window === "undefined") return "default";
  if (!browserSupportsPush()) return "unsupported";
  if (!FCM_VAPID_KEY) return "unconfigured";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission === "granted" && localStorage.getItem(ENABLED_KEY) === "true") {
    return "enabled";
  }
  return "default";
}

/** Refresh the reactive status from the environment. */
export function refreshStatus(): void {
  notify.status = detectStatus();
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: "/" });
  await navigator.serviceWorker.ready;
  return registration;
}

async function getMessagingSafe() {
  const { getMessaging, isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) return null;
  return getMessaging(app);
}

async function readToken(registration: ServiceWorkerRegistration): Promise<string> {
  const messaging = await getMessagingSafe();
  if (!messaging) throw new Error("messaging-unsupported");
  const { getToken } = await import("firebase/messaging");
  const token = await getToken(messaging, {
    vapidKey: FCM_VAPID_KEY,
    serviceWorkerRegistration: registration
  });
  if (!token) throw new Error("no-fcm-token");
  return token;
}

/** Resolve the anonymous uid, waiting for Firebase to restore the session. */
function waitForUid(timeoutMs = 8000): Promise<string | null> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser.uid);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (uid: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(uid);
    };
    const timer = setTimeout(() => finish(auth.currentUser?.uid ?? null), timeoutMs);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // Anonymous sign-in is restored asynchronously; ignore the null tick.
      if (user) finish(user.uid);
    });
  });
}

/** Upsert the device document so the Cloud Function knows who to notify. */
async function saveDevice(token: string, lang: string): Promise<void> {
  const uid = await waitForUid();
  if (!uid) throw new Error("not-signed-in");
  await setDoc(
    doc(db, DEVICES_COLLECTION, token),
    {
      uid,
      lang: lang === "en" ? "en" : "id",
      platform: "web",
      enabled: true,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
  localStorage.setItem(TOKEN_KEY, token);
}

let foregroundBound = false;

/**
 * Show a system notification for messages that arrive while the app is open.
 * Clicking it is handled by the service worker's `notificationclick` listener.
 */
async function bindForegroundHandler(registration: ServiceWorkerRegistration): Promise<void> {
  if (foregroundBound) return;
  foregroundBound = true;
  const messaging = await getMessagingSafe();
  if (!messaging) return;
  const { onMessage } = await import("firebase/messaging");
  onMessage(messaging, (payload) => {
    const data = payload.data ?? {};
    const title = data.title || "Monthly Budget";
    void registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/" }
    });
  });
}

/** Ask for permission, register this device and store its token. */
export async function enableNotifications(lang: string): Promise<void> {
  notify.busy = true;
  notify.message = null;
  try {
    if (!browserSupportsPush()) {
      notify.status = "unsupported";
      notify.message = "unsupported";
      return;
    }
    if (!FCM_VAPID_KEY) {
      notify.status = "unconfigured";
      notify.message = "unconfigured";
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      notify.status = permission === "denied" ? "denied" : "default";
      notify.message = permission === "denied" ? "denied" : null;
      return;
    }

    const registration = await registerServiceWorker();
    const token = await readToken(registration);
    await saveDevice(token, lang);
    await bindForegroundHandler(registration);

    localStorage.setItem(ENABLED_KEY, "true");
    notify.status = "enabled";
  } catch (error) {
    console.error("Failed to enable notifications:", error);
    notify.status = detectStatus();
    notify.message = "error";
  } finally {
    notify.busy = false;
  }
}

/** Remove this device from `devices` and forget its FCM token. */
export async function disableNotifications(): Promise<void> {
  notify.busy = true;
  notify.message = null;
  try {
    localStorage.removeItem(ENABLED_KEY);

    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      await deleteDoc(doc(db, DEVICES_COLLECTION, token)).catch((error) => {
        console.warn("Failed to remove device token:", error);
      });
      localStorage.removeItem(TOKEN_KEY);
    }

    const messaging = await getMessagingSafe();
    if (messaging) {
      const { deleteToken } = await import("firebase/messaging");
      await deleteToken(messaging).catch((error) => {
        console.warn("Failed to delete FCM token:", error);
      });
    }

    notify.status = detectStatus();
    notify.message = "disabled";
  } catch (error) {
    console.error("Failed to disable notifications:", error);
    notify.message = "error";
  } finally {
    notify.busy = false;
  }
}

/**
 * Call once when the app starts (after sign-in). Refreshes the local status and,
 * when notifications are enabled, re-registers the token so it never goes stale.
 */
export async function initNotifications(lang: string): Promise<void> {
  refreshStatus();
  if (typeof window === "undefined" || notify.status !== "enabled") return;
  try {
    const registration = await registerServiceWorker();
    const token = await readToken(registration);
    await saveDevice(token, lang);
    await bindForegroundHandler(registration);
  } catch (error) {
    console.error("Failed to refresh notifications:", error);
  }
}
