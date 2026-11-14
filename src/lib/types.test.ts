import { describe, expect, it } from "vitest";
import {
  computeTotals,
  createEmptyBudget,
  daysBetween,
  formatPeriod,
  makeId,
  monthsOfYear,
  normalizeBudget,
  parseISODate,
  sumAmount,
  totalExpenses,
  toISODate,
  type MonthBudget
} from "./types";

function budgetWith(overrides: Partial<MonthBudget> = {}): MonthBudget {
  return {
    ...createEmptyBudget("2026-10"),
    ...overrides
  };
}

describe("createEmptyBudget", () => {
  it("derives the 25th-to-24th period from the month id", () => {
    const budget = createEmptyBudget("2026-10");
    expect(budget.periodStart).toBe("2026-10-25");
    expect(budget.periodEnd).toBe("2026-11-24");
    // The title reflects the END month of the period.
    expect(budget.title).toBe("November 2026");
    expect(budget.period).toBe("25 October - 24 November");
  });

  it("starts empty and unpaid", () => {
    const budget = createEmptyBudget("2026-10");
    expect(budget.husbandIncome).toBe(0);
    expect(budget.wifeIncome).toBe(0);
    expect(budget.husbandFixed).toEqual([]);
    expect(budget.wifeDailyFromSavings).toEqual([]);
    expect(budget.transferReceived).toBe(false);
  });
});

describe("normalizeBudget", () => {
  it("fills every field for a missing document", () => {
    const budget = normalizeBudget("2026-02", undefined);
    expect(budget.id).toBe("2026-02");
    expect(budget.periodStart).toBe("2026-02-25");
    expect(budget.husbandFixed).toEqual([]);
    expect(budget.wifeIncome).toBe(0);
  });

  it("coerces numeric strings and keeps stored values", () => {
    const budget = normalizeBudget("2026-02", {
      husbandIncome: "5000000" as unknown as number,
      wifeIncome: 4000000,
      title: "Custom"
    });
    expect(budget.husbandIncome).toBe(5000000);
    expect(budget.wifeIncome).toBe(4000000);
    expect(budget.title).toBe("Custom");
    // Missing period dates fall back to the derived ones.
    expect(budget.periodStart).toBe("2026-02-25");
  });

  it("migrates the legacy dailyFromSalary/dailyFromSavings fields", () => {
    const legacy = {
      dailyFromSalary: [{ id: "a", name: "Kopi", amount: 20000, method: "Cash" }],
      dailyFromSavings: [{ id: "b", name: "Servis", amount: 150000, method: "Transfer" }]
    } as unknown as Partial<MonthBudget>;

    const budget = normalizeBudget("2026-03", legacy);
    expect(budget.husbandDailyFromSalary).toHaveLength(1);
    expect(budget.husbandDailyFromSalary[0].name).toBe("Kopi");
    expect(budget.husbandDailyFromSavings[0].amount).toBe(150000);
    expect(budget.wifeDailyFromSalary).toEqual([]);
  });

  it("prefers the current field names over the legacy ones", () => {
    const raw = {
      husbandDailyFromSalary: [{ id: "new", name: "Baru", amount: 1, method: "" }],
      dailyFromSalary: [{ id: "old", name: "Lama", amount: 2, method: "" }]
    } as unknown as Partial<MonthBudget>;

    expect(normalizeBudget("2026-03", raw).husbandDailyFromSalary[0].name).toBe("Baru");
  });
});

describe("computeTotals", () => {
  it("splits the remaining money equally between both spouses", () => {
    const totals = computeTotals(
      budgetWith({
        husbandIncome: 6000000,
        wifeIncome: 4000000,
        husbandFixed: [{ id: "h1", name: "Listrik", amount: 500000 }],
        wifeFixed: [{ id: "w1", name: "Koperasi", amount: 1000000 }]
      })
    );

    expect(totals.totalIncome).toBe(10000000);
    expect(totals.totalFixedExpenses).toBe(1500000);
    expect(totals.balanceAfterFixed).toBe(8500000);
    // Husband keeps 5.5M, wife 3M -> husband transfers 1.25M to the wife.
    expect(totals.equalSplitTransfer).toBe(1250000);
    expect(totals.equalSplitAmount).toBe(4250000);
  });

  it("produces a negative transfer when the wife earns more", () => {
    const totals = computeTotals(
      budgetWith({
        husbandIncome: 3000000,
        wifeIncome: 5000000
      })
    );
    expect(totals.equalSplitTransfer).toBe(-1000000);
    expect(totals.equalSplitAmount).toBe(4000000);
  });

  it("reports the share of income used by fixed expenses", () => {
    const totals = computeTotals(
      budgetWith({
        husbandIncome: 3000000,
        wifeIncome: 1000000,
        husbandFixed: [{ id: "h1", name: "Sewa", amount: 2000000 }]
      })
    );
    expect(totals.usedPercentFixed).toBe(50);
  });

  it("does not divide by zero when there is no income", () => {
    const totals = computeTotals(budgetWith());
    expect(totals.usedPercentFixed).toBe(0);
    expect(totals.equalSplitTransfer).toBe(0);
  });

  it("sums the daily buckets per spouse", () => {
    const totals = computeTotals(
      budgetWith({
        husbandDailyFromSalary: [{ id: "1", name: "Makan", amount: 50000, method: "QRIS" }],
        husbandDailyFromSavings: [{ id: "2", name: "Servis", amount: 100000, method: "Transfer" }],
        wifeDailyFromSalary: [{ id: "3", name: "Belanja", amount: 75000, method: "QRIS" }]
      })
    );
    expect(totals.husbandDailyFromSalaryTotal).toBe(50000);
    expect(totals.husbandDailyFromSavingsTotal).toBe(100000);
    expect(totals.wifeDailyFromSalaryTotal).toBe(75000);
    expect(totals.wifeDailyFromSavingsTotal).toBe(0);
    expect(totals.totalFixedExpenses).toBe(0);
  });
});

describe("totalExpenses", () => {
  it("adds fixed and every daily bucket", () => {
    const totals = computeTotals(
      budgetWith({
        husbandFixed: [{ id: "h", name: "Listrik", amount: 100000 }],
        wifeFixed: [{ id: "w", name: "Air", amount: 50000 }],
        husbandDailyFromSalary: [{ id: "1", name: "a", amount: 10000, method: "" }],
        husbandDailyFromSavings: [{ id: "2", name: "b", amount: 20000, method: "" }],
        wifeDailyFromSalary: [{ id: "3", name: "c", amount: 30000, method: "" }],
        wifeDailyFromSavings: [{ id: "4", name: "d", amount: 40000, method: "" }]
      })
    );
    expect(totalExpenses(totals)).toBe(250000);
  });
});

describe("sumAmount", () => {
  it("ignores missing lists and non-numeric amounts", () => {
    expect(sumAmount(undefined)).toBe(0);
    expect(sumAmount([{ amount: 1000 }, { amount: 2500 }])).toBe(3500);
    expect(sumAmount([{ amount: "3000" } as unknown as { amount: number }])).toBe(3000);
  });
});

describe("date helpers", () => {
  it("formats a Date as a local ISO day", () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("parses ISO days at local midnight", () => {
    const date = parseISODate("2026-02-28");
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(1);
    expect(date?.getDate()).toBe(28);
    expect(date?.getHours()).toBe(0);
  });

  it("rejects malformed dates", () => {
    expect(parseISODate(undefined)).toBeNull();
    expect(parseISODate("2026-2-3")).toBeNull();
    expect(parseISODate("not-a-date")).toBeNull();
  });

  it("counts whole days between two dates", () => {
    expect(daysBetween(new Date(2026, 0, 1), new Date(2026, 0, 31))).toBe(30);
    expect(daysBetween(new Date(2026, 0, 31), new Date(2026, 0, 1))).toBe(-30);
  });
});

describe("formatPeriod", () => {
  it("builds a readable label from the stored dates", () => {
    expect(formatPeriod("2026-10-25", "2026-11-24", "id-ID")).toBe("25 Okt - 24 Nov 2026");
  });

  it("returns an empty string when a date is missing", () => {
    expect(formatPeriod(undefined, "2026-11-24")).toBe("");
    expect(formatPeriod("2026-10-25", undefined)).toBe("");
  });
});

describe("misc helpers", () => {
  it("lists every month id of a year", () => {
    expect(monthsOfYear(2026)).toHaveLength(12);
    expect(monthsOfYear(2026)[0]).toBe("2026-01");
    expect(monthsOfYear(2026)[11]).toBe("2026-12");
  });

  it("creates distinct item ids", () => {
    expect(makeId()).not.toBe(makeId());
  });
});
