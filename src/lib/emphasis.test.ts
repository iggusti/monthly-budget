import { describe, it, expect } from "vitest";
import { splitEmphasis } from "./emphasis";

describe("splitEmphasis", () => {
  it("returns a single plain run when there are no markers", () => {
    expect(splitEmphasis("plain sentence")).toEqual([{ text: "plain sentence", strong: false }]);
  });

  it("returns nothing for empty input", () => {
    expect(splitEmphasis("")).toEqual([]);
  });

  it("splits a marker in the middle into three runs", () => {
    expect(splitEmphasis("leaving **Rp 1.000** unspent")).toEqual([
      { text: "leaving ", strong: false },
      { text: "Rp 1.000", strong: true },
      { text: " unspent", strong: false }
    ]);
  });

  it("handles markers at the start and at the end", () => {
    expect(splitEmphasis("**a** mid **b**")).toEqual([
      { text: "a", strong: true },
      { text: " mid ", strong: false },
      { text: "b", strong: true }
    ]);
  });

  it("keeps every run of a paragraph with several figures", () => {
    expect(splitEmphasis("dari {a} = **{b}**, tabungan **{c}**.")).toEqual([
      { text: "dari {a} = ", strong: false },
      { text: "{b}", strong: true },
      { text: ", tabungan ", strong: false },
      { text: "{c}", strong: true },
      { text: ".", strong: false }
    ]);
  });

  it("leaves an unclosed marker as literal text", () => {
    expect(splitEmphasis("leaving **Rp 1.000 unspent")).toEqual([
      { text: "leaving **Rp 1.000 unspent", strong: false }
    ]);
  });

  it("ignores single asterisks", () => {
    expect(splitEmphasis("2 * 3 * 4")).toEqual([{ text: "2 * 3 * 4", strong: false }]);
  });
});
