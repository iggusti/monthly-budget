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

/** Public VAPID key for web push; override with `VITE_FCM_VAPID_KEY`. */
const FCM_VAPID_KEY =
  (import.meta.env.VITE_FCM_VAPID_KEY as string | undefined) ||
  "BIX8u3qPcruCgaPbOSNVwWqlG7Ojgx42LXh_pOkYDLrr9xtO2s08ISlV1wmFEHMMnXYmi6EMBI26ZhT5IPTQKTI";

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
