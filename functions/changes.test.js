import { describe, expect, it } from "vitest";
import changes from "./changes.js";

const { buildContent, collectEvents, formatRupiah } = changes;

const expense = (id, name, amount, method = "QRIS") => ({ id, name, amount, method });

function doc(overrides = {}) {
  return {
    title: "November 2026",
    husbandFixed: [],
    wifeFixed: [],
    husbandDailyFromSalary: [],
    husbandDailyFromSavings: [],
    wifeDailyFromSalary: [],
    wifeDailyFromSavings: [],
    ...overrides
  };
}

describe("formatRupiah", () => {
  it("rounds and formats with Indonesian separators", () => {
    expect(formatRupiah(1250000)).toBe("Rp 1.250.000");
    expect(formatRupiah(999.6)).toBe("Rp 1.000");
    expect(formatRupiah(undefined)).toBe("Rp 0");
  });
});

describe("collectEvents", () => {
  it("detects an added item", () => {
    const events = collectEvents(doc(), doc({ husbandFixed: [expense("a", "Listrik", 150000)] }));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "add", item: { name: "Listrik" } });
  });

  it("detects a renamed, re-priced or method-changed item as an edit", () => {
    const before = doc({ husbandFixed: [expense("a", "Listrik", 150000)] });
    for (const after of [
      doc({ husbandFixed: [expense("a", "Listrik PLN", 150000)] }),
      doc({ husbandFixed: [expense("a", "Listrik", 175000)] }),
      doc({ husbandFixed: [expense("a", "Listrik", 150000, "Cash")] })
    ]) {
      const events = collectEvents(before, after);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("edit");
    }
  });

  it("ignores checked-only toggles on fixed expenses", () => {
    const before = doc({ husbandFixed: [{ ...expense("a", "Listrik", 150000), checked: false }] });
    const after = doc({ husbandFixed: [{ ...expense("a", "Listrik", 150000), checked: true }] });
    expect(collectEvents(before, after)).toEqual([]);
  });

  it("ignores a date-only edit", () => {
    const before = doc({ husbandDailyFromSalary: [{ ...expense("a", "Kopi", 20000), date: "2026-11-01" }] });
    const after = doc({ husbandDailyFromSalary: [{ ...expense("a", "Kopi", 20000), date: "2026-11-02" }] });
    expect(collectEvents(before, after)).toEqual([]);
  });

  it("detects a removed item", () => {
    const events = collectEvents(doc({ wifeFixed: [expense("w", "Koperasi", 350000)] }), doc());
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "delete", item: { name: "Koperasi" } });
  });

  it("reports changes across several sections", () => {
    const events = collectEvents(
      doc(),
      doc({
        husbandFixed: [expense("a", "Listrik", 150000)],
        wifeDailyFromSavings: [expense("b", "Servis", 100000)]
      })
    );
    expect(events.map((event) => event.section.key)).toEqual([
      "husbandFixed",
      "wifeDailyFromSavings"
    ]);
  });

  it("tolerates missing lists", () => {
    expect(collectEvents(undefined, {})).toEqual([]);
  });
});

describe("buildContent", () => {
  it("describes a single addition with its section", () => {
    const events = collectEvents(doc(), doc({ husbandFixed: [expense("a", "Listrik", 150000)] }));
    expect(buildContent("en", "November 2026", events)).toEqual({
      title: "New expense",
      body: "Listrik · Rp 150.000\nHusband fixed expenses"
    });
  });

  it("shows the previous amount on an edit", () => {
    const events = collectEvents(
      doc({ husbandFixed: [expense("a", "Listrik", 150000)] }),
      doc({ husbandFixed: [expense("a", "Listrik", 175000)] })
    );
    expect(buildContent("id", "November 2026", events).body).toBe(
      "Listrik · Rp 175.000\nsebelumnya Rp 150.000"
    );
  });

  it("summarises multiple events and caps the list at four lines", () => {
    const items = ["a", "b", "c", "d", "e"].map((id) =>
      expense(id, `Item ${id}`, 1000)
    );
    const events = collectEvents(doc(), doc({ husbandFixed: items }));
    const content = buildContent("en", "November 2026", events);

    expect(content.title).toBe("5 expense changes");
    expect(content.body.split("\n")).toHaveLength(5);
    expect(content.body).toContain("+1 …");
  });

  it("uses the month title for a deleted month", () => {
    expect(buildContent("en", "November 2026", [{ type: "month-delete" }])).toEqual({
      title: "Month deleted",
      body: "November 2026"
    });
  });
});
