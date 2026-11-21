/**
 * Lightweight internationalisation for Monthly Budget Nia Ilham.
 *
 * Two languages are supported: English (`en`, default) and Indonesian (`id`).
 * The chosen language is persisted in localStorage so it survives reloads and
 * is applied across the whole app (login, dashboard, month page, components).
 *
 * Casing: all user-facing copy uses **sentence case** — capitalise the first
 * letter only, keep proper nouns (Nia Ilham, QRIS, IDR) and the person labels
 * "Husband" / "Wife" as they are. Keep it consistent when adding strings.
 *
 * Usage in components:
 *   import { t, lang, setLang } from "#lib/i18n.svelte";
 *   <p>{t("dashboard.title")}</p>
 *   <button onclick={() => setLang("id")}>ID</button>
 */

export type Lang = "en" | "id";

const STORAGE_KEY = "fhb-lang";

import { dictionaries, en } from "./i18n-dicts";



/** Detect the initial language from storage, defaulting to English. */
function initialLang(): Lang {
  if (typeof localStorage === "undefined") return "en";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "id" ? "id" : "en";
}

/** Reactive current language (Svelte 5 rune-based store). */
export const lang = $state<{ value: Lang }>({ value: initialLang() });

/** Set and persist the active language. */
export function setLang(next: Lang) {
  lang.value = next;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, next);
  }
}

/** Toggle between English and Indonesian. */
export function toggleLang() {
  setLang(lang.value === "en" ? "id" : "en");
}

/**
 * Translate a key, optionally interpolating `{name}` placeholders.
 * Falls back to English, then to the raw key, when a translation is missing.
 */
export function t(
  key: string,
  params?: Record<string, string | number>,
): string {
  const dict = dictionaries[lang.value] ?? en;
  let text = dict[key] ?? en[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}
