/**
 * Minimal client-side authentication for Family Budget Harmony.
 *
 * The family's shared keyword is "enza". On success a flag is kept in
 * localStorage so the app stays signed in across visits. Logging out clears
 * the flag.
 */

const STORAGE_KEY = "fhb-auth";

/** The accepted keyword (compared case-insensitively after trimming). */
const KEYWORD = "enza";

export function isAuthenticated(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "true";
}

/** Returns true when the supplied keyword is accepted and signs in. */
export function login(keyword: string): boolean {
  const ok = keyword.trim().toLowerCase() === KEYWORD;
  if (ok) {
    localStorage.setItem(STORAGE_KEY, "true");
  }
  return ok;
}

export function logout(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
