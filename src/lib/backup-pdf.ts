/**
 * PDF report for the saved budget periods.
 *
 * jsPDF and autoTable are imported lazily so the ~500 kB of PDF code is only
 * fetched when the user actually taps "Download PDF". Layout stays simple: a
 * period summary followed by one page per period with its eight sections.
 */

import { computeTotals, formatCurrency, totalExpenses, todayISO, type MonthBudget } from "./types";

export interface PdfLabels {
  title: string;
  generated: string;
  summary: string;
  period: string;
  totalIncome: string;
  totalExpense: string;
  name: string;
  amount: string;
  method: string;
  date: string;
  noItems: string;
  page: string;
  sections: readonly [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string
  ];
}

type Pdf = import("jspdf").jsPDF;
type TablePdf = Pdf & { lastAutoTable?: { finalY: number } };
type Rgb = [number, number, number];

const TEAL: Rgb = [91, 138, 138];
const INK: Rgb = [43, 43, 43];
const MUTED: Rgb = [110, 110, 110];
const STRIPE: Rgb = [237, 244, 244];

/** Standard PDF fonts are WinAnsi; normalise the few characters we might use. */
function safe(value: string): string {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u00A0]/g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

/** Build the report document without saving it, so layout can be tested. */
export async function buildBudgetsPdf(
  budgets: readonly MonthBudget[],
  labels: PdfLabels
): Promise<Pdf> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable")
  ]);

  const doc: TablePdf = new jsPDF({ unit: "mm", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 0;

  doc.setProperties({
    title: labels.title,
    subject: labels.generated,
    creator: "Monthly Budget Nia Ilham"
  });

  function newPage() {
    doc.addPage();
    doc.setFillColor(...TEAL);
    doc.rect(0, 0, width, 12, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(safe(labels.title), margin, 8);
    y = 20;
  }

  function table(head: string[], rows: string[][], rightAlign: number[] = []) {
    const columnStyles: Record<number, { halign: "right" }> = {};
    for (const column of rightAlign) columnStyles[column] = { halign: "right" };
    autoTable(doc, {
      startY: y,
      head: [head],
      body: rows.length > 0 ? rows : [[labels.noItems]],
      theme: "striped",
      margin: { left: margin, right: margin },
      styles: {
        font: "helvetica",
        fontSize: 8.5,
        cellPadding: 2.2,
        lineColor: [224, 229, 229],
        lineWidth: 0.1,
        textColor: INK,
        overflow: "linebreak"
      },
      headStyles: { fillColor: TEAL, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [247, 249, 249] },
      columnStyles
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 8;
  }

  function section(title: string, head: string[], rows: string[][]) {
    if (y > 245) newPage();
    doc.setFillColor(...STRIPE);
    doc.rect(margin, y - 5, width - margin * 2, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...TEAL);
    doc.text(safe(title), margin + 2, y);
    y += 6;
    table(head, rows, head.length > 2 ? [1] : [1]);
  }

  // Cover page: title, generation date and the one-glance summary.
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, width, 30, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text(safe(labels.title), margin, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(safe(labels.generated), margin, 22);

  y = 40;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text(safe(labels.summary), margin, y);
  y += 6;
  table(
    [labels.period, labels.totalIncome, labels.totalExpense],
    budgets.map((budget) => {
      const totals = computeTotals(budget);
      return [
        `${budget.title} (${budget.id})`,
        formatCurrency(totals.totalIncome),
        formatCurrency(totalExpenses(totals))
      ];
    }),
    [1, 2]
  );

  for (const budget of budgets) {
    newPage();
    const totals = computeTotals(budget);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...INK);
    doc.text(safe(budget.title || budget.id), margin, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(
      safe(
        `${labels.period}: ${budget.period}  |  ${labels.totalIncome}: ${formatCurrency(totals.totalIncome)}  |  ${labels.totalExpense}: ${formatCurrency(totalExpenses(totals))}`
      ),
      margin,
      y
    );
    y += 10;

    const money = (amount: number) => [formatCurrency(amount)];
    section(labels.sections[0], [labels.name, labels.amount], [[labels.totalIncome, ...money(budget.husbandIncome)]]);
    section(labels.sections[1], [labels.name, labels.amount], [[labels.totalIncome, ...money(budget.wifeIncome)]]);

    const fixed = (items: readonly { name: string; amount: number }[]) =>
      items.map((item) => [item.name, formatCurrency(item.amount)]);
    section(labels.sections[2], [labels.name, labels.amount], fixed(budget.husbandFixed));
    section(labels.sections[3], [labels.name, labels.amount], fixed(budget.wifeFixed));

    const daily = (items: readonly { name: string; amount: number; method?: string; date?: string }[]) =>
      items.map((item) => [item.name, formatCurrency(item.amount), item.method ?? "", item.date ?? ""]);
    section(labels.sections[4], [labels.name, labels.amount, labels.method, labels.date], daily(budget.husbandDailyFromSalary));
    section(labels.sections[5], [labels.name, labels.amount, labels.method, labels.date], daily(budget.husbandDailyFromSavings));
    section(labels.sections[6], [labels.name, labels.amount, labels.method, labels.date], daily(budget.wifeDailyFromSalary));
    section(labels.sections[7], [labels.name, labels.amount, labels.method, labels.date], daily(budget.wifeDailyFromSavings));
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(...STRIPE);
    doc.line(margin, 285, width - margin, 285);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(safe(labels.page.replace("{n}", String(page)).replace("{total}", String(pages))), width - margin, 290, {
      align: "right"
    });
  }

  return doc;
}

/** Build and download the report. */
export async function downloadBudgetsPdf(
  budgets: readonly MonthBudget[],
  labels: PdfLabels
): Promise<void> {
  const doc = await buildBudgetsPdf(budgets, labels);
  doc.save(`monthly-budget-${todayISO()}.pdf`);
}
