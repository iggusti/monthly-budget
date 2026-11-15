import { describe, expect, it } from "vitest";
import { equalSplitCardKind, isPeriodStartDay } from "./equal-split";

describe("equalSplitCardKind", () => {
  it("keeps the transfer card while a Wife → Husband transfer is pending", () => {
    expect(equalSplitCardKind(-523_000, false, false)).toBe("transfer");
    // The period-start day does not matter for this direction.
    expect(equalSplitCardKind(-523_000, false, true)).toBe("transfer");
  });

  it("switches to the planned budget once the wife's transfer is received", () => {
    expect(equalSplitCardKind(-523_000, true, false)).toBe("plan");
    expect(equalSplitCardKind(-523_000, true, true)).toBe("plan");
  });

  it("shows a Husband → Wife transfer only on the period's first day", () => {
    expect(equalSplitCardKind(523_000, false, true)).toBe("transfer");
    expect(equalSplitCardKind(523_000, false, false)).toBe("plan");
  });

  it("ignores `transferReceived` for the Husband → Wife direction", () => {
    expect(equalSplitCardKind(523_000, true, true)).toBe("transfer");
    expect(equalSplitCardKind(523_000, true, false)).toBe("plan");
  });

  it("shows the planned budget when the split is already equal", () => {
    expect(equalSplitCardKind(0, false, true)).toBe("plan");
    expect(equalSplitCardKind(0, true, false)).toBe("plan");
  });
});

describe("isPeriodStartDay", () => {
  const now = new Date(2026, 10, 25); // 25 Nov 2026, local time.

  it("matches the stored start date", () => {
    expect(isPeriodStartDay("2026-11-25", now)).toBe(true);
  });

  it("is false on any other day", () => {
    expect(isPeriodStartDay("2026-11-24", now)).toBe(false);
    expect(isPeriodStartDay("2026-11-26", now)).toBe(false);
  });

  it("is false when the budget has no start date", () => {
    expect(isPeriodStartDay(undefined, now)).toBe(false);
  });
});
