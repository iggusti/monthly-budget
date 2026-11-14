import { describe, expect, it } from "vitest";
import { allMonthsTo, currentPeriodId, monthLabel, previousMonthId } from "./period";

describe("currentPeriodId", () => {
  it("is already in this month's period on the 25th", () => {
    expect(currentPeriodId(new Date(2026, 10, 25))).toBe("2026-11");
  });

  it("is still in the previous period on the 24th", () => {
    expect(currentPeriodId(new Date(2026, 10, 24))).toBe("2026-10");
  });

  it("rolls the year over in early January", () => {
    expect(currentPeriodId(new Date(2026, 0, 5))).toBe("2025-12");
    expect(currentPeriodId(new Date(2026, 0, 25))).toBe("2026-01");
  });

  it("uses today when no date is given", () => {
    expect(currentPeriodId()).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe("previousMonthId", () => {
  it("steps back one calendar month", () => {
    expect(previousMonthId("2026-10")).toBe("2026-09");
  });

  it("rolls the year over from January", () => {
    expect(previousMonthId("2026-01")).toBe("2025-12");
  });
});

describe("allMonthsTo", () => {
  it("lists every period from the start of the year", () => {
    expect(allMonthsTo("2026-02", 2026)).toEqual(["2026-01", "2026-02"]);
  });

  it("covers later years up to the end id", () => {
    const ids = allMonthsTo("2027-02", 2026);
    expect(ids).toHaveLength(14);
    expect(ids[0]).toBe("2026-01");
    expect(ids[13]).toBe("2027-02");
  });
});

describe("monthLabel", () => {
  it("labels the period with its end month", () => {
    expect(monthLabel("2026-10", "en-US")).toBe("November 2026");
    expect(monthLabel("2026-10", "id-ID")).toBe("November 2026");
  });

  it("rolls to the next year for December periods", () => {
    expect(monthLabel("2026-12", "en-US")).toBe("January 2027");
  });
});
