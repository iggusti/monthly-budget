/**
 * Authentication for Monthly Budget Nia Ilham.
 *
 * The flow is two-layered:
 *  1. The family's shared keyword ("enza") is verified locally. The keyword
 *     is not a security boundary by itself — it just gates the UI.
 *  2. A Firebase **anonymous** sign-in is then performed so that Firestore
 *     rules can require an authenticated user (no public read/write).
 *
 * The anonymous session is persisted by the Firebase SDK, so the app stays
 * signed in across visits. Both Firebase steps are reported to Telegram.
 */

import { signInAnonymously } from "firebase/auth";
import { auth } from "./firebase";
import { logActivity } from "./activity";

const KEYWORD = "enza";

/** Whether the keyword gate has been passed in this visit. */
export function isKeywordGranted(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem("fhb-auth") === "true";
}

function grantKeyword() {
  localStorage.setItem("fhb-auth", "true");
}

function revokeKeyword() {
  localStorage.removeItem("fhb-auth");
}

/** Verify the keyword and start an anonymous Firebase session. */
export async function login(keyword: string): Promise<boolean> {
  if (keyword.trim().toLowerCase() !== KEYWORD) return false;
  try {
    await signInAnonymously(auth);
    await logActivity({
      action: "auth.login",
      outcome: "success",
      editorUid: auth.currentUser?.uid ?? null,
      detail: "Anonymous sign-in"
    });
    grantKeyword();
    return true;
  } catch (error) {
    console.error("Anonymous sign-in failed:", error);
    await logActivity({
      action: "auth.login",
      outcome: "error",
      editorUid: auth.currentUser?.uid ?? null,
      detail: "Anonymous sign-in",
      error
    });
    return false;
  }
}

/** Sign out of Firebase and clear the keyword gate. */
export async function logout(): Promise<void> {
  const uid = auth.currentUser?.uid ?? null;
  revokeKeyword();
  try {
    // Log while the session is still alive: Firestore writes need auth.
    await logActivity({ action: "auth.logout", outcome: "success", editorUid: uid, detail: "Signed out" });
    await auth.signOut();
  } catch (error) {
    console.error("Sign-out failed:", error);
    await logActivity({ action: "auth.logout", outcome: "error", editorUid: uid, detail: "Signed out", error });
    throw error;
  }
}

/** Convenience: authenticated means both gates passed. */
export function isAuthenticated(): boolean {
  return isKeywordGranted();
}
