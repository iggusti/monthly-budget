import { describe, expect, it } from "vitest";
import { buildInsights } from "./insights";
import { createEmptyBudget } from "./types";

function budget(id: string, overrides: Partial<ReturnType<typeof createEmptyBudget>> = {}) {
  return { ...createEmptyBudget(id), ...overrides };
}

describe("buildInsights", () => {
  const current = budget("2026-11", {
    periodStart: "2026-11-25",
    periodEnd: "2026-12-24",
    husbandIncome: 10_000_000,
    wifeIncome: 8_000_000,
    husbandFixed: [{ id: "a", name: "Sewa", amount: 3_000_000 }],
    husbandDailyFromSalary: [{ id: "b", name: "Makan", amount: 1_000_000, method: "QRIS" }]
  });

  it("computes remaining and a day-based forecast", () => {
    const insights = buildInsights([current], "2026-11", "2026-11-29");
    expect(insights.remaining).toBe(14_000_000);
    expect(insights.forecast).toBe(24_000_000);
    expect(insights.hasExpenses).toBe(true);
  });

  it("ranks the largest expense names", () => {
    const insights = buildInsights([current], "2026-11", "2026-11-29");
    expect(insights.topCategories.slice(0, 2)).toEqual([
      { name: "Sewa", amount: 3_000_000 },
      { name: "Makan", amount: 1_000_000 }
    ]);
  });

  it("keeps only the six periods up to the current one", () => {
    const budgets = Array.from({ length: 8 }, (_, i) => budget(`2026-${String(i + 1).padStart(2, "0")}`));
    const insights = buildInsights(budgets, "2026-07", "2026-07-01");
    expect(insights.trend.map((point) => point.id)).toEqual([
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07"
    ]);
  });

  it("handles a period without expenses", () => {
    const insights = buildInsights([budget("2026-11")], "2026-11", "2026-11-29");
    expect(insights.hasExpenses).toBe(false);
    expect(insights.forecast).toBe(0);
    expect(insights.topCategories).toEqual([]);
  });
});
