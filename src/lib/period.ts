/**
 * Budget period helpers.
 *
 * A period id (`YYYY-MM`) covers the 25th of the previous month through the
 * 24th of the period month — `2026-10` runs 25 Oct – 24 Nov. The same helpers
 * are used by the dashboard and by the month page, so the cycle is defined once.
 */

import { monthsOfYear } from "./types";

/** Label of the period's end month, e.g. `2026-10` -> "November 2026". */
export function monthLabel(id: string, locale: string): string {
  // Reflect the END month of the period (2026-10 runs 25 Oct – 24 Nov).
  const [year, month] = id.split("-").map(Number);
  const end = new Date(year, month || 1, 24);
  return `${end.toLocaleString(locale, { month: "long" })} ${end.getFullYear()}`;
}

/**
 * The budget period that contains `now`.
 *
 * If today is the 25th or later we are already in this calendar month's
 * period; otherwise we are still in the previous month's.
 */
export function currentPeriodId(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-based
  const day = now.getDate();
  const startMonth = day >= 25 ? month : month - 1;
  const [targetYear, targetMonth] = startMonth <= 0 ? [year - 1, 12] : [year, startMonth];
  return `${targetYear}-${String(targetMonth).padStart(2, "0")}`;
}

/** ID of the calendar month before `id` (`YYYY-MM`). */
export function previousMonthId(id: string): string {
  const [year, month] = id.split("-").map(Number);
  if (month <= 1) return `${year - 1}-12`;
  return `${year}-${String(month - 1).padStart(2, "0")}`;
}

/**
 * All period ids from the start of the earliest relevant year up to `end`,
 * oldest first. Falls back to `thisYear` when no budgets exist yet.
 */
export function allMonthsTo(end: string, thisYear: number): string[] {
  const endYear = Number(end.slice(0, 4));
  const startYear = Math.min(thisYear, endYear);
  const result: string[] = [];
  for (let year = startYear; year <= endYear; year++) {
    for (const id of monthsOfYear(year)) {
      if (id <= end) result.push(id);
    }
  }
  return result;
}
