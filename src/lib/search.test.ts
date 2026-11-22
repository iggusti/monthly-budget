import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS,
  escapeRegExp,
  filtersActive,
  highlightText,
  itemMatchesFilters,
  matchesQuery,
  sectionMatchesFilters
} from "./search";

describe("matchesQuery", () => {
  it("matches everything for an empty query", () => {
    expect(matchesQuery("Kopi", undefined, "")).toBe(true);
    expect(matchesQuery("Kopi", undefined, "   ")).toBe(true);
  });

  it("matches the name case-insensitively", () => {
    expect(matchesQuery("Bayar Listrik", undefined, "listrik")).toBe(true);
    expect(matchesQuery("Bayar Listrik", undefined, "LISTRIK")).toBe(true);
  });

  it("matches the payment method too", () => {
    expect(matchesQuery("Kopi", "QRIS · BRI", "bri")).toBe(true);
    expect(matchesQuery("Kopi", undefined, "bri")).toBe(false);
  });

  it("does not match unrelated text", () => {
    expect(matchesQuery("Kopi", "QRIS", "listrik")).toBe(false);
  });
});

describe("search filters", () => {
  it("reports whether any filter is set", () => {
    expect(filtersActive(EMPTY_FILTERS)).toBe(false);
    expect(filtersActive({ ...EMPTY_FILTERS, person: "wife" })).toBe(true);
    expect(filtersActive({ ...EMPTY_FILTERS, channel: "BRI" })).toBe(true);
  });

  it("matches sections by person and kind", () => {
    expect(sectionMatchesFilters(0, { ...EMPTY_FILTERS, person: "husband" })).toBe(true);
    expect(sectionMatchesFilters(1, { ...EMPTY_FILTERS, person: "husband" })).toBe(false);
    expect(sectionMatchesFilters(2, { ...EMPTY_FILTERS, kind: "fixed" })).toBe(true);
    expect(sectionMatchesFilters(4, { ...EMPTY_FILTERS, kind: "savings" })).toBe(false);
    expect(sectionMatchesFilters(2, { ...EMPTY_FILTERS, method: "QRIS" })).toBe(false);
    expect(sectionMatchesFilters(2, { ...EMPTY_FILTERS, channel: "BRI" })).toBe(false);
    expect(sectionMatchesFilters(0, { ...EMPTY_FILTERS, channel: "BRI" })).toBe(false);
  });

  it("matches items by method and date range", () => {
    const item = { method: "QRIS · BRI", date: "2026-11-10" };
    expect(itemMatchesFilters(item, { ...EMPTY_FILTERS, method: "QRIS" })).toBe(true);
    expect(itemMatchesFilters(item, { ...EMPTY_FILTERS, method: "Transfer" })).toBe(false);
    expect(itemMatchesFilters(item, { ...EMPTY_FILTERS, channel: "BRI" })).toBe(true);
    expect(itemMatchesFilters(item, { ...EMPTY_FILTERS, channel: "GoPay" })).toBe(false);
    expect(itemMatchesFilters(item, { ...EMPTY_FILTERS, from: "2026-11-11" })).toBe(false);
    expect(itemMatchesFilters(item, { ...EMPTY_FILTERS, to: "2026-11-09" })).toBe(false);
    expect(itemMatchesFilters(item, { ...EMPTY_FILTERS, to: "2026-11-10" })).toBe(true);
  });
});

describe("escapeRegExp", () => {
  it("escapes every regex metacharacter", () => {
    expect(escapeRegExp("a.b*c+d?")).toBe("a\\.b\\*c\\+d\\?");
  });
});

describe("highlightText", () => {
  it("returns the name unchanged for an empty query", () => {
    expect(highlightText("Kopi", " ")).toBe("Kopi");
  });

  it("wraps every occurrence in <mark>", () => {
    expect(highlightText("Kopi Kopi", "kopi")).toBe("<mark>Kopi</mark> <mark>Kopi</mark>");
  });

  it("treats regex characters in the query literally", () => {
    expect(highlightText("Harga (naik)", "(naik)")).toBe("Harga <mark>(naik)</mark>");
  });
});
