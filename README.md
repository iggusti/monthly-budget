# Family Budget Harmony

A monthly family budget app that keeps husband and wife spending in balance,
tracks daily expenses, and shows how money is funded from salary or savings.

Built with SvelteKit, TypeScript, Firebase Firestore and Firebase Anonymous
Authentication. The data model mirrors the `Budgeting Bulanan.xlsx` spreadsheet.

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
5. **Husband daily expenses (from salary)** — with payment method
6. **Husband daily expenses (from savings)** — with payment method
7. **Wife daily expenses (from salary)** — with payment method
8. **Wife daily expenses (from savings)** — with payment method

## Calculations

- `Total income = husband income + wife income`
- `Total fixed expenses = husband fixed + wife fixed`
- `Balance after fixed = total income − total fixed expenses`
- `Equal split` — the transfer needed so both spouses hold the same amount after
  each pays their own fixed expenses:
  `transfer = (husband income − husband fixed − (wife income − wife fixed)) / 2`
- Salary-funded and savings-funded daily totals are shown separately per spouse

Each budget period follows the pattern `25 January - 24 February 2026` (the 25th
cycle) and is stored as one Firestore document (id `YYYY-MM`) in the `budget`
collection.

## Pages

- `/login` — keyword gate
- `/` — dashboard: overview cards, month cards (the current period is
  highlighted; 8 shown by default with a "View more" toggle)
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
    budget-store.ts          Firestore read/write helpers
    components/
      ExpenseSection.svelte  reusable editable expense list
  routes/
    +layout.svelte           shell with navigation and logout
    login/+page.svelte       login screen
    +page.svelte             dashboard
    month/[id]/+page.svelte  edit one budget period
scripts/                     data seeding / migration helpers
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

Live URL: <https://monthly-budget-580b2.web.app>

### Manual deploy (optional)

```sh
npm run build
firebase deploy --only hosting
```

## Deploying Firestore rules

```sh
npx firebase-tools deploy --only firestore:rules
```

The rules allow read/write only for authenticated users:

```
match /budget/{document} {
  allow read, write: if request.auth != null;
}
```
