# Agent guide — Monthly Budget Nia Ilham

Practical notes for AI agents working in this repository. Read this before
changing code; the rules below are easy to break accidentally.

## Stack

- **SvelteKit 3** (Svelte 5, runes mode enforced in `vite.config.ts`) + TypeScript
  + Vite 8. Static build via `@sveltejs/adapter-static` (`fallback: index.html`),
  no server-side data loading — the app is client-rendered on Firebase Hosting.
- **Firebase**: Firestore + anonymous Auth (project `monthly-budget-580b2`,
  hosting site `monthly-budget-nia-ilham`).
- **Cloud Functions** (`functions/`, Node 22) + FCM for push notifications.

## Commands

```sh
npm run dev            # dev server (long-running: run in background)
npm run build          # static build to build/
npm run check          # svelte-check — keep 0 errors AND 0 warnings
npm install --prefix functions   # function deps (separate package)
```

Deploys (Firebase CLI is installed and logged in as the project owner):

```sh
npx firebase-tools deploy --only hosting         # after npm run build
npx firebase-tools deploy --only firestore:rules
npx firebase-tools deploy --only functions       # requires the Blaze plan
```

Hosting is also deployed automatically by `.github/workflows/deploy.yml` on
every push to `main`; that workflow does **not** touch functions or rules.

## Conventions

- Svelte 5 runes only (`$state`, `$derived`, `$effect`, `$props`); no legacy
  stores, no `export let`. Server-side rendering must stay safe: guard
  `window`/`navigator` access or lazy-import browser-only SDKs.
- **Code, comments and markdown are English.** UI copy is bilingual: every new
  string needs both `en` and `id` entries in `src/lib/i18n.svelte.ts`; use
  `t("namespace.key")`. `svelte-check` does not catch missing translations.
- Styling is plain CSS per component using the CSS variables in `app.css`.
  Mobile breakpoints: `1000px` (two-column collapses) and `768px` (phones).
- Keep changes small and consistent with the surrounding code; run
  `npm run check` before finishing.
- **License: MIT** (see `LICENSE`). Keep the `license` field in both
  `package.json` files in sync.

## Data model

- `budget/{YYYY-MM}` — one document per 25th-to-24th period. Types and derived
  totals live in `src/lib/types.ts`; expense arrays are `husbandFixed`,
  `wifeFixed`, `husbandDailyFromSalary`, `husbandDailyFromSavings`,
  `wifeDailyFromSalary`, `wifeDailyFromSavings`.
- **All budget writes go through `src/lib/budget-store.ts`**
  (`saveBudget()`, `deleteBudget()`). Do not call `setDoc`/`deleteDoc` on the
  budget collection elsewhere: the notification pipeline depends on the stamps
  those two helpers add.
- `src/lib/auth.ts` gates the UI with the shared keyword and signs in
  anonymously. The anonymous uid is the device identity used for notifications.

## Notifications (do not break)

- `src/lib/notifications.svelte.ts` — permission request, service worker
  registration, token storage in `devices/{fcmToken}`
  (`{ uid, lang, platform, enabled, updatedAt }`), foreground `onMessage` and
  the reactive `notify` state consumed by the bell.
- `src/lib/components/NotificationToggle.svelte` — topbar bell + toast.
- `static/firebase-messaging-sw.js` — background handler and notification taps.
  Its Firebase config is duplicated from `src/lib/firebase.ts`: **keep both in
  sync**.
- `saveBudget()` stamps `lastEditBy = auth.currentUser.uid`;
  `deleteBudget()` stamps the deleter *before* deleting so the delete trigger
  knows who to exclude. Never remove or bypass these stamps.
- `functions/index.js` — `onDocumentWritten` trigger on `budget/{monthId}`.
  Runs in `us-central1` because Firestore is in `nam5`; sends **data-only** FCM
  messages (the service worker renders them), prunes unregistered tokens, and
  skips tokens whose `uid` equals `lastEditBy`.
- `functions/changes.js` — pure diff/format logic (no Firebase imports). Keep it
  pure so it stays testable with plain `node`; `index.js` must stay a thin
  adapter around it.
- Intended behaviour: notify on add/edit/delete of expense items (name, amount,
  payment method). **Do not** notify for `checked`-only toggles on fixed
  expenses or for income edits. Never notify the editor's own device.
- VAPID public key lives in `src/lib/firebase.ts` (`FCM_VAPID_KEY`), overridable
  via `VITE_FCM_VAPID_KEY` / `.env.local`. It is a public key — safe to commit.
- Debounce/aggregate awareness: each budget write produces at most one
  notification per event; multiple events in one write are summarised.

## Gotchas

- Cloud Functions need the **Blaze** plan; the project is currently on Spark, so
  the function is not deployed yet and pushes are inactive. See the README
  "Support & donations" section — do not promise the feature works until the
  function is deployed.
- `adapter-static` + `fallback: index.html`: dynamic routes like `/month/[id]`
  only work client-side; direct visits are rewritten to the SPA.
- `.topbar` uses `backdrop-filter`, which makes it the containing block for
  `position: fixed` descendants — position popovers inside it with `absolute`.
- Clearing browser storage creates a new anonymous uid; device documents are
  refreshed with the current uid on app start, and dead FCM tokens are pruned
  server-side.
- `#lib/*` path alias maps to `src/lib/*` (see `package.json` and `tsconfig.json`).
