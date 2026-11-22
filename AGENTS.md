# Agent guide — Monthly Budget Nia Ilham

Practical notes for AI agents working in this repository. Read this before
changing code; the rules below are easy to break accidentally.

## Stack

- **SvelteKit 3** (Svelte 5, runes mode enforced in `vite.config.ts`) + TypeScript
  + Vite 8. Static build via `@sveltejs/adapter-static` (`fallback: index.html`),
  no server-side data loading — the app is client-rendered on Firebase Hosting.
- Installable PWA: `static/manifest.webmanifest` plus the icons in `static/icons/`
  are linked from `src/app.html`. The manifest requests `fullscreen` (no PWA title
  bar on Android); `viewport-fit=cover` and `env(safe-area-inset-top)` in the
  layout topbar keep content clear of the cutout. iOS falls back to standalone.
  The PNG icons are generated from `static/pwa-icon.svg` with
  `node scripts/generate-pwa-icons.mjs`; their background is the light-theme
  accent teal `#5b8a8a` (same as the primary/backup button). The header logo is
  inlined in `+layout.svelte` instead, so its tile uses `var(--accent-teal)` and
  follows dark mode; `theme.svelte.ts` swaps in `static/favicon-dark.svg` and a
  darker `theme-color` meta on theme changes. Installed PWA icons and the OG
  image stay static because the platform chooses them outside the theme. The
  service worker also caches the app shell and immutable assets for offline
  reads; Firestore uses persistent IndexedDB and a build-version toast offers
  a reload after a new deploy.
- **Firebase**: Firestore + anonymous Auth (project `monthly-budget-580b2`,
  hosting site `monthly-budget-nia-ilham`).
- **Cloud Functions** (`functions/`, Node 22) + FCM for push notifications.

## Commands

```sh
npm run dev            # dev server (long-running: run in background)
npm run build          # static build to build/
npm run check          # svelte-check — keep 0 errors AND 0 warnings
npm run lint           # eslint: plain TS/JS modules (not .svelte files)
npm test               # vitest: pure helpers in src/lib and functions/changes.js
npm run verify         # check + lint + test, run this before finishing
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
  string needs both `en` and `id` entries in `src/lib/i18n-dicts.ts` (plain
  dictionaries, parity checked by `i18n-dicts.test.ts`); `i18n.svelte.ts` only
  holds the reactive `t()` / `lang` state. Use `t("namespace.key")`.
- Styling is plain CSS per component using the CSS variables in `app.css`.
  Inline field validation hints (expense name/date, budget period) all share the
  `.field-hint` class in `app.css`; use it instead of restyling a hint.
  Mobile breakpoints: `1000px` (two-column collapses) and `768px` (phones).
- Loading states use `src/lib/components/Skeleton.svelte` inside the real
  layout wrappers. Set each placeholder's height to the line box of the text it
  replaces (e.g. a `0.9rem` value is ~`1.44rem` tall) so the page does not jump
  when data lands. Shimmer colours are the `--skeleton-base` / `--skeleton-sheen`
  tokens — keep them plain rgba, `color-mix()` is not supported everywhere.
- Transient success/failure feedback goes through the toast stack:
  `Toasts.svelte` is mounted once in `+layout.svelte` and fed by
  `toastSuccess()` / `toastError()` / `toastAction()` from `#lib/toast.svelte`
  (pure queue logic in `toast.ts`). `toastAction()` shows a 7-second Undo
  button; destructive deletes use it instead of `confirm()` so the snapshot can
  be written back with `saveBudget()`. `ExpenseSection` confirms add/edit/delete once the parent's
  `onChange` promise settles — it resolves `false` when the save failed — and the
  month page confirms a drag-and-drop move between sections the same way.
- Keep changes small and consistent with the surrounding code; run
  `npm run verify` before finishing.
- Logic worth testing belongs in `src/lib/*.ts` (no Svelte imports) so it stays
  unit-testable with Vitest.
- Shared animation timings/easings live in `src/lib/motion.ts` (`MOTION`,
  `motionFade()`, `motionFly()`); use them instead of new literal durations.
- **License: MIT** (see `LICENSE`). Keep the `license` field in both
  `package.json` files in sync.

## Data model

- `budget/{YYYY-MM}` — one document per 25th-to-24th period. Types and derived
  totals live in `src/lib/types.ts`; expense arrays are `husbandFixed`,
  `wifeFixed`, `husbandDailyFromSalary`, `husbandDailyFromSavings`,
  `wifeDailyFromSalary`, `wifeDailyFromSavings`.
- Period dates are editable: `periodStart` / `periodEnd` hold `YYYY-MM-DD`. The
  readable `period` label is derived from them with `formatPeriod()` in
  `types.ts` — never hand-write the label when those dates change.
- Periods roll on the 25th → 24th cycle (`currentPeriodId` in `period.ts`), but
  the dashboard lists one period ahead from the 21st (`latestPeriodId`,
  `PERIOD_CARD_DAY`) so the upcoming card appears early. Between the 21st and the
  24th the new card is listed yet not yet active (`isUpcomingPeriod`).
- **The month page only opens real periods.** `month/[id]/+page.ts` gates the
  route: a malformed id, a future period (`isFuturePeriodId`) or a past period
  with no stored budget (`isPastPeriodId` + `budgetExists`) throws a 404 and
  renders `+error.svelte`. The current and upcoming periods stay reachable before
  they exist because their dashboard card creates the budget first.
- On the month page, the upcoming period's fixed sections (3–4) skip the
  inactive-month confirmation (`confirmFixedChanges`) so their carried-over
  fixed expenses can be edited, moved and deleted before the period starts;
  every other section still uses `confirmChanges={!isActiveMonth}`.
- Daily items also carry an optional `date` (`YYYY-MM-DD`, local calendar day;
  use the `todayISO()` / `parseISODate()` / `daysBetween()` helpers, not raw
  `Date` math). Documents created before the field existed have none.
- Payment method is one string in `item.method`, composed from a preset pair:
  base (`qris` / `transfer` / `cash`) plus a channel (bank or e-wallet). The
  shared presets and defaults live in `src/lib/expense-methods.ts` (used by both
  `ExpenseSection` and the dashboard quick-add). Do not turn it back into a
  free-text field.
- `ExpenseSection.svelte` is opt-in per feature: `withMethod`, `withDate`,
  `methodDefault` (base + channel preselected for new entries, e.g. husband
  salary → `qris` / `Bank Jago`), and `noRowShift` (rows stay put on hover;
  used by the two income sections on the month page).
- **All budget writes go through `src/lib/budget-store.ts`**
  (`saveBudget()`, `deleteBudget()`). Do not call `setDoc`/`deleteDoc` on the
  budget collection elsewhere: the notification pipeline depends on the stamps
  those two helpers add.
- `src/lib/auth.ts` gates the UI with the shared keyword and signs in
  anonymously. The anonymous uid is the device identity used for notifications.
- Whole-data backup lives in `src/lib/backup.ts`: JSON is lossless (and
  re-importable), CSV is download-only, and `backup-pdf.ts` renders a printable
  period report (jsPDF/autoTable are lazy-loaded on button press). The dashboard
  panel is the only UI; imports are validated/normalised before `saveBudget()`
  writes them, so the notification stamps are never bypassed.

## Notifications (do not break)

- `src/lib/notifications.svelte.ts` — permission request, service worker
  registration, token storage in `devices/{fcmToken}`
  (`{ uid, lang, platform, enabled, updatedAt }`), foreground `onMessage` and
  the reactive `notify` state consumed by the bell.
- `src/lib/components/NotificationToggle.svelte` — topbar bell + toast.
- `src/service-worker/firebase-messaging-sw.js` — **template** for the FCM
  worker (background handler and notification taps). Do not put real config in
  it: `vite.config.ts` emits `/firebase-messaging-sw.js` into the build (and
  serves it in dev) by injecting `src/lib/firebase-config.ts` and the `firebase`
  SDK version. No manual sync needed.
- `saveBudget()` stamps `lastEditBy = auth.currentUser.uid`;
  `deleteBudget()` stamps the deleter *before* deleting so the delete trigger
  knows who to exclude. Never remove or bypass these stamps.
- `functions/index.js` — `onDocumentWritten` trigger on `budget/{monthId}`.
  Runs in `us-central1` because Firestore is in `nam5`; sends **data-only** FCM
  messages (the service worker renders them), prunes unregistered tokens, and
  skips tokens whose `uid` equals `lastEditBy`.
- `functions/changes.js` — pure diff/format logic (no Firebase imports) with
  tests in `functions/changes.test.js`; `index.js` must stay a thin adapter
  around it.
- Intended behaviour: notify on add/edit/delete of expense items (name, amount,
  payment method). **Do not** notify for `checked`-only toggles on fixed
  expenses or for income edits. Never notify the editor's own device.
- `sameItem()` in `changes.js` compares only `name`, `amount` and `method`, so a
  date-only edit sends no push today. Include `date` there (and its callers) if
  that should change — keep the function pure and testable with plain `node`.
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
- **Layering:** every overlapping layer uses the z-index scale in `app.css`
  (`--z-behind`, `--z-raised`, `--z-sticky`, `--z-overlay`, `--z-modal`,
  `--z-toast`, `--z-drag`). Do not add bare `z-index` values; pick the token
  matching the element's role. Anything with a `transform` (including one left behind by an
  animation) is a stacking context *and* the containing block for its
  `position: fixed` descendants, so a modal inside it is trapped.
- **Animation compatibility:** animate `transform`/`opacity`, not `height` and
  never percentage values inside a flex item (WebKit may resolve those as
  `auto` and silently skip the animation). Spell out both keyframes, and make
  sure the element still renders correctly if the animation never runs. Entrance
  animations use `animation-fill-mode: backwards`, never `both`/`forwards`: a
  forwards fill keeps the final keyframe's `transform` applied forever, which
  traps fixed descendants and outranks `:hover` transforms. The bar-chart rise
  is `scaleY` on `.bar-fill`; `prefers-reduced-motion` turns it off in both
  `app.css` and the component.
- Clearing browser storage creates a new anonymous uid; device documents are
  refreshed with the current uid on app start, and dead FCM tokens are pruned
  server-side.
- Native `<input type="date">`: Chrome/Firefox keep the calendar button flush to
  the right border. Do **not** add `padding-right` to "give it breathing room" —
  it drags the arrow away from the border and looks wrong on desktop, while
  phones hide the indicator anyway (reverted in `ed434e5`).
- **Svelte 5 `$effect` loops:** an effect that writes state it also reads re-runs
  forever. The month page's live-sync effect reads `budget.id` through
  `untrack()`; without it every `onSnapshot` reassignment re-subscribes in an
  endless loop (which also restarts the summary `CountUp`). `CountUp` likewise
  reads `displayed` via `untrack()` and only tweens when its target changes.
- `#lib/*` path alias maps to `src/lib/*` (see `package.json` and `tsconfig.json`).
- **Mobile keyboard:** `ExpenseSection`'s inline editor focuses its name field
  through the `focusEditor` action (an action, not a `bind:this` ref: swapping
  editors in one flush would let the unmounting editor null the shared ref) with
  `preventScroll`, then watches `window.visualViewport` *and* resizes of the
  section (`ResizeObserver`) while open, scrolling the editor above the keyboard
  and padding the page via `--keyboard-inset` (see `app.css`). The section
  observer is what re-triggers the reveal when another editor is opened while
  the keyboard is already up (the visual viewport does not change then). An
  editor taller than the space left by the keyboard is pinned just under the top
  bar. Do not rely on the browser's own focus reveal or on a single
  `scrollIntoView`: both run before the keyboard animates in, so the form ends
  up hidden behind it.
