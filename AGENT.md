## Agent Rules and Guidelines

This document contains all rules and guidelines that must always be followed when working on this project. Do not forget these rules.

### Project Overview
- Project Name: Monthly Budget Nia Ilham (monthly-budget)
- Tech Stack: SvelteKit, TypeScript, Firebase (Firestore + Anonymous Auth)
- Purpose: Monthly budget application to balance expenses between husband and wife, track daily expenses, and monitor spending funded from savings
- Reference: Excel file at C:\Users\DevTI-TelU\OneDrive\Dokumen\Budgeting Bulanan.xlsx

### Language Rules
- Always use English in all code, comments, variable names, function names, file names, documentation, README files, and AGENT.md
- Never use Indonesian or any other language in code or markdown files
- Exception: user-entered **data** (item names, payment methods, etc.) is kept as the user typed it — never translate or modify it

### Design Rules
- UI must reflect family values with warm, loving design
- Color palette: warm oranges, pinks, blues, greens representing family harmony
- **Gender colors**: blue for husband sections, pink for wife sections (apply consistently across dashboard cards, chart legend, savings split, and section tones)
- Use fonts: Nunito and Quicksand for friendly, readable text
- Include family-themed elements: hearts, house, family icons
- Icons: use the outline SVG set (`BadgeIcon.svelte`) for section categories; use SVG paths for action icons (e.g. pencil), avoid text glyphs that render inconsistently
- Animations must be smooth and gentle (float, heartbeat effects)
- Transitions should be subtle and welcoming
- Use gradients and soft shadows for a cozy feel

### Code Rules
- Follow SvelteKit best practices
- Use TypeScript for all components and logic
- Keep components small and reusable
- Use proper naming conventions (camelCase for variables/functions, PascalCase for components)
- Calculate balances automatically as per Excel logic
- Track husband expenses separately from wife expenses — keep field names symmetric
  (`husbandDailyFromSalary` / `wifeDailyFromSalary`, etc.)
- Separate fixed expenses from daily expenses (salary-funded vs savings-funded)
- Payment methods should be tracked for all daily expenses
- All monetary values in Indonesian Rupiah (IDR) format

### Budget Structure Rules
Based on Excel analysis (`C:\Users\DevTI-TelU\OneDrive\Dokumen\Budgeting Bulanan.xlsx`):
1. Husband income
2. Wife income
3. Husband fixed expenses
4. Wife fixed expenses
5. Husband daily expenses (from salary), with payment method
6. Husband daily expenses (from savings), with payment method
7. Wife daily expenses (from salary), with payment method
8. Wife daily expenses (from savings), with payment method
9. Budget period follows the pattern `25 January - 24 February 2026` (the 25th cycle)

Derived values (never stored):
- `totalFixedExpenses` = husband fixed + wife fixed
- `balanceAfterFixed` = total income − total fixed expenses
- `equalSplitTransfer` / `equalSplitAmount` = the transfer needed so both spouses hold the
  same amount after each pays their own fixed expenses
- Salary-funded and savings-funded daily totals are shown separately per spouse
- "Max planned budget" on salary sections = `equalSplitAmount`; "Remaining money" =
  `equalSplitAmount − subtotal salary`
- Pending equal-split transfer: a period starts on the 25th of the previous month, but the
  wife is paid on the 1st. When `equalSplitTransfer` is Wife → Husband (negative), the
  husband must hold back that transfer amount from his "Max planned budget" (section 5) until
  it lands. Section 5 carries a `transferReceived` toggle for this; while it is unchecked the
  husband's plan and "Remaining money" use `equalSplitAmount − |transfer|`

### Title Rules
- A budget period's **title reflects its ending month** (e.g. id `2026-10` → "November 2026",
  covering 25 Oct – 24 Nov). Dashboard `monthLabel` must match this. Keep `createEmptyBudget`
  and any seed scripts consistent.

### Authentication Rules
- The app is gated by a shared family keyword (currently `enza`), handled in `src/lib/auth.ts`
- After the keyword passes, the app performs a Firebase **anonymous** sign-in so Firestore rules
  can require an authenticated user
- Anonymous Authentication must be enabled in the Firebase Console (Authentication → Sign-in method)
- `logout()` signs out of Firebase and clears the local keyword flag

### Data Model Rules
- One Firestore document per budget period in the `budget` collection, id `YYYY-MM`
- Types and calculation logic live in `src/lib/types.ts` (`MonthBudget`, `computeTotals`)
- Firestore access is centralised in `src/lib/budget-store.ts` (fetch/save/delete + real-time
  `subscribeBudget` / `subscribeAllBudgets`)
- Every input must be editable: incomes, fixed expenses and daily expenses
- Unknown/missing fields are normalised via `normalizeBudget` so old documents keep working

### Real-time Sync Rules
- The month page and dashboard subscribe to Firestore via `onSnapshot`; when one spouse edits,
  the other sees the change immediately without reload
- Always unsubscribe in the `onMount` cleanup so listeners do not leak

### Drag & Drop Rules
- Items may only be moved between **paired sections**: `3 ↔ 4`, `5 ↔ 6`, `7 ↔ 8`
- Drag starts only from the handle (touch-friendly); dropping on any other section is ignored
- On drop, move the item and persist via the same write path

### Carry-over Rules
- Creating a new month copies ALL previous-month fixed expenses (reset to unchecked),
  copies husband/wife income, and seeds the routine "Sedekah Jariyah" 30,000 Auto Donate
- There is no in-page carry-over banner; carry-over happens automatically on creation

### Database Rules
- Use Firebase Firestore as database
- Store data in the `budget` collection, one document per month (id `YYYY-MM`)
- Firestore rules require authentication: `allow read, write: if request.auth != null`
- Deploy rules with `npx firebase-tools deploy --only firestore:rules`
- Project id: `monthly-budget-580b2` (see `.firebaserc`)
- Migration scripts live in `scripts/` (e.g. `resync-daily-from-excel.mjs`, `migrate-keys.mjs`)

### File Structure Rules
- Put shared code in src/lib/
- Components in src/lib/components/
- Utilities in src/lib/utils/
- One-off data scripts in scripts/
- Routes in src/routes/

### Routing Rules
- `/login` — keyword gate; performs anonymous sign-in on success
- `/` — dashboard: overview cards, month cards (current period highlight, 8 shown by default
  with "View more/less"), create/open/delete a month
- `/month/[id]` — edit one budget period: income/header editor, the eight input sections,
  money-flow chart

### Git Rules
- Repository: https://github.com/iggusti/monthly-budget.git
- Commit messages in English
- Never commit .env files
- Follow conventional commits

### UI Component Rules
- Cards must have decorative elements and hover effects
- Use gradients for headers and important elements
- All monetary values formatted with Indonesian locale
- Balance should be highlighted in red if negative
- The current budget period must stand out from past periods, but subtly
- Chart values must be readable (place numbers outside bars, colored per category)
- Use smooth transitions on all interactive elements
