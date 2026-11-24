import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { browser } from "$app/env";
import type { Firestore } from "firebase/firestore";
import { firebaseConfig } from "./firebase-config";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const BUDGET_COLLECTION = "budget";
/** Registered phones: `{ uid, recipient, lang, enabled, updatedAt }`. */
const DEVICES_COLLECTION = "devices";
/** Pending push jobs written by the app and drained by the GitHub Action. */
const NOTIFICATIONS_COLLECTION = "notification-outbox";

type FirestoreModule = typeof import("firebase/firestore");
type FirestoreApi = FirestoreModule & { db: Firestore };

let firestorePromise: Promise<FirestoreApi> | null = null;

/** Load Firestore only when a read or write is actually needed. */
function loadFirestore(): Promise<FirestoreApi> {
  return import("firebase/firestore").then((api) => {
    const db = browser
      ? api.initializeFirestore(app, {
          localCache: api.persistentLocalCache({
            tabManager: api.persistentMultipleTabManager()
          })
        })
      : api.getFirestore(app);
    return { ...api, db };
  });
}

function getFirestoreApi(): Promise<FirestoreApi> {
  firestorePromise ??= loadFirestore();
  return firestorePromise;
}

export {
  auth,
  app,
  BUDGET_COLLECTION,
  DEVICES_COLLECTION,
  NOTIFICATIONS_COLLECTION,
  getFirestoreApi
};
