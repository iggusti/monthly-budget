# Monthly Budget Nia Ilham

A monthly family budget app that keeps husband and wife spending in balance,
tracks daily expenses, and shows how money is funded from salary or savings.

Built with SvelteKit, TypeScript, Firebase Firestore, Firebase Anonymous
Authentication, and Firebase Cloud Messaging (with a Cloud Function) for push
notifications. The data model mirrors the `Budgeting Bulanan.xlsx` spreadsheet.

> 💛 **Push notifications need donations.** Everything else runs on Firebase's
> free plan, but the notification sender requires the paid Blaze plan.
> [Support the project on Saweria](https://saweria.co/iggusti) to unlock the
> feature fully.

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
- **Push notifications** — when an expense is added, edited or deleted, the
  other phone gets a system notification even with the app closed. The device
  that made the change is never notified. See
  [Push notifications](#push-notifications).

## Push notifications

Each phone registers an FCM token through the bell button in the topbar; the
token is stored in the `devices` collection together with the anonymous
Firebase uid and the UI language.

Every budget write is stamped with `lastEditBy = <anonymous uid>` (see
`saveBudget()` / `deleteBudget()`). A Firestore-triggered Cloud Function
(`functions/index.js`) diffs the six expense arrays before/after, classifies the
change as **add**, **edit** or **delete**, and sends a data-only FCM message to
every token whose uid differs from `lastEditBy` — so you never get a push for
your own edit.

Details:

- Notifications arrive in the language selected on each phone (EN / ID).
- Only field changes matter: name, amount and payment method. Ticking a fixed
  expense as "settled" (`checked`) does **not** notify, and income edits are
  ignored too. A date-only change is not part of the diff, so it sends no push
  either.
- Deleting a whole month sends a "Month deleted" notification to the other
  phones; `deleteBudget()` stamps the deleter just before removing the
  document so the delete trigger can exclude them.
- Dead tokens are pruned automatically when FCM reports them as unregistered.

> Sending pushes requires Cloud Functions, and Cloud Functions require the
> Firebase **Blaze** plan. The project is currently on Spark, so the bell can
> register a device but no notification is sent yet. See
> [Support & donations](#support--donations).

### Notification setup

1. Firebase Console → Project settings → Cloud Messaging → *Web Push
   certificates* → generate a key pair and put the public key in
   `FCM_VAPID_KEY` (`src/lib/firebase.ts`, overridable with
   `VITE_FCM_VAPID_KEY`).
2. Enable the Blaze plan (see [Support & donations](#support--donations)).
3. Install and deploy the function:

   ```sh
   npm install --prefix functions
   npx firebase-tools deploy --only functions
   ```

Full step-by-step notes live in [`NOTIFICATIONS.md`](./NOTIFICATIONS.md).

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
    firebase.ts              Firebase initialisation (Firestore + Auth + VAPID key)
    auth.ts                  keyword gate + anonymous sign-in
    budget-store.ts          Firestore read/write + real-time subscribe helpers
    i18n.svelte.ts           EN/ID dictionary and the reactive t() helper
    notifications.svelte.ts  FCM permission, token registration, foreground push
    components/
      ExpenseSection.svelte  reusable editable expense list (drag & drop)
      CountUp.svelte         animated rupiah figure for headline totals
      NotificationToggle.svelte  topbar bell: enable/disable push per device
      BadgeIcon.svelte       outline SVG category icons
  routes/
    +layout.svelte           shell with navigation and logout
    login/+page.svelte       login screen
    +page.svelte             dashboard
    month/[id]/+page.svelte  edit one budget period
src/service-worker/
  firebase-messaging-sw.js   template for the generated FCM service worker
functions/
  index.js                   Firestore trigger that sends the pushes
  changes.js                 pure diff/format helpers (unit-testable)
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

The rules allow read/write only for authenticated users, and let each device
manage only its own notification token:

```
match /budget/{document} {
  allow read, write: if request.auth != null;
}

match /devices/{token} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
    && request.resource.data.uid == request.auth.uid;
  allow update: if request.auth != null
    && resource.data.uid == request.auth.uid
    && request.resource.data.uid == request.auth.uid;
  allow delete: if request.auth != null
    && resource.data.uid == request.auth.uid;
}
```

## Deploying the notification function

Cloud Functions are not part of the GitHub Actions workflow (they need the Blaze
plan). Deploy them manually after changing anything under `functions/`:

```sh
npm install --prefix functions
npx firebase-tools deploy --only functions
```

The function targets `us-central1` because the Firestore database lives in the
`nam5` multi-region location. Override with `FUNCTION_REGION` if that changes.

## Support & donations

The whole app runs on Firebase's free Spark plan **except push notifications**.
The sender is a Cloud Function, and Firebase only allows deploying functions
after switching the project to the paid **Blaze** plan. Real usage stays well
inside the free monthly allowances, but a payment method must be on file.

That upgrade is the only thing keeping notifications switched off. If this app
is useful to you, **donations are needed** to enable and run Blaze so the push
notification feature can be turned on fully:

> ☕ **Donate via Saweria → [saweria.co/iggusti](https://saweria.co/iggusti)**

- Any amount helps — the goal is simply to keep the Blaze plan active.
- Once the plan is active, the function is deployed and the bell in the topbar
  starts delivering notifications to every registered phone.

Maintainer: **Iggusti** — [github.com/iggusti](https://github.com/iggusti).

## License

Released under the [MIT License](./LICENSE) © 2026 Iggusti. You may use, copy,
modify and redistribute the code as long as the copyright notice is kept.
