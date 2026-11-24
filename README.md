# Monthly Budget Nia Ilham

A monthly family budget app that keeps husband and wife spending in balance,
tracks daily expenses, and shows how money is funded from salary or savings.

Built with SvelteKit, TypeScript, Firebase Firestore and Firebase Anonymous
Authentication. Notifications go through Telegram, sent by a free scheduled
GitHub Action — no Firebase Blaze plan or credit card needed. The data
model mirrors the `Budgeting Bulanan.xlsx` spreadsheet.

## Login

The app is protected by a shared family keyword. Once the keyword is accepted,
the client performs a Firebase **anonymous** sign-in so that Firestore rules can
require an authenticated user (no public read/write).

> Anonymous sign-in must be enabled once in the Firebase Console:
> **Authentication → Sign-in method → Anonymous → Enable**.

## What you can input

Every entry can be added, edited and removed from the UI:

1. **Husband income** — monthly salary
2. **Wife income** — monthly salary
3. **Husband fixed expenses** — utilities, rent, insurance, savings pots, ...
4. **Wife fixed expenses** — family support, zakat, koperasi, ...
5. **Husband daily expenses (from salary)** — with date and payment method
6. **Husband daily expenses (from savings)** — with date and payment method
7. **Wife daily expenses (from salary)** — with date and payment method
8. **Wife daily expenses (from savings)** — with date and payment method

Daily entries also record **when** and **how** the money left:

- **Date** — quick-pick chips (today, yesterday, … up to 5 days back) plus a
  full date picker; older entries without a date simply show none.
- **Payment method** — two selects: `QRIS`, `Transfer` or `Cash withdrawal`,
  then the bank (`BRI`, `Bank Jago`, `Allo Bank`, `BSI`, `SeaBank`) or e-wallet
  (`ShopeePay`, `GoPay`, `Flip`, `Dana`) it came from. Cash withdrawals only
  offer bank accounts. Each daily section preselects its usual pair, and legacy
  free-text values are kept when an old entry is edited.

## Calculations

- `Total income = husband income + wife income`
- `Total fixed expenses = husband fixed + wife fixed`
- `Balance after fixed = total income − total fixed expenses`
- `Equal split` — the transfer needed so both spouses hold the same amount after
  each pays their own fixed expenses:
  `transfer = (husband income − husband fixed − (wife income − wife fixed)) / 2`
- Salary-funded and savings-funded daily totals are shown separately per spouse
- The dashboard overview shows per-spouse amounts for income, fixed expenses,
  and the salary/savings-funded daily totals
- On the salary daily sections (`5` and `7`), a **"Max planned budget"** row shows
  `equalSplitAmount` (each hold after fixed), and **"Remaining money"** shows
  `equalSplitAmount − subtotal salary`.

Each budget period follows the pattern `25 January - 24 February 2026` (the 25th
cycle), and the start/end dates are edited with two date pickers in the month
header. The stored `periodStart` / `periodEnd` (`YYYY-MM-DD`) feed the readable
`period` label. A period's **title reflects its ending month** (so `2026-01` is
titled "February 2026"). Each period is stored as one Firestore document (id
`YYYY-MM`) in the `budget` collection.

The dashboard lists a period from the **21st** — four days before it starts on
the 25th — so the upcoming card can be prepared early. Its **fixed expenses**
(sections 3–4) are editable, movable between the spouses and deletable without
the inactive-month confirmation; the other sections still ask until the period
becomes the *active* one (badge, overview, month page) on the 25th.

## Features

- **Real-time sync** — edits made on one device (e.g. the husband) appear
  immediately on the other (wife) via Firestore `onSnapshot`, no reload needed.
- **Drag & drop** — items can be moved between paired sections only:
  `3 ↔ 4` (husband/wife fixed), `5 ↔ 6` (husband salary/savings),
  `7 ↔ 8` (wife salary/savings). Drag from the handle; drop target highlights.
- **Carry-over on new month** — when a new month is created from the dashboard,
  it copies all fixed expenses from the previous month (reset to unchecked),
  copies husband/wife income, and seeds the routine **"Sedekah Jariyah"**
  30,000 Auto Donate item.
- **Gender colors** — blue for husband sections, pink for wife sections; icons
  distinguish categories (income, fixed, wallet, savings).
- **Expense dates & method presets** — daily rows show the day and the payment
  channel; forms offer quick date chips and the method/bank selects described
  above.
- **View more / View less** — collapsible sections toggle both directions.
- **Polished loading & motion** — skeleton placeholders mirror the real layout
  on both pages (cards, charts and expense rows keep their size, so nothing
  jumps when Firestore data lands), the flow charts rise in from the baseline
  on page entry, and every animation honours the OS `prefers-reduced-motion`
  setting.
- **Backup & restore** — the dashboard can download every period as JSON
  (re-importable), a flat CSV, or a printable PDF report. Restores are validated
  first and written through the normal budget store, so real-time sync keeps
  working.
- **Installable PWA** — Add to Home Screen uses the bundled manifest and icons;
  Android installs it standalone, keeping the status bar visible, and iOS uses
  its standalone mode too. The service worker caches the app shell for offline
  reads, and an "Install app" button appears in the backup panel when the
  browser allows it.
- **Light & dark theme** — the topbar switch recolours the inline logo, favicon
  and browser theme colour together (installed PWA icons stay fixed).
- **Notifications** — an expense edit messages the other person on Telegram a
  few minutes later. No Blaze plan needed. See [Notifications](#notifications).
- **Offline & updates** — Firestore keeps a persistent IndexedDB cache and the
  service worker serves cached pages/assets offline. After a new deploy a
  "Versi baru tersedia" toast offers a reload.

## Notifications

Telegram replaces Firebase Cloud Messaging entirely, so the project stays on
the free Spark plan: no Cloud Functions, no Blaze upgrade, no credit card.

| Piece | Role |
| --- | --- |
| `src/lib/components/NotificationToggle.svelte` | Bell in the topbar; pick "Husband" or "Wife" once per browser. |
| `src/lib/notifications.svelte.ts` | Registers `devices/{uid}` with the recipient, language and anonymous uid. |
| `src/lib/budget-store.ts` | Writes a job to `notification-outbox` on every save/delete, with the before/after snapshots and `lastEditBy`. |
| `.github/workflows/push-notifications.yml` | Free scheduled Action (every 5 minutes) that runs the sender. |
| `functions/send-push.js` | Claims pending jobs and POSTs them to `https://api.telegram.org/bot<token>/sendMessage`. |
| `functions/changes.js` | Pure diff/format helpers, reused by the sender. |

Details:

- The editor's devices are skipped, so you never get a push for your own edit.
- Notifications arrive in the language selected on each phone (EN / ID).
- Only name, amount, payment method and date changes matter. Ticking a fixed
  expense (`checked`) or changing income sends no push.
- Deleting a whole month sends a "Month deleted" notification to the other
  phones. Each push links straight to that month's page.
- Failed sends are retried on the next run (up to 5 attempts); jobs are claimed
  transactionally so overlapping runs cannot double-send.
- Delivery is not instant: expect a push within about 5 minutes of an edit.

### Notification setup

1. Create a bot with [@BotFather](https://t.me/BotFather) (`/newbot`) and copy
   its **bot token**.
2. Send a message to the bot from each person's Telegram account. Open
   `https://api.telegram.org/bot<token>/getUpdates` and copy each `message.chat.id`.
   One shared group chat also works for a simple setup; use one chat per person
   if you want the "Husband"/"Wife" choice to skip the editor.
3. Add repository secrets (Settings → Secrets and variables → Actions):
   `TELEGRAM_BOT_TOKEN`, and either `TELEGRAM_CHAT_ID` or both
   `TELEGRAM_CHAT_ID_HUSBAND` and `TELEGRAM_CHAT_ID_WIFE`. The existing
   `FIREBASE_SERVICE_ACCOUNT_MONTHLY_BUDGET_580B2` secret is reused to read the
   outbox.
4. Deploy the updated Firestore rules so the app can create outbox jobs:

   ```sh
   npx firebase-tools deploy --only firestore:rules
   ```

5. On each phone, open the app and tap the bell → choose Husband or Wife →
   **Enable**. Add/edit an expense and wait for the scheduled run.

Full step-by-step notes and troubleshooting live in
[`NOTIFICATIONS.md`](./NOTIFICATIONS.md).

## Pages

- `/login` — keyword gate
- `/` — dashboard: overview cards, month cards (the current period is
  highlighted; 8 shown by default with a "View more/less" toggle)
- `/month/[id]` — edit one budget period: income/header editor, the eight input
  sections, and a money-flow chart explaining the relationship between the
  per-person remainder, salary spending and savings spending

## Project structure

```
src/
  lib/
    types.ts                 data model + calculations
    firebase.ts              Firebase initialisation (Firestore + Auth)
    auth.ts                  keyword gate + anonymous sign-in
    budget-store.ts          Firestore read/write + push job queue
    i18n.svelte.ts           EN/ID dictionary and the reactive t() helper
    notifications.svelte.ts  Telegram recipient registration per browser
    service-worker.ts        app-shell service worker registration
    components/
      ExpenseSection.svelte  reusable editable expense list (drag & drop)
      CountUp.svelte         animated rupiah figure for headline totals
      Skeleton.svelte        shimmery placeholder used by loading states
      NotificationToggle.svelte  topbar bell: pick recipient and enable push
      BadgeIcon.svelte       outline SVG category icons
  routes/
    +layout.svelte           shell with navigation and logout
    login/+page.svelte       login screen
    +page.svelte             dashboard
    month/[id]/+page.svelte  edit one budget period
src/service-worker/
  service-worker.js          template for the generated offline app-shell worker
functions/
  send-push.js               scheduled sender: drains the outbox via Telegram
  changes.js                 pure diff/format helpers (unit-testable)
  notify-helpers.js          pure recipient grouping / payload helpers
scripts/                     data seeding / migration / repair helpers
```

## Developing

```sh
npm install
npm run dev
```

## Building

```sh
npm run build
npm run preview
```

The static output is written to `build/`.

## Deploying

The app is a fully static SvelteKit build (`@sveltejs/adapter-static`) hosted on
**Firebase Hosting** and deployed automatically from GitHub via GitHub Actions.

### One-time setup

1. **Service account** — Firebase Console → Project settings → *Service accounts*
   → *Generate new private key*. Download the JSON file.
2. **GitHub secret** — repo → Settings → Secrets and variables → Actions →
   *New repository secret* named
   `FIREBASE_SERVICE_ACCOUNT_MONTHLY_BUDGET_580B2`, value = the whole JSON file.
3. **Anonymous Auth** — Firebase Console → Authentication → Sign-in method →
   Anonymous → Enable.

### Automatic deploys

Push to `main` (or run the workflow manually from the Actions tab). The workflow
at `.github/workflows/deploy.yml` builds the app and deploys `build/` to the live
channel.

Live URL: <https://monthly-budget-nia-ilham.web.app>

> The project also has a legacy site `monthly-budget-580b2.web.app`. The deploy
> target points at the `monthly-budget-nia-ilham` site via `.firebaserc`.

### Manual deploy (optional)

```sh
npm run build
firebase deploy --only hosting
```

## Deploying Firestore rules

```sh
npx firebase-tools deploy --only firestore:rules
```

The rules allow read/write only for authenticated users, let each device manage
only its own notification registration, and let clients append push jobs while only
the sender (Admin SDK) updates their status:

```
match /budget/{document} {
  allow read, write: if request.auth != null;
}

match /devices/{uid} {
  allow read: if request.auth != null
    && resource.data.uid == request.auth.uid;
  allow create: if request.auth != null
    && request.resource.data.uid == request.auth.uid;
  allow update: if request.auth != null
    && resource.data.uid == request.auth.uid
    && request.resource.data.uid == request.auth.uid;
  allow delete: if request.auth != null
    && resource.data.uid == request.auth.uid;
}

match /notification-outbox/{job} {
  allow read, create, delete: if request.auth != null;
  allow update: if false;
}
```

## Scheduled push sender

There is no Cloud Function to deploy. `.github/workflows/push-notifications.yml`
runs every 5 minutes (and can be triggered manually), installs
`functions/package-lock.json`, and executes `functions/send-push.js` with the
Telegram and Firebase secrets. It claims pending outbox jobs transactionally,
sends one localized message per recipient, and marks each job `sent`, `pending`
(retry) or `error`. Old `processing` jobs from a crashed run are reset on the
next run.

After changing anything under `functions/`, run `npm test` locally — the
pure helpers are covered by Vitest. No Firebase CLI deploy step is needed.

## Support & donations

The whole app, **including notifications**, now runs on free plans:
Firebase Spark, GitHub Actions and the Telegram Bot API.
No credit card is required. If the app is useful to you, donations are still
appreciated and help cover future hosting experiments:

> ☕ **Donate via Saweria → [saweria.co/iggusti](https://saweria.co/iggusti)**

Maintainer: **Iggusti** — [github.com/iggusti](https://github.com/iggusti).

## License

Released under the [MIT License](./LICENSE) © 2026 Iggusti. You may use, copy,
modify and redistribute the code as long as the copyright notice is kept.
