import { describe, expect, it } from "vitest";
import { buildBudgetsPdf, type PdfLabels } from "./backup-pdf";
import { createEmptyBudget, type MonthBudget } from "./types";

const labels: PdfLabels = {
  title: "Backup data",
  generated: "Generated {date}",
  summary: "Period summary",
  period: "Period",
  totalIncome: "Total income",
  totalExpense: "Total expenses",
  name: "Name",
  amount: "Amount",
  method: "Method",
  date: "Date",
  noItems: "No items",
  page: "Page {n} of {total}",
  sections: [
    "1. Husband income",
    "2. Wife income",
    "3. Husband fixed",
    "4. Wife fixed",
    "5. Husband salary",
    "6. Husband savings",
    "7. Wife salary",
    "8. Wife savings"
  ]
};

function sampleBudget(): MonthBudget {
  const budget = createEmptyBudget("2026-11");
  return {
    ...budget,
    husbandIncome: 5_000_000,
    wifeIncome: 3_000_000,
    husbandFixed: [{ id: "h1", name: "Rent", amount: 2_000_000, checked: true }],
    wifeFixed: [],
    husbandDailyFromSalary: [
      { id: "h2", name: "Groceries", amount: 250_000, method: "QRIS", date: "2026-11-05" }
    ],
    wifeDailyFromSavings: []
  };
}

describe("buildBudgetsPdf", () => {
  it("renders a cover and a page per period", async () => {
    const doc = await buildBudgetsPdf([sampleBudget()], labels);
    expect(doc.getNumberOfPages()).toBe(2);
    const bytes = doc.output("arraybuffer") as ArrayBuffer;
    expect(new TextDecoder().decode(new Uint8Array(bytes, 0, 5))).toBe("%PDF-");
  });

  it("handles an empty backup without throwing", async () => {
    const doc = await buildBudgetsPdf([], labels);
    expect(doc.getNumberOfPages()).toBe(1);
  });
});
