## Agent Rules and Guidelines

This document contains all rules and guidelines that must always be followed when working on this project. Do not forget these rules.

### Project Overview
- Project Name: Family Budget Harmony (monthly-budget)
- Tech Stack: SvelteKit, TypeScript, Firebase (Firestore + Anonymous Auth)
- Purpose: Monthly budget application to balance expenses between husband and wife, track daily expenses, and monitor spending funded from savings
- Reference: Excel file at C:\Users\DevTI-TelU\OneDrive\Dokumen\Budgeting Bulanan.xlsx

### Language Rules
- Always use English in all code, comments, variable names, function names, file names, documentation, README files, and AGENT.md
- Never use Indonesian or any other language in code or markdown files
- Exception: user-facing UI strings may be Indonesian (the app's audience is an Indonesian family)

### Design Rules
- UI must reflect family values with warm, loving design
- Color palette: warm oranges, pinks, blues, greens representing family harmony
- Use fonts: Nunito and Quicksand for friendly, readable text
- Include family-themed elements: hearts, house, family icons
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

### Authentication Rules
- The app is gated by a shared family keyword (currently `enza`), handled in `src/lib/auth.ts`
- After the keyword passes, the app performs a Firebase **anonymous** sign-in so Firestore rules
  can require an authenticated user
- Anonymous Authentication must be enabled in the Firebase Console (Authentication → Sign-in method)
- `logout()` signs out of Firebase and clears the local keyword flag

### Data Model Rules
- One Firestore document per budget period in the `budget` collection, id `YYYY-MM`
- Types and calculation logic live in `src/lib/types.ts` (`MonthBudget`, `computeTotals`)
- Firestore access is centralised in `src/lib/budget-store.ts` (fetch/save/delete)
- Every input must be editable: incomes, fixed expenses and daily expenses
- Unknown/missing fields are normalised via `normalizeBudget` so old documents keep working

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
  with "View more"), create/open/delete a month
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
- Icons should be family-friendly emojis or SVGs
- All monetary values formatted with Indonesian locale
- Balance should be highlighted in red if negative
- The current budget period must stand out from past periods, but subtly
- Chart values must be readable (place numbers outside bars, colored per category)
- Use smooth transitions on all interactive elements
