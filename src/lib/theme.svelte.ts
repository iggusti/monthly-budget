/**
 * Light/dark theme for Monthly Budget Nia Ilham.
 *
 * The active theme is written to `<html data-theme="...">`; all colours come
 * from the CSS custom properties in `app.css`, which define a light palette on
 * `:root` and a dark override on `[data-theme="dark"]`.
 *
 * The choice is persisted in localStorage (`fhb-theme`) and applied before the
 * first paint by an inline script in `app.html`, so there is no flash.
 *
 * Usage in components:
 *   import { theme, toggleTheme, setTheme } from "#lib/theme.svelte";
 *   <button onclick={toggleTheme}>…</button>
 */

export type Theme = "light" | "dark";

const STORAGE_KEY = "fhb-theme";

/** Detect the initial theme from storage, falling back to the OS preference. */
function initialTheme(): Theme {
  if (typeof localStorage === "undefined") return "light";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  if (typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

/** Apply a theme to the document root. */
function apply(next: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = next;
}

/** Reactive current theme (Svelte 5 rune-based store). */
export const theme = $state<{ value: Theme }>({ value: initialTheme() });

/** Set and persist the active theme, applying it to the document. */
export function setTheme(next: Theme) {
  theme.value = next;
  apply(next);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, next);
  }
}

/** Toggle between light and dark. */
export function toggleTheme() {
  setTheme(theme.value === "dark" ? "light" : "dark");
}

/** Sync the document with the current theme (call once on mount). */
export function syncTheme() {
  apply(theme.value);
}
