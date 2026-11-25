import { t } from "./i18n.svelte";
import { toastAction } from "./toast.svelte";

const VERSION_KEY = "fhb-app-version";
let updatePrompted = false;

/** Offer a reload once per page session, no matter which path detected it. */
export function promptAppUpdate(): void {
  if (updatePrompted || typeof window === "undefined") return;
  updatePrompted = true;
  toastAction(t("update.message"), t("update.reload"), () => {
    window.location.reload();
  });
}

/**
 * Compare the loaded bundle against the last version this browser saw.
 * The new version is recorded immediately so a reload lands without a second
 * prompt, while a later deploy still differs and prompts again.
 */
export function checkAppUpdate(): void {
  if (typeof window === "undefined") return;
  const previous = localStorage.getItem(VERSION_KEY);
  if (previous === __APP_VERSION__) return;
  localStorage.setItem(VERSION_KEY, __APP_VERSION__);
  if (previous !== null) promptAppUpdate();
}

/**
 * A freshly installed service worker means a new deploy is ready. Prompt right
 * away instead of waiting for the next navigation to load the new bundle.
 * The first-ever install has no active worker and stays silent.
 */
export function watchServiceWorkerUpdates(registration: ServiceWorkerRegistration): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const hadActive = Boolean(registration.active);

  registration.addEventListener("updatefound", () => {
    if (!hadActive) return;
    const installing = registration.installing;
    if (!installing) return;

    installing.addEventListener("statechange", () => {
      if (installing.state === "installed" && navigator.serviceWorker.controller) {
        promptAppUpdate();
      }
    });
  });
}
