/**
 * Admin SDK bootstrap for the maintenance scripts.
 *
 * Credentials are never hardcoded: point `GOOGLE_APPLICATION_CREDENTIALS` at a
 * service-account JSON downloaded from the Firebase console, or let the SDK
 * fall back to the ambient Google credentials.
 */
import { readFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";

/** Initialise (or reuse) the Firebase Admin app for script usage. */
export function initAdmin() {
  const existing = getApps()[0];
  if (existing) return existing;

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) {
    console.warn(
      "GOOGLE_APPLICATION_CREDENTIALS is not set; falling back to application default credentials."
    );
    return initializeApp();
  }

  const serviceAccount = JSON.parse(readFileSync(credentialsPath, "utf8"));
  return initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}
