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

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA76dfX8IPTvTx7ehorlHi9OFvr2s-Npug",
  authDomain: "monthly-budget-580b2.firebaseapp.com",
  projectId: "monthly-budget-580b2",
  storageBucket: "monthly-budget-580b2.firebasestorage.app",
  messagingSenderId: "276706600878",
  appId: "1:276706600878:web:0d8914bd9e8ecbc4048a3f",
  measurementId: "G-CQM5K87C7K"
};

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
