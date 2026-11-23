/**
 * App-shell service worker registration.
 *
 * The worker only handles offline caching now — pushes are delivered by the
 * Pushover app, not by the browser. Kept in its own module so components do not
 * need to know where the worker lives.
 */

const SERVICE_WORKER_URL = "/service-worker.js";

/** Register the root-scoped service worker once the app is mounted. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    throw new Error("service-worker-unsupported");
  }
  const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: "/" });
  await navigator.serviceWorker.ready;
  return registration;
}
