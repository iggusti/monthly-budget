import { allExpenseItems } from "./expense-list";
import { computeTotals, todayISO, totalExpenses, type MonthBudget } from "./types";

export interface InsightTrendPoint {
  id: string;
  title: string;
  income: number;
  expense: number;
}

export interface InsightCategory {
  name: string;
  amount: number;
}

export interface Insights {
  remaining: number;
  forecast: number;
  trend: InsightTrendPoint[];
  topCategories: InsightCategory[];
  hasExpenses: boolean;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function buildInsights(
  budgets: MonthBudget[],
  currentId: string,
  today: string = todayISO()
): Insights {
  const ordered = [...budgets].sort((a, b) => a.id.localeCompare(b.id));
  const currentIndex = ordered.findIndex((budget) => budget.id === currentId);
  const window = currentIndex >= 0 ? ordered.slice(Math.max(0, currentIndex - 5), currentIndex + 1) : ordered.slice(-6);
  const current = currentIndex >= 0 ? ordered[currentIndex] : undefined;

  const trend: InsightTrendPoint[] = window.map((budget) => {
    const totals = computeTotals(budget);
    return { id: budget.id, title: budget.title, income: totals.totalIncome, expense: totalExpenses(totals) };
  });

  const totals = current ? computeTotals(current) : null;
  const expense = totals ? totalExpenses(totals) : 0;
  const remaining = totals ? totals.totalIncome - expense : 0;
  let forecast = expense;
  if (current?.periodStart && current.periodEnd && today >= current.periodStart) {
    const totalDays = Math.max(1, daysBetween(current.periodStart, current.periodEnd) + 1);
    const elapsed = Math.min(totalDays, Math.max(1, daysBetween(current.periodStart, today) + 1));
    forecast = Math.round((expense / elapsed) * totalDays);
  }

  const byName = new Map<string, number>();
  if (current) {
    for (const item of allExpenseItems(current)) {
      if (item.amount > 0) byName.set(item.name, (byName.get(item.name) ?? 0) + item.amount);
    }
  }
  const topCategories = [...byName]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return { remaining, forecast, trend, topCategories, hasExpenses: expense > 0 };
}
