/**
 * Firebase project configuration.
 *
 * Single source of truth: `src/lib/firebase.ts` consumes it directly, and the
 * build injects it into the generated `firebase-messaging-sw.js` (see the
 * `firebaseServiceWorker()` plugin in `vite.config.ts`). The values are public
 * by design — they identify the project, they do not grant access. Read/write
 * control lives in `firestore.rules`.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyA76dfX8IPTvTx7ehorlHi9OFvr2s-Npug",
  authDomain: "monthly-budget-580b2.firebaseapp.com",
  projectId: "monthly-budget-580b2",
  storageBucket: "monthly-budget-580b2.firebasestorage.app",
  messagingSenderId: "276706600878",
  appId: "1:276706600878:web:0d8914bd9e8ecbc4048a3f",
  measurementId: "G-CQM5K87C7K"
} as const;
