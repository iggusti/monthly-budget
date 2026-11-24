# Agent guide — Monthly Budget Nia Ilham

Practical notes for AI agents working in this repository. Read this before
changing code; the rules below are easy to break accidentally.

## Stack

- **SvelteKit 3** (Svelte 5, runes mode enforced in `vite.config.ts`) + TypeScript
  + Vite 8. Static build via `@sveltejs/adapter-static` (`fallback: index.html`),
  no server-side data loading — the app is client-rendered on Firebase Hosting.
- Installable PWA: `static/manifest.webmanifest` plus the icons in `static/icons/`
  are linked from `src/app.html`. The manifest requests `standalone`, so the
  Android status bar (clock, battery, signal) stays visible; `viewport-fit=cover`
  and `env(safe-area-inset-top)` in the layout topbar keep content clear of the
  cutout. Do not switch it back to `fullscreen`, which hides that status bar.
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
- **Telegram Bot API** for notifications: the browser writes a job to
  `notification-outbox` and a free scheduled GitHub Action (`functions/`,
  Node 22) sends it via Telegram. No Cloud Functions and no Blaze plan.

## Commands

```sh
npm run dev            # dev server (long-running: run in background)
npm run build          # static build to build/
npm run check          # svelte-check — keep 0 errors AND 0 warnings
npm run lint           # eslint: plain TS/JS modules (not .svelte files)
npm test               # vitest: pure helpers in src/lib and functions/{changes,notify-helpers}.js
npm run verify         # check + lint + test, run this before finishing
npm install --prefix functions   # sender deps (separate package)
```

Deploys (Firebase CLI is installed and logged in as the project owner):

```sh
npx firebase-tools deploy --only hosting         # after npm run build
npx firebase-tools deploy --only firestore:rules  # needed after rules changes
```

Hosting is deployed automatically by `.github/workflows/deploy.yml` on every
push to `main`; that workflow does **not** touch rules. The Telegram sender runs
separately in `.github/workflows/push-notifications.yml` every 5 minutes.
Pull requests get `ci.yml` checks and a 7-day Hosting preview channel from
`preview.yml`. `release.yml` creates GitHub Releases from `v*` tags;
`sender-rules.yml` tests the sender on every relevant push and deploys rules
automatically when `firestore.rules`, `firestore.indexes.json`, `firebase.json`
or `.firebaserc` change; manual dispatch still works.

## Conventions

- Svelte 5 runes only (`$state`, `$derived`, `$effect`, `$props`); no legacy
  stores, no `export let`. Server-side rendering must stay safe: guard
  `window`/`navigator` access or lazy-import browser-only SDKs.
- **Code, comments and markdown are English.** UI copy is bilingual: every new
  string needs both `en` and `id` entries in `src/lib/i18n-dicts.ts` (plain
  dictionaries, parity checked by `i18n-dicts.test.ts`); `i18n.svelte.ts` only
  holds the reactive `t()` / `lang` state. Use `t("namespace.key")`.
- Styling is plain CSS per component using the CSS variables in `app.css`.
  Shared tokens cover fonts, type scale, spacing, radii, focus rings, scrims and
  shadows too: use those instead of new literals. Inline field validation hints
  (expense name/date, budget period) all share the `.field-hint` class in
  `app.css`; use it instead of restyling a hint.
  Mobile breakpoints: `1000px` (two-column collapses) and `768px` (phones).
  Fonts are self-hosted through the `@fontsource-variable/*` imports in
  `+layout.svelte`; do not restore the Google Fonts `@import` in `app.css`.
- Husband sections and chart segments use `--accent-blue`; wife ones use
  `--accent-rose`. Keep that mapping across cards, the legend and section tones.
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
  24th the new card is listed yet not yet active (`isUpcomingPeriod`): it gets an
  "Upcoming" badge, never "Past" — past styling must use `isPastPeriodId`, not
  `!isCurrent`.
- **The month page only opens real periods.** `month/[id]/+page.ts` gates the
  route: a malformed id, a future period (`isFuturePeriodId`) or a past period
  with no stored budget (`isPastPeriodId` + `budgetExists`) throws a 404 and
  renders `+error.svelte`. The current and upcoming periods stay reachable before
  they exist because their dashboard card creates the budget first.
- On the month page, past periods are locked automatically unless a document
  has `locked: false` (an explicit unlock); `isPeriodLocked()` decides this.
  A locked period still renders every section: `readOnly` only removes add,
  edit, delete, checkbox/toggle and drag controls. The upcoming period's fixed
  sections (3–4) skip the inactive-month
  confirmation (`confirmFixedChanges`) so their carried-over fixed expenses can
  be edited, moved and deleted before the period starts. Its daily sections
  (5–8) are `readOnly` until the period starts, so no daily expense can be
  added, edited or moved early; there is a notice explaining this.
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

## Domain rules

- A period id `YYYY-MM` covers the 25th of the previous month through the 24th of
  `YYYY-MM`. Its title and `monthLabel()` name the **ending** month
  (`2026-10` → "November 2026"); `createEmptyBudget()` derives both from
  `periodEnd`.
- New periods come from `createBudgetFromPrevious()`: fixed expenses are copied
  with `checked: false`, nonzero incomes are kept, and the routine
  `Sedekah Jariyah` 30,000 with method `Auto Donate` is seeded into
  `husbandDailyFromSalary`.
- Drag & drop is limited to same-group sections: fixed `3 ↔ 4`, husband daily
  `5 ↔ 6`, wife daily `7 ↔ 8`. Dragging starts only from `.drag-handle`, and the
  move must be persisted through the normal `saveBudget()` path.
- For Wife → Husband (`equalSplitTransfer < 0`), section 5's `transferReceived`
  toggle records arrival. Until it is checked, the husband's salary plan and
  "Remaining money" are reduced by the pending transfer. The toggle is hidden and
  no extra reduction happens for Husband → Wife; the summary card follows
  `equalSplitCardKind()` in `src/lib/equal-split.ts`.
- Firestore rules require authentication (`request.auth != null`); deploy them
  with `npx firebase-tools deploy --only firestore:rules`.

## Notifications (do not break)

- `src/lib/notifications.svelte.ts` — registers `devices/{uid}` with
  `{ uid, recipient, lang, enabled, platform, updatedAt }` and exposes the
  reactive `notify` state. There is **no browser permission prompt** and no FCM:
  messages are delivered by Telegram.
- `src/lib/components/NotificationToggle.svelte` — topbar bell. Enabling asks
  the user to pick "Husband" or "Wife" so the sender knows which Telegram chat
  to use and which devices to skip.
- `src/lib/service-worker.ts` + `src/service-worker/service-worker.js` — the
  worker only caches the app shell now. `vite.config.ts` emits
  `/service-worker.js` (injecting `__APP_VERSION__`) and serves it in dev.
- `src/lib/budget-store.ts` — `saveBudget()` stamps
  `lastEditBy = auth.currentUser.uid` and appends one job to
  `notification-outbox` containing the before/after snapshots. `deleteBudget()`
  stamps the deleter *before* deleting and queues a `month-delete` job with
  `after: null`. Never remove or bypass these stamps.
- `.github/workflows/push-notifications.yml` — free scheduled Action (every 5
  minutes) with `concurrency` to avoid overlapping runs. Secrets:
  `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (shared fallback) or
  `TELEGRAM_CHAT_ID_HUSBAND` / `TELEGRAM_CHAT_ID_WIFE`, plus the existing
  `FIREBASE_SERVICE_ACCOUNT_MONTHLY_BUDGET_580B2`. No `VITE_` keys: credentials
  must never enter the bundle.
- `functions/send-push.js` — claims pending jobs in a Firestore transaction,
  POSTs to the Telegram Bot API, then marks jobs `sent` / `pending` (retry,
  max 5) / `error`. Jobs stuck in `processing` for over 10 minutes are reset. It uses
  the modular `firebase-admin/app` and `firebase-admin/firestore` APIs because
  firebase-admin v14 no longer exposes `admin.apps`.
- `functions/changes.js` and `functions/notify-helpers.js` — pure diff,
  formatting and recipient-grouping logic with Vitest tests. `send-push.js`
  must stay a thin adapter around them.
- Intended behaviour: notify on add/edit/delete of expense items (name, amount,
  payment method). **Do not** notify for `checked`-only toggles on fixed
  expenses or for income edits. Never notify the editor's own device.
- `sameItem()` in `changes.js` compares `name`, `amount`, `method`, and `date`.
  Edits to any of these fields will trigger a notification. Keep the function
  pure and testable with plain `node`.
- Debounce/aggregate awareness: each budget write produces one outbox job and at
  most one Telegram message per recipient language; multiple events in one write
  are summarised. Delivery is delayed by up to ~5 minutes by design.
- Telegram flood control: `send-push.js` spaces every message in a run by
  `SEND_SPACING_MS` (including messages from different jobs). On a 429 it does
  **not** retry in the same run — that keeps re-triggering Telegram's flood
  wait, even for `getMe`. Instead it stores `retryAfterAt` using
  `retry_after + RETRY_COOLDOWN_SECONDS`, and `claimJobs()` skips deferred jobs
  until that quiet window ends. A 429 does **not** consume an attempt, so a long
  Telegram-side outage cannot drop notifications. `retryAfterSeconds()` and
  `isDeferred()` are pure helpers in `notify-helpers.js`. Avoid manual runs
  while a bot is flooded.

## Gotchas

- Telegram delivery needs GitHub Secrets configured before the scheduled sender
  can do anything; with only a shared `TELEGRAM_CHAT_ID` the editor also receives
  the message, because one chat cannot be split per browser. Per-person chat IDs
  avoid that. Messages are delayed by up to ~5 minutes — do not describe them as
  instant.
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
- Clearing browser storage creates a new anonymous uid; on app start
  `initNotifications()` re-reads `devices/{uid}` and clears the local "enabled"
  flag if that record is gone. Old devices keyed by FCM token have no
  `recipient` and are ignored by both the app and the sender; they can be
  deleted manually.
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
- **Skeleton fidelity:** placeholders must mirror the real wrappers *and* their
  responsive wrapping. On the month page the expense chart labels and takeaway
  note wrap to 4/10 lines on phones but only 3/3 on desktop; the extra
  placeholder lines are hidden at `>=769px` instead of using one fixed height.
  Do not add a margin to a skeleton line when the parent already has a `gap` —
  that double-counts and makes the page jump when data lands.
- **Overflow clamp:** keep `overflow-x: clip` on `html` and `body`, not
  `hidden`. `hidden` makes the root a scroll container and silently breaks the
  sticky topbar on mobile browsers; `clip` gives the same horizontal clamp
  without a scrollport.
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
