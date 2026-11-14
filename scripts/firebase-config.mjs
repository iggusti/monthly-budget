/**
 * Firebase web config shared by the maintenance scripts in this folder.
 *
 * Kept out of every script so the values live in one place. These are the same
 * public identifiers the app ships with (`src/lib/firebase-config.ts`); they
 * identify the project and do not grant access — see `firestore.rules`.
 *
 * Override the project when running against a staging copy:
 *   FIREBASE_API_KEY=... FIREBASE_PROJECT_ID=... node scripts/<script>.mjs
 */
export const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyA76dfX8IPTvTx7ehorlHi9OFvr2s-Npug",
  authDomain:
    process.env.FIREBASE_AUTH_DOMAIN || "monthly-budget-580b2.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "monthly-budget-580b2",
  storageBucket:
    process.env.FIREBASE_STORAGE_BUCKET || "monthly-budget-580b2.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "276706600878",
  appId:
    process.env.FIREBASE_APP_ID || "1:276706600878:web:0d8914bd9e8ecbc4048a3f",
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-CQM5K87C7K"
};
