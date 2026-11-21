import { describe, expect, it } from "vitest";
import { buildBackupJson, parseBackup, toBudgetsCsv } from "./backup";
import { createEmptyBudget } from "./types";

function sampleBudget() {
  const budget = createEmptyBudget("2026-11");
  budget.title = "November 2026";
  budget.period = "25 November - 24 December 2026";
  budget.husbandIncome = 10_000_000;
  budget.husbandFixed.push({ id: "a", name: "Rent, house", amount: 3_000_000, checked: true });
  budget.wifeDailyFromSalary.push({
    id: "b",
    name: "Coffee",
    amount: 25_000,
    method: "QRIS",
    date: "2026-11-21"
  });
  budget.lastEditBy = "someone-else";
  return budget;
}

describe("backup", () => {
  it("round-trips a backup without foreign notification stamps", () => {
    const budget = sampleBudget();
    const { budgets, skipped } = parseBackup(buildBackupJson([budget]));
    expect(skipped).toBe(0);
    expect(budgets).toHaveLength(1);
    expect(budgets[0].husbandIncome).toBe(10_000_000);
    expect(budgets[0].husbandFixed[0].name).toBe("Rent, house");
    expect(budgets[0].wifeDailyFromSalary[0].date).toBe("2026-11-21");
    expect(budgets[0].lastEditBy).toBeUndefined();
    expect(budgets[0].updatedAt).toBeUndefined();
  });

  it("rejects files that are not backups", () => {
    expect(() => parseBackup("{oops")).toThrow();
    expect(() => parseBackup('{"hello":"world"}')).toThrow();
  });

  it("skips invalid periods and deduplicates by id", () => {
    const good = sampleBudget();
    const text = JSON.stringify({
      budgets: [good, { ...good, husbandIncome: 42 }, { id: "nope" }]
    });
    const { budgets, skipped } = parseBackup(text);
    expect(budgets).toHaveLength(1);
    expect(budgets[0].husbandIncome).toBe(42);
    expect(skipped).toBe(1);
  });

  it("drops invalid line items but keeps the period", () => {
    const good = sampleBudget();
    const text = JSON.stringify({
      budgets: [
        {
          ...good,
          husbandFixed: [good.husbandFixed[0], { id: "x", name: "", amount: 1 }]
        }
      ]
    });
    const { budgets, skipped } = parseBackup(text);
    expect(budgets[0].husbandFixed).toHaveLength(1);
    expect(skipped).toBe(1);
  });

  it("writes a readable CSV with escaped cells", () => {
    const csv = toBudgetsCsv([sampleBudget()]);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(5);
    expect(lines[0]).toBe("month,title,period,section,item,amount,method,date,checked");
    expect(lines[3]).toContain('"Rent, house"');
    expect(lines[4]).toContain("QRIS");
  });
});
