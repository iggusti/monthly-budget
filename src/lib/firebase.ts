import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { browser } from "$app/env";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection,
  onSnapshot
} from "firebase/firestore";
import { firebaseConfig } from "./firebase-config";

const app = initializeApp(firebaseConfig);
const db = browser
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    })
  : getFirestore(app);
const auth = getAuth(app);

const BUDGET_COLLECTION = "budget";
/** Registered phones: `{ uid, recipient, lang, enabled, updatedAt }`. */
const DEVICES_COLLECTION = "devices";
/** Pending push jobs written by the app and drained by the GitHub Action. */
const NOTIFICATIONS_COLLECTION = "notification-outbox";

export {
  db,
  auth,
  app,
  BUDGET_COLLECTION,
  DEVICES_COLLECTION,
  NOTIFICATIONS_COLLECTION,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection,
  onSnapshot
};
