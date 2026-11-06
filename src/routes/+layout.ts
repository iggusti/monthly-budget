// The app is fully client-rendered: all data comes from the Firebase SDK in
// the browser, and the UI is gated by an anonymous sign-in stored in
// localStorage. Disable SSR and prerendering so adapter-static emits a single
// SPA shell plus an index.html fallback for dynamic routes.
export const ssr = false;
export const prerender = false;
