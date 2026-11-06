/**
 * Budget data model.
 *
 * The structure mirrors the "Budgeting Bulanan" spreadsheet and is split into
 * exactly the inputs the family needs:
 *
 *  1. Husband income              -> husbandIncome
 *  2. Wife income                 -> wifeIncome
 *  3. Husband fixed expenses      -> husbandFixed[]
 *  4. Wife fixed expenses         -> wifeFixed[]
 *  5. Husband daily expenses      -> husbandDailyFromSalary[]  (from salary)
 *  6. Husband daily expenses      -> husbandDailyFromSavings[] (from savings)
 *  7. Wife daily expenses         -> wifeDailyFromSalary[]     (from salary)
 *  8. Wife daily expenses         -> wifeDailyFromSavings[]    (from savings)
 *
 * Every entry is editable and removable from the UI. All amounts are whole
 * Indonesian Rupiah (IDR) numbers without separators.
 *
 * The transfer that keeps both spouses' post-fixed balances equal is derived
 * automatically (see computeTotals.equalSplitTransfer) — it is never stored.
 */

/** A single fixed expense line (name + amount). */
export interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  /** True when this fixed expense has been settled (checked off). */
  checked?: boolean;
}

/**
 * A single daily expense line. In addition to name and amount it records the
 * payment method (cash, transfer, QRIS, a specific bank, ...) exactly like the
 * spreadsheet.
 */
export interface DailyExpense {
  id: string;
  name: string;
  amount: number;
  method: string;
}

/**
 * Generic editable line item used by the reusable expense list component.
 * Fixed expenses use `name`; daily expenses also carry an optional `method`.
 */
export interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
  method?: string;
  /** True when a fixed expense has been settled (checked off). */
  checked?: boolean;
}

/** Complete budget for one budget period (for example "25 January - 24 February 2026"). */
export interface MonthBudget {
  /** Document id, formatted as `YYYY-MM` (the month the period starts in). */
  id: string;
  /** Human readable title, for example "January 2026". */
  title: string;
  /** Budget period label, for example "25 January - 24 February 2026". */
  period: string;

  // ── Income ────────────────────────────────────────────────────────────────
  husbandIncome: number;
  wifeIncome: number;

  // ── Fixed expenses ──────────────────────────────────────────────────────────
  husbandFixed: FixedExpense[];
  wifeFixed: FixedExpense[];

  // ── Daily expenses ──────────────────────────────────────────────────────────
  husbandDailyFromSalary: DailyExpense[];
  husbandDailyFromSavings: DailyExpense[];
  wifeDailyFromSalary: DailyExpense[];
  wifeDailyFromSavings: DailyExpense[];

  updatedAt?: string;
}

/** Aggregated numbers derived from a {@link MonthBudget}. */
export interface MonthTotals {
  husbandFixedTotal: number;
  wifeFixedTotal: number;
  husbandDailyFromSalaryTotal: number;
  husbandDailyFromSavingsTotal: number;
  wifeDailyFromSalaryTotal: number;
  wifeDailyFromSavingsTotal: number;
  totalIncome: number;
  /** Only fixed expenses (husband fixed + wife fixed). */
  totalFixedExpenses: number;
  /** Total income minus total fixed expenses. */
  balanceAfterFixed: number;
  /** Percentage of income used by fixed expenses (0-100+). */
  usedPercentFixed: number;
  /**
   * Amount the husband must transfer to the wife (positive) — or the wife to
   * the husband (negative) — so both hold an equal amount after each pays
   * their own fixed expenses.
   */
  equalSplitTransfer: number;
  /** The equal amount each spouse would hold after the split transfer. */
  equalSplitAmount: number;
}

/** Create an empty budget for the given month id (`YYYY-MM`). */
export function createEmptyBudget(id: string): MonthBudget {
  const [year, month] = id.split("-").map(Number);
  const start = new Date(year, (month || 1) - 1, 25);
  const end = new Date(year, month || 1, 24);

  return {
    id,
    // Title reflects the END month of the period (e.g. 2026-10 = "November 2026"
    // because the period runs 25 Oct – 24 Nov).
    title: `${end.toLocaleString("en-US", { month: "long" })} ${end.getFullYear()}`,
    period: `${formatDay(start)} - ${formatDay(end)}`,
    husbandIncome: 0,
    wifeIncome: 0,
    husbandFixed: [],
    wifeFixed: [],
    husbandDailyFromSalary: [],
    husbandDailyFromSavings: [],
    wifeDailyFromSalary: [],
    wifeDailyFromSavings: []
  };
}

function formatDay(date: Date): string {
  return `${date.getDate()} ${date.toLocaleString("en-US", { month: "long" })}`;
}

/** Sum a list of items that all carry an `amount`. */
export function sumAmount(items: { amount: number }[] | undefined): number {
  if (!items) return 0;
  return items.reduce((total, item) => total + (Number(item.amount) || 0), 0);
}

/** Normalise a budget coming from Firestore so every field is present. */
export function normalizeBudget(id: string, raw: Partial<MonthBudget> | undefined): MonthBudget {
  const base = createEmptyBudget(id);
  if (!raw) return base;

  return {
    ...base,
    ...raw,
    id,
    title: raw.title ?? base.title,
    period: raw.period ?? base.period,
    husbandIncome: Number(raw.husbandIncome) || 0,
    wifeIncome: Number(raw.wifeIncome) || 0,
    husbandFixed: raw.husbandFixed ?? [],
    wifeFixed: raw.wifeFixed ?? [],
    husbandDailyFromSalary: raw.husbandDailyFromSalary ?? (raw as any).dailyFromSalary ?? [],
    husbandDailyFromSavings: raw.husbandDailyFromSavings ?? (raw as any).dailyFromSavings ?? [],
    wifeDailyFromSalary: raw.wifeDailyFromSalary ?? [],
    wifeDailyFromSavings: raw.wifeDailyFromSavings ?? []
  };
}

/** Compute every derived total for a budget. */
export function computeTotals(budget: MonthBudget): MonthTotals {
  const husbandFixedTotal = sumAmount(budget.husbandFixed);
  const wifeFixedTotal = sumAmount(budget.wifeFixed);
  const husbandDailyFromSalaryTotal = sumAmount(budget.husbandDailyFromSalary);
  const husbandDailyFromSavingsTotal = sumAmount(budget.husbandDailyFromSavings);
  const wifeDailyFromSalaryTotal = sumAmount(budget.wifeDailyFromSalary);
  const wifeDailyFromSavingsTotal = sumAmount(budget.wifeDailyFromSavings);

  const totalIncome = budget.husbandIncome + budget.wifeIncome;
  const totalFixedExpenses = husbandFixedTotal + wifeFixedTotal;

  // Amount each holds after paying their own fixed expenses.
  const husbandAfterFixed = budget.husbandIncome - husbandFixedTotal;
  const wifeAfterFixed = budget.wifeIncome - wifeFixedTotal;
  // Transfer so both equal: (difference) / 2. Positive => husband -> wife.
  const equalSplitTransfer = (husbandAfterFixed - wifeAfterFixed) / 2;
  const equalSplitAmount = husbandAfterFixed - equalSplitTransfer;

  return {
    husbandFixedTotal,
    wifeFixedTotal,
    husbandDailyFromSalaryTotal,
    husbandDailyFromSavingsTotal,
    wifeDailyFromSalaryTotal,
    wifeDailyFromSavingsTotal,
    totalIncome,
    totalFixedExpenses,
    balanceAfterFixed: totalIncome - totalFixedExpenses,
    usedPercentFixed: totalIncome > 0 ? Math.round((totalFixedExpenses / totalIncome) * 100) : 0,
    equalSplitTransfer,
    equalSplitAmount
  };
}

/** Format a number as Indonesian Rupiah. */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Number(amount) || 0);
}

/** Generate a reasonably unique id for a new line item. */
export function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** All month ids for a given year, formatted `YYYY-MM`. */
export function monthsOfYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
}
