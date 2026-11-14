import { describe, expect, it } from "vitest";
import { escapeRegExp, highlightText, matchesQuery } from "./search";

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
