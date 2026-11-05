# Family Budget Harmony

A monthly family budget app that keeps husband and wife spending in balance,
tracks daily expenses, and monitors savings withdrawals.

Built with SvelteKit, TypeScript and Firebase Firestore. The data model mirrors
the `Budgeting Bulanan.xlsx` spreadsheet.

## What you can input

Every entry can be added, edited and removed from the UI:

1. **Husband income** — monthly salary
2. **Wife income** — monthly salary
3. **Husband fixed expenses** — utilities, rent, insurance, savings pots, ...
4. **Wife fixed expenses** — family support, zakat, koperasi, ...
5. **Husband daily expenses (from salary)** — variable spending with a payment method
6. **Daily expenses (from savings)** — variable spending funded by withdrawing savings
7. **Savings withdrawals** — money taken from savings with a purpose

## Balance calculation

- `Total income = husband income + wife income`
- `Total expenses = husband fixed + wife fixed + daily from salary + daily from savings`
- `Balance = total income - total expenses`
- Per-person balances (husband / wife) are shown under their sections
- A progress bar shows what percentage of income has been spent

Each budget period follows the pattern `25 January - 24 February 2026` and is
stored as one Firestore document (id `YYYY-MM`) in the `budget` collection.

## Project structure

```
src/
  lib/
    types.ts                 data model + calculations
    firebase.ts              Firebase initialisation
    budget-store.ts          Firestore read/write helpers
    components/
      ExpenseSection.svelte  reusable editable expense list
  routes/
    +page.svelte             dashboard (list of months)
    month/[id]/+page.svelte  edit one budget period
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

## Firestore

Allow read/write on the `budget` collection for the app to persist data.
