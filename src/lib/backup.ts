/**
 * Export/restore helpers for whole-family budget data.
 *
 * JSON is the lossless backup format; CSV is a flat, spreadsheet-friendly
 * view of the same data (download only). Everything here is browser-agnostic
 * so the parsing rules can be unit-tested without Svelte.
 */

import { normalizeBudget, type DailyExpense, type FixedExpense, type MonthBudget } from "./types";

export const BACKUP_APP = "monthly-budget-nia-ilham";
export const BACKUP_VERSION = 1;

/** Shape written to disk by `buildBackupJson()`. */
export interface BackupFile {
  app: string;
  version: number;
  exportedAt: string;
  budgets: MonthBudget[];
}

const MONTH_ID = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ARRAY_KEYS = [
  "husbandFixed",
  "wifeFixed",
  "husbandDailyFromSalary",
  "husbandDailyFromSavings",
  "wifeDailyFromSalary",
  "wifeDailyFromSavings"
] as const;
const NUMBER_KEYS = ["husbandIncome", "wifeIncome"] as const;

/** Serialise every period into one portable JSON file. */
export function buildBackupJson(budgets: readonly MonthBudget[], now = new Date()): string {
  const file: BackupFile = {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    budgets: [...budgets].sort((a, b) => b.id.localeCompare(a.id))
  };
  return JSON.stringify(file, null, 2);
}

/** Is `value` a usable line item from a backup? */
function validItem(value: unknown): value is FixedExpense | DailyExpense {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.name === "string" &&
    value.name.trim().length > 0 &&
    typeof value.amount === "number" &&
    Number.isFinite(value.amount)
  );
}

/** Keep only fields we understand; ignore foreign/stale stamps. */
function sanitizeItem<T extends FixedExpense | DailyExpense>(value: T): T {
  const clean = { ...value } as Record<string, unknown>;
  if (typeof clean.date !== "string" || !DAY.test(clean.date)) delete clean.date;
  if (typeof clean.method !== "string") delete clean.method;
  if (typeof clean.checked !== "boolean") delete clean.checked;
  return clean as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parse a backup file. Invalid periods are skipped instead of aborting the
 * whole restore; their count is returned so the UI can mention them.
 */
export function parseBackup(text: string): { budgets: MonthBudget[]; skipped: number } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON");
  }

  const rawBudgets = Array.isArray(data)
    ? data
    : isRecord(data) && Array.isArray(data.budgets)
      ? data.budgets
      : null;
  if (!rawBudgets) throw new Error("Not a backup file");

  let skipped = 0;
  const byId = new Map<string, MonthBudget>();

  for (const raw of rawBudgets) {
    if (
      !isRecord(raw) ||
      typeof raw.id !== "string" ||
      !MONTH_ID.test(raw.id) ||
      NUMBER_KEYS.some((key) => key in raw && (typeof raw[key] !== "number" || !Number.isFinite(raw[key]))) ||
      ARRAY_KEYS.some((key) => key in raw && !Array.isArray(raw[key]))
    ) {
      skipped++;
      continue;
    }

    const id = raw.id;
    const clean: Record<string, unknown> = { id };
    for (const key of ["title", "period", "periodStart", "periodEnd"] as const) {
      if (typeof raw[key] === "string") clean[key] = raw[key];
    }
    if (typeof raw.transferReceived === "boolean") clean.transferReceived = raw.transferReceived;
    for (const key of NUMBER_KEYS) {
      clean[key] = raw[key];
    }

    for (const key of ARRAY_KEYS) {
      const items = (raw[key] as unknown[]).filter(validItem).map(sanitizeItem);
      skipped += (raw[key] as unknown[]).length - items.length;
      clean[key] = items;
    }

    // Local writes get fresh notification stamps from saveBudget().
    delete clean.lastEditBy;
    delete clean.updatedAt;
    byId.set(id, normalizeBudget(id, clean));
  }

  return { budgets: [...byId.values()].sort((a, b) => b.id.localeCompare(a.id)), skipped };
}

/** Quote a CSV cell when it contains a delimiter, quote or line break. */
function csvCell(value: string | number | boolean): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Flat CSV view: one row per income/fixed/daily line, no derived totals. */
export function toBudgetsCsv(budgets: readonly MonthBudget[]): string {
  const header = "month,title,period,section,item,amount,method,date,checked";
  const rows: string[] = [header];

  for (const b of budgets) {
    const prefix = [b.id, b.title, b.period];
    for (const [key, amount] of [
      ["husbandIncome", b.husbandIncome],
      ["wifeIncome", b.wifeIncome]
    ] as const) {
      rows.push([...prefix, key, "", amount, "", "", ""].map(csvCell).join(","));
    }
    for (const key of ARRAY_KEYS) {
      const isDaily = key.includes("Daily");
      for (const item of b[key]) {
        rows.push(
          [
            ...prefix,
            key,
            item.name,
            item.amount,
            isDaily ? ("method" in item ? String(item.method ?? "") : "") : "",
            isDaily ? ("date" in item ? String(item.date ?? "") : "") : "",
            !isDaily && "checked" in item && item.checked ? "true" : ""
          ]
            .map(csvCell)
            .join(",")
        );
      }
    }
  }

  return rows.join("\r\n");
}
