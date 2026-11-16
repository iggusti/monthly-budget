import { describe, expect, it } from "vitest";
import {
  allMonthsTo,
  currentPeriodId,
  isUpcomingPeriod,
  latestPeriodId,
  monthLabel,
  previousMonthId
} from "./period";

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

describe("latestPeriodId", () => {
  it("lists the upcoming period from the 21st", () => {
    expect(latestPeriodId(new Date(2026, 9, 21))).toBe("2026-10");
    expect(latestPeriodId(new Date(2026, 9, 24))).toBe("2026-10");
  });

  it("is still in the previous period on the 20th", () => {
    expect(latestPeriodId(new Date(2026, 9, 20))).toBe("2026-09");
  });

  it("stays one period ahead of the active period between the 21st and 24th", () => {
    const day = new Date(2026, 9, 22);
    expect(latestPeriodId(day)).toBe("2026-10");
    expect(currentPeriodId(day)).toBe("2026-09");
  });

  it("rolls the year over in early January", () => {
    expect(latestPeriodId(new Date(2026, 0, 5))).toBe("2025-12");
    expect(latestPeriodId(new Date(2026, 0, 21))).toBe("2026-01");
  });

  it("uses today when no date is given", () => {
    expect(latestPeriodId()).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe("isUpcomingPeriod", () => {
  it("is true for the period listed between the 21st and the 24th", () => {
    expect(isUpcomingPeriod("2026-10", new Date(2026, 9, 22))).toBe(true);
    expect(isUpcomingPeriod("2026-09", new Date(2026, 9, 22))).toBe(false);
  });

  it("is false once the period becomes active on the 25th", () => {
    expect(isUpcomingPeriod("2026-10", new Date(2026, 9, 25))).toBe(false);
  });

  it("is false for the active period before the 21st", () => {
    expect(isUpcomingPeriod("2026-09", new Date(2026, 9, 10))).toBe(false);
  });

  it("is false for the previous period", () => {
    expect(isUpcomingPeriod("2026-08", new Date(2026, 9, 22))).toBe(false);
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
