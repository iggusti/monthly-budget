import { describe, expect, it } from "vitest";
import {
  allExpensesChecked,
  showsViewMoreToggle,
  visibleExpenseItems
} from "./expense-list";
import type { ExpenseItem } from "./types";

function item(id: string, checked = false): ExpenseItem {
  return { id, name: id, amount: 1000, checked };
}

const base = { collapsible: true, showAll: false, collapseLimit: 3 };

describe("allExpensesChecked", () => {
  it("needs a checkboxable, non-empty, fully checked list", () => {
    expect(allExpensesChecked([item("a", true), item("b", true)], true)).toBe(true);
    expect(allExpensesChecked([item("a", true), item("b")], true)).toBe(false);
    expect(allExpensesChecked([], true)).toBe(false);
    expect(allExpensesChecked([item("a", true)], false)).toBe(false);
  });
});

describe("visibleExpenseItems", () => {
  const unpaidFirst = [item("u1"), item("u2"), item("c1", true), item("c2", true)];

  it("returns every item when the section is not collapsible", () => {
    expect(
      visibleExpenseItems(unpaidFirst, { ...base, collapsible: false, allChecked: false })
    ).toEqual(unpaidFirst);
  });

  it("returns every item when expanded", () => {
    expect(
      visibleExpenseItems(unpaidFirst, { ...base, showAll: true, allChecked: true })
    ).toEqual(unpaidFirst);
  });

  it("folds the whole list away when everything is paid", () => {
    expect(visibleExpenseItems(unpaidFirst, { ...base, allChecked: true })).toEqual([]);
  });

  it("backfills with the most recent paid items", () => {
    expect(visibleExpenseItems(unpaidFirst, { ...base, allChecked: false })).toEqual([
      item("u1"),
      item("u2"),
      item("c2", true)
    ]);
  });

  it("shows the last unpaid items when they reach the limit", () => {
    const five = [item("u1"), item("u2"), item("u3"), item("u4"), item("u5")];
    expect(visibleExpenseItems(five, { ...base, allChecked: false })).toEqual([
      item("u3"),
      item("u4"),
      item("u5")
    ]);
  });
});

describe("showsViewMoreToggle", () => {
  it("is always shown when everything is paid", () => {
    expect(
      showsViewMoreToggle({ ...base, itemCount: 2, allChecked: true })
    ).toBe(true);
  });

  it("is shown when the list is longer than the limit", () => {
    expect(
      showsViewMoreToggle({ ...base, itemCount: 9, allChecked: false })
    ).toBe(true);
  });

  it("stays available while expanded, so the list can collapse again", () => {
    expect(
      showsViewMoreToggle({ ...base, showAll: true, itemCount: 2, allChecked: false })
    ).toBe(true);
  });

  it("is hidden for short, partly unpaid lists", () => {
    expect(
      showsViewMoreToggle({ ...base, itemCount: 3, allChecked: false })
    ).toBe(false);
  });

  it("is hidden when the section is not collapsible", () => {
    expect(
      showsViewMoreToggle({ ...base, collapsible: false, itemCount: 20, allChecked: true })
    ).toBe(false);
  });
});
