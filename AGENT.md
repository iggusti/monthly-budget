## Agent Rules and Guidelines

This document contains all rules and guidelines that must always be followed when working on this project. Do not forget these rules.

### Project Overview
- Project Name: Family Budget Harmony (monthly-budget)
- Tech Stack: SvelteKit, TypeScript, Firebase Firestore, date-fns
- Purpose: Monthly budget application to balance expenses between husband and wife, track daily expenses, and monitor savings withdrawals
- Reference: Excel file at C:\Users\DevTI-TelU\OneDrive\Dokumen\Budgeting Bulanan.xlsx

### Language Rules
- Always use English in all code, comments, variable names, function names, file names, documentation, README files, and AGENT.md
- Never use Indonesian or any other language in code or markdown files

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
- Track husband expenses separately from wife expenses
- Separate fixed expenses from daily expenses from savings withdrawals
- Payment methods should be tracked for daily expenses
- All monetary values in Indonesian Rupiah (IDR) format

### Budget Structure Rules
Based on Excel analysis (`C:\Users\DevTI-TelU\OneDrive\Dokumen\Budgeting Bulanan.xlsx`):
1. Income: Separate husband and wife income
2. Fixed Expenses (Husband): Regular monthly expenses like utilities, rent, insurance, etc.
3. Fixed Expenses (Wife): Regular monthly expenses like family support, zakat, etc.
4. Daily Expenses (from salary): Variable expenses paid from the monthly salary, with payment method
5. Daily Expenses (from savings): Variable expenses funded by withdrawing savings, with payment method
6. Savings Withdrawals: Money taken from savings with purpose/description
7. Balance: Income minus expenses, calculated per person and total
8. Budget period follows pattern like '25 January - 24 February 2026'

### Data Model Rules
- One Firestore document per budget period in the `budget` collection, id `YYYY-MM`
- Types and calculation logic live in `src/lib/types.ts` (`MonthBudget`, `computeTotals`)
- Firestore access is centralised in `src/lib/budget-store.ts` (fetch/save/delete)
- Every input must be editable: incomes, fixed expenses, daily expenses and savings withdrawals
- Unknown/missing fields are normalised via `normalizeBudget` so old documents keep working

### Database Rules
- Use Firebase Firestore as database
- Store data in the `budget` collection, one document per month (id `YYYY-MM`)
- Keep data structure consistent with the Excel format
- Use proper types for all documents
- Deploy rules with `npx firebase-tools deploy --only firestore:rules`
- Project id: `monthly-budget-580b2` (see `.firebaserc`)

### File Structure Rules
- Put shared code in src/lib/
- Components in src/lib/components/
- Utilities in src/lib/utils/
- Routes in src/routes/

### Routing Rules
- `/` — dashboard: overview totals, list of budget periods, create/delete a month
- `/month/[id]` — edit one budget period (income editor + the six input sections + savings)

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
- Use smooth transitions on all interactive elements

