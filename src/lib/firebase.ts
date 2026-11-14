import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection,
  onSnapshot
} from "firebase/firestore";
import { firebaseConfig } from "./firebase-config";

/**
 * Web Push VAPID public key (safe to ship: it is a public key).
 *
 * Firebase Console → Project settings → Cloud Messaging → Web Push
 * certificates → "Generate key pair". Paste the key below (or set
 * `VITE_FCM_VAPID_KEY` in `.env`). Until it is filled in, the notification
 * toggle stays disabled and tells the user push is not configured yet.
 */
const FCM_VAPID_KEY =
  (import.meta.env.VITE_FCM_VAPID_KEY as string | undefined) ||
  "BIX8u3qPcruCgaPbOSNVwWqlG7Ojgx42LXh_pOkYDLrr9xtO2s08ISlV1wmFEHMMnXYmi6EMBI26ZhT5IPTQKTI";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const BUDGET_COLLECTION = "budget";
const DEVICES_COLLECTION = "devices";

export {
  db,
  auth,
  app,
  FCM_VAPID_KEY,
  BUDGET_COLLECTION,
  DEVICES_COLLECTION,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection,
  onSnapshot
};
