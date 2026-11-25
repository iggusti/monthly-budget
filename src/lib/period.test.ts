import { describe, expect, it } from "vitest";
import {
  allMonthsTo,
  canEditDailyExpenses,
  currentPeriodId,
  isFuturePeriodId,
  isPastPeriodId,
  isPeriodLocked,
  isUpcomingPeriod,
  latestPeriodId,
  listedPeriodIds,
  monthLabel,
  periodDateCeiling,
  periodDateRange,
  periodQuickDates,
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

describe("isFuturePeriodId", () => {
  it("is true for a period past the newest listed one", () => {
    // On 16 Nov 2026 the newest listed period is 2026-10.
    const day = new Date(2026, 10, 16);
    expect(isFuturePeriodId("2026-11", day)).toBe(true);
    expect(isFuturePeriodId("2027-01", day)).toBe(true);
  });

  it("is false for the active and older listed periods", () => {
    const day = new Date(2026, 10, 16);
    expect(isFuturePeriodId("2026-10", day)).toBe(false);
    expect(isFuturePeriodId("2026-05", day)).toBe(false);
  });

  it("allows the upcoming period once the dashboard lists it on the 21st", () => {
    expect(isFuturePeriodId("2026-10", new Date(2026, 9, 22))).toBe(false);
  });
});

describe("isPastPeriodId", () => {
  it("is true for a period older than the active one", () => {
    const day = new Date(2026, 10, 16);
    expect(isPastPeriodId("2026-09", day)).toBe(true);
    expect(isPastPeriodId("2025-12", day)).toBe(true);
  });

  it("is false for the active and upcoming periods", () => {
    const day = new Date(2026, 10, 16);
    expect(isPastPeriodId("2026-10", day)).toBe(false);
    expect(isPastPeriodId("2026-11", day)).toBe(false);
  });
});

describe("isPeriodLocked", () => {
  const day = new Date(2026, 10, 16);

  it("locks past periods without needing a stored flag", () => {
    expect(isPeriodLocked("2026-09", undefined, day)).toBe(true);
  });

  it("honours an explicit unlock on a past period", () => {
    expect(isPeriodLocked("2026-09", false, day)).toBe(false);
  });

  it("allows an early lock on the active period", () => {
    expect(isPeriodLocked("2026-10", true, day)).toBe(true);
    expect(isPeriodLocked("2026-10", undefined, day)).toBe(false);
  });
});

describe("canEditDailyExpenses", () => {
  it("is false only for the upcoming period", () => {
    const day = new Date(2026, 9, 22);
    expect(canEditDailyExpenses("2026-10", day)).toBe(false);
    expect(canEditDailyExpenses("2026-09", day)).toBe(true);
  });

  it("becomes true once the period starts on the 25th", () => {
    expect(canEditDailyExpenses("2026-10", new Date(2026, 9, 25))).toBe(true);
  });
});

describe("listedPeriodIds", () => {
  it("lists the current year's months up to the newest listed period", () => {
    const ids = listedPeriodIds(new Date(2026, 10, 16));
    expect(ids).toHaveLength(10);
    expect(ids[0]).toBe("2026-01");
    expect(ids[9]).toBe("2026-10");
  });

  it("covers the previous year while the cycle is still in December", () => {
    const ids = listedPeriodIds(new Date(2026, 0, 5));
    expect(ids).toHaveLength(12);
    expect(ids[0]).toBe("2025-01");
    expect(ids[11]).toBe("2025-12");
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


describe("periodDateRange", () => {
  it("runs from the 25th of its own month to the 24th of the next", () => {
    expect(periodDateRange("2026-10")).toEqual({ start: "2026-10-25", end: "2026-11-24" });
  });

  it("rolls over the year", () => {
    expect(periodDateRange("2026-12")).toEqual({ start: "2026-12-25", end: "2027-01-24" });
  });
});

describe("periodDateCeiling", () => {
  it("is today while the period is open", () => {
    expect(periodDateCeiling("2026-10", new Date(2026, 10, 10))).toBe("2026-11-10");
  });

  it("is the period end after it closed", () => {
    expect(periodDateCeiling("2026-09", new Date(2026, 10, 10))).toBe("2026-10-24");
  });

  it("never goes before the period start", () => {
    expect(periodDateCeiling("2026-11", new Date(2026, 10, 10))).toBe("2026-11-25");
  });
});


describe("periodQuickDates", () => {
  it("offers only the 25th when the cycle starts", () => {
    expect(periodQuickDates("2026-11", new Date(2026, 10, 25))).toEqual(["2026-11-25"]);
  });

  it("adds one day on the 26th", () => {
    expect(periodQuickDates("2026-11", new Date(2026, 10, 26))).toEqual([
      "2026-11-26",
      "2026-11-25"
    ]);
  });

  it("caps at four dates later in the cycle", () => {
    expect(periodQuickDates("2026-11", new Date(2026, 10, 30))).toEqual([
      "2026-11-30",
      "2026-11-29",
      "2026-11-28",
      "2026-11-27"
    ]);
  });
});
