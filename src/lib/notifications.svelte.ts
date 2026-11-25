/**
 * Message registration for Telegram.
 *
 * The browser does not ask for the Notification permission or talk to a push
 * service anymore. It only records which family member owns this device in
 * `devices/{uid}`. Every budget write also drops a job into
 * `notification-outbox`; a scheduled GitHub Action diffs that job and sends it
 * through Telegram, skipping the uid that made the change.
 *
 * Import-safe during SSR: browser globals are only touched behind guards.
 */

import { onAuthStateChanged } from "firebase/auth";
import { auth, DEVICES_COLLECTION, getFirestoreApi } from "./firebase";
import { logActivity } from "./activity";

export const PUSH_NOTIFICATIONS_ENABLED = true;

const ENABLED_KEY = "fhb-notify-enabled";
const RECIPIENT_KEY = "fhb-notify-recipient";

/** Which family member's Telegram chat should receive this phone's messages. */
export type Recipient = "husband" | "wife";
export type NotificationStatus = "default" | "enabled";
export type NotificationMessage = "disabled" | "error" | null;

/** Shared, reactive notification state for the topbar bell. */
export const notify = $state<{
  status: NotificationStatus;
  busy: boolean;
  message: NotificationMessage;
  recipient: Recipient;
}>({
  status: "default",
  busy: false,
  message: null,
  recipient: "husband"
});

function normalizeLang(lang: string): "id" | "en" {
  return lang === "en" ? "en" : "id";
}

/** Read the local flag without hitting Firestore (used on first render). */
export function refreshStatus(): void {
  if (typeof window === "undefined") return;
  notify.status = localStorage.getItem(ENABLED_KEY) === "true" ? "enabled" : "default";
  const stored = localStorage.getItem(RECIPIENT_KEY);
  if (stored === "husband" || stored === "wife") notify.recipient = stored;
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

/** Register this browser so the sender knows who to skip and which key to use. */
export async function enableNotifications(recipient: Recipient, lang: string): Promise<void> {
  notify.busy = true;
  notify.message = null;
  let uid: string | null = null;
  try {
    uid = await waitForUid();
    if (!uid) throw new Error("not-signed-in");

    const { db, doc, setDoc, serverTimestamp } = await getFirestoreApi();
    await setDoc(
      doc(db, DEVICES_COLLECTION, uid),
      {
        uid,
        recipient,
        lang: normalizeLang(lang),
        enabled: true,
        platform: "web",
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    localStorage.setItem(ENABLED_KEY, "true");
    localStorage.setItem(RECIPIENT_KEY, recipient);
    notify.recipient = recipient;
    notify.status = "enabled";
    await logActivity({ action: "notify.enable", outcome: "success", editorUid: uid, detail: recipient });
  } catch (error) {
    console.error("Failed to enable notifications:", error);
    await logActivity({ action: "notify.enable", outcome: "error", editorUid: uid, detail: recipient, error });
    refreshStatus();
    notify.message = "error";
  } finally {
    notify.busy = false;
  }
}

/** Unregister this browser from the device list. */
export async function disableNotifications(): Promise<void> {
  notify.busy = true;
  notify.message = null;
  let uid: string | null = null;
  try {
    localStorage.removeItem(ENABLED_KEY);
    localStorage.removeItem(RECIPIENT_KEY);

    uid = await waitForUid();
    if (!uid) throw new Error("not-signed-in");
    const { db, doc, deleteDoc } = await getFirestoreApi();
    await deleteDoc(doc(db, DEVICES_COLLECTION, uid));

    await logActivity({ action: "notify.disable", outcome: "success", editorUid: uid, detail: "device" });
    notify.status = "default";
    notify.message = "disabled";
  } catch (error) {
    console.error("Failed to disable notifications:", error);
    await logActivity({ action: "notify.disable", outcome: "error", editorUid: uid, detail: "device", error });
    refreshStatus();
    notify.message = "error";
  } finally {
    notify.busy = false;
  }
}

/**
 * Call once when the app starts. Re-reads the device record so a reinstall or
 * a partially written flag cannot leave the bell claiming to be enabled.
 */
export async function initNotifications(lang: string): Promise<boolean> {
  if (typeof window === "undefined") return true;
  refreshStatus();
  // No local flag means there is nothing to verify; skip the Firestore read
  // for users who never enabled notifications.
  if (localStorage.getItem(ENABLED_KEY) !== "true") return true;

  const uid = await waitForUid();
  if (!uid) {
    refreshStatus();
    return true;
  }

  try {
    const { db, doc, getDoc, setDoc, serverTimestamp } = await getFirestoreApi();
    const ref = doc(db, DEVICES_COLLECTION, uid);
    const snapshot = await getDoc(ref);
    const data = snapshot.exists() ? snapshot.data() : null;

    if (localStorage.getItem(ENABLED_KEY) === "true" && data?.enabled !== false && data?.uid === uid) {
      notify.status = "enabled";
      notify.recipient = data.recipient === "wife" ? "wife" : "husband";
      localStorage.setItem(RECIPIENT_KEY, notify.recipient);

      if (data.lang !== normalizeLang(lang)) {
        await setDoc(ref, { lang: normalizeLang(lang), updatedAt: serverTimestamp() }, { merge: true });
        await logActivity({
          action: "notify.language",
          outcome: "success",
          detail: normalizeLang(lang),
          editorUid: uid
        });
      }
      return true;
    }

    localStorage.removeItem(ENABLED_KEY);
    localStorage.removeItem(RECIPIENT_KEY);
    notify.status = "default";
    return true;
  } catch (error) {
    console.error("Failed to refresh notification registration:", error);
    await logActivity({
      action: "notify.language",
      outcome: "error",
      detail: normalizeLang(lang),
      editorUid: auth.currentUser?.uid || null,
      error
    });
    refreshStatus();
    return false;
  }
}
