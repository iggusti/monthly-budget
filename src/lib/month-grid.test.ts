import { describe, expect, it } from "vitest";
import { monthPageSize, monthRowsForColumns } from "./month-grid";

describe("monthRowsForColumns", () => {
  it("shows four rows in a single-column phone layout", () => {
    expect(monthRowsForColumns(1)).toBe(4);
  });

  it("shows three rows for two columns", () => {
    expect(monthRowsForColumns(2)).toBe(3);
  });

  it("shows two rows once the grid is three columns or wider", () => {
    expect(monthRowsForColumns(3)).toBe(2);
    expect(monthRowsForColumns(4)).toBe(2);
    expect(monthRowsForColumns(6)).toBe(2);
  });

  it("falls back to a single column for invalid input", () => {
    expect(monthRowsForColumns(0)).toBe(4);
    expect(monthRowsForColumns(-2)).toBe(4);
    expect(monthRowsForColumns(Number.NaN)).toBe(4);
  });
});

describe("monthPageSize", () => {
  it("fills whole rows for every layout", () => {
    expect(monthPageSize(1)).toBe(4); // phone: 4 rows
    expect(monthPageSize(2)).toBe(6); // tablet: 3 rows
    expect(monthPageSize(3)).toBe(6); // small desktop: 2 rows
    expect(monthPageSize(4)).toBe(8); // desktop: 2 rows
    expect(monthPageSize(5)).toBe(10);
  });

  it("never returns zero or a fraction", () => {
    expect(monthPageSize(0)).toBe(4);
    expect(monthPageSize(2.7)).toBe(6);
  });
});
