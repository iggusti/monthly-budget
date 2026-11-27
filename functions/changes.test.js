import { describe, expect, it } from "vitest";
import changes from "./changes.js";

const { buildActivityContent, buildContent, collectEvents, formatRupiah } = changes;

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

  it("reports a checked-only toggle as a status edit", () => {
    const before = doc({ husbandFixed: [{ ...expense("a", "Listrik", 150000), checked: false }] });
    const after = doc({ husbandFixed: [{ ...expense("a", "Listrik", 150000), checked: true }] });
    const events = collectEvents(before, after);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("edit");
    expect(events[0].previous.checked).toBe(false);
    expect(events[0].item.checked).toBe(true);
  });

  it("reports the wife-to-husband transfer toggle", () => {
    const received = collectEvents(doc({ transferReceived: false }), doc({ transferReceived: true }));
    expect(received).toEqual([{ type: "transfer", received: true }]);

    const pending = collectEvents(doc({ transferReceived: true }), doc({ transferReceived: false }));
    expect(pending).toEqual([{ type: "transfer", received: false }]);
  });

  it("ignores a checked-only change in a daily section", () => {
    const before = doc({ husbandDailyFromSalary: [{ ...expense("a", "Kopi", 20000), checked: false }] });
    const after = doc({ husbandDailyFromSalary: [{ ...expense("a", "Kopi", 20000), checked: true }] });
    expect(collectEvents(before, after)).toHaveLength(0);
  });

  it("detects a date-only edit as an edit", () => {
    const before = doc({ husbandDailyFromSalary: [{ ...expense("a", "Kopi", 20000), date: "2026-11-01" }] });
    const after = doc({ husbandDailyFromSalary: [{ ...expense("a", "Kopi", 20000), date: "2026-11-02" }] });
    const events = collectEvents(before, after);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("edit");
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
  const meta = {
    recipient: "wife",
    editorUid: "u1",
    devices: [{ uid: "u1", recipient: "husband", lang: "en", enabled: true }]
  };

  it("describes a single addition with its section", () => {
    const events = collectEvents(doc(), doc({ husbandFixed: [expense("a", "Listrik", 150000)] }));
    const content = buildContent("en", "November 2026", events, meta);
    expect(content).toMatchObject({
      title: "New expense",
      body: "Listrik · Rp 150.000\nHusband fixed expenses"
    });
    expect(content.html).toContain("<b>🟢 New expense</b>");
    expect(content.html).toContain("<b>Listrik</b>");
    expect(content.html).toContain("Rp 150.000");
    expect(content.html).toContain("<b>Category:</b> Husband fixed expenses");
    expect(content.html).toContain("from husband");
  });

  it("describes the transfer toggle with a month deep link", () => {
    const received = buildContent("en", "November 2026", [{ type: "transfer", received: true }], meta);
    expect(received.title).toBe("Transfer received");
    expect(received.body).toBe("November 2026\nTransfer received");
    expect(received.html).toContain("🔁 Transfer received");
    expect(received.html).toContain("<b>Status:</b> Transfer received");

    const pending = buildContent("id", "November 2026", [{ type: "transfer", received: false }], meta);
    expect(pending.title).toBe("Transfer ditandai belum diterima");
    expect(pending.html).toContain("<b>Status:</b> Transfer ditandai belum diterima");
  });

  it("combines a transfer toggle with expense changes", () => {
    const events = collectEvents(
      doc({ transferReceived: false }),
      doc({
        transferReceived: true,
        husbandFixed: [expense("a", "Listrik", 150000)]
      })
    );
    const content = buildContent("en", "November 2026", events, meta);
    expect(events).toHaveLength(2);
    expect(content.title).toBe("2 expense changes");
    expect(content.html).toContain("Transfer received");
    expect(content.html).toContain("Listrik");
  });

  it("shows when an expense was created and last updated", () => {
    const item = {
      ...expense("a", "Listrik", 150000),
      createdAt: "2026-11-25T12:02:00.000Z",
      updatedAt: "2026-11-27T12:04:00.000Z"
    };
    const events = collectEvents(doc(), doc({ husbandFixed: [item] }));
    const content = buildContent("en", "November 2026", events, meta);
    expect(content.html).toContain("<b>Created:</b>");
    expect(content.html).toContain("<b>Updated:</b>");
    expect(content.html).toContain("25 Nov 2026");
    expect(content.html).toContain("27 Nov 2026");
  });

  it("includes both timestamps on an edit card", () => {
    const beforeItem = {
      ...expense("a", "Listrik", 150000),
      createdAt: "2026-11-25T12:02:00.000Z",
      updatedAt: "2026-11-25T12:02:00.000Z"
    };
    const afterItem = {
      ...beforeItem,
      amount: 175000,
      updatedAt: "2026-11-27T12:04:00.000Z"
    };
    const events = collectEvents(
      doc({ husbandFixed: [beforeItem] }),
      doc({ husbandFixed: [afterItem] })
    );
    const content = buildContent("en", "November 2026", events, meta);
    expect(content.html).toContain("<b>Created:</b> 25 Nov 2026");
    expect(content.html).toContain("<b>Updated:</b> 27 Nov 2026");
  });

  it("shows the previous amount on an edit", () => {
    const events = collectEvents(
      doc({ husbandFixed: [expense("a", "Listrik", 150000)] }),
      doc({ husbandFixed: [expense("a", "Listrik", 175000)] })
    );
    const content = buildContent("id", "November 2026", events, meta);
    expect(content.body).toBe("Listrik · Rp 175.000\nsebelumnya Rp 150.000");
    expect(content.html).toContain("Rp 150.000 → <b>Rp 175.000</b>");
  });

  it("escapes user text before putting it into Telegram HTML", () => {
    const events = collectEvents(doc(), doc({ husbandFixed: [expense("a", "<script>&", 1000)] }));
    const content = buildContent("en", "November 2026", events, meta);
    expect(content.html).toContain("&lt;script&gt;&amp;");
    expect(content.html).not.toContain("<script>");
  });

  it("summarises multiple events with totals and caps the list at six lines", () => {
    const items = ["a", "b", "c", "d", "e", "f", "g"].map((id) =>
      expense(id, `Item ${id}`, 1000)
    );
    const events = collectEvents(doc(), doc({ husbandFixed: items }));
    const content = buildContent("en", "November 2026", events, meta);

    expect(content.title).toBe("7 expense changes");
    expect(content.body.split("\n")).toHaveLength(5);
    expect(content.body).toContain("+3 …");
    expect(content.html).toContain("Change summary");
    expect(content.html).toContain("Added: Rp 7.000");
    expect(content.html).toContain("+1 more changes");
  });

  it("uses the month title for a deleted month", () => {
    const content = buildContent("en", "November 2026", [{ type: "month-delete" }], meta);
    expect(content).toMatchObject({ title: "Month deleted", body: "November 2026" });
    expect(content.html).toContain("All budget data for this month has been deleted.");
  });
});


describe("buildActivityContent", () => {
  const meta = {
    recipient: "wife",
    editorUid: "u1",
    devices: [{ uid: "u1", recipient: "husband", lang: "en", enabled: true }]
  };

  it("marks successful actions as success", () => {
    const content = buildActivityContent("en", {
      action: "auth.login",
      outcome: "success",
      detail: "Anonymous sign-in",
      monthId: "2026-11"
    }, meta);
    expect(content.title).toBe("✅ Signed in");
    expect(content.html).toContain("✅ Success · 2026-11");
    expect(content.html).toContain("<b>Detail:</b> Anonymous sign-in");
    expect(content.html).toContain("from husband");
  });

  it("shows the error on a failed Firebase action", () => {
    const content = buildActivityContent("id", {
      action: "notify.enable",
      outcome: "error",
      detail: "wife",
      error: "permission-denied"
    }, meta);
    expect(content.title).toBe("⚠️ Notifikasi diaktifkan");
    expect(content.body).toContain("Gagal · Notifikasi diaktifkan");
    expect(content.html).toContain("<b>Kesalahan:</b> permission-denied");
    expect(content.html).toContain("⚠️ Gagal");
  });
});


describe("clearer notification copy", () => {
  const meta = {
    recipient: "wife",
    editorUid: "u1",
    devices: [{ uid: "u1", recipient: "husband", lang: "en", enabled: true }]
  };

  it("adds the queue time to a budget card", () => {
    const events = collectEvents(doc(), doc({ husbandFixed: [expense("a", "Listrik", 150000)] }));
    const content = buildContent("en", "November 2026", events, {
      ...meta,
      createdAt: "2026-11-25T08:15:00"
    });
    expect(content.html).toContain("November 2026 · 25 Nov 2026, 08.15");
    expect(content.html).toContain("from husband · 25 Nov 2026, 08.15");
    expect(content.html).not.toContain("✅ Success");
  });

  it("omits payment status from daily expense cards", () => {
    const events = collectEvents(doc(), doc({ husbandDailyFromSalary: [expense("a", "Kopi", 20000)] }));
    const content = buildContent("id", "November 2026", events, meta);
    expect(content.html).not.toContain("Status:");
    expect(content.html).toContain("<b>Kategori:</b> Harian suami (gaji)");
  });

  it("keeps payment status on fixed expense cards", () => {
    const events = collectEvents(doc(), doc({ husbandFixed: [expense("a", "Listrik", 150000)] }));
    const content = buildContent("id", "November 2026", events, meta);
    expect(content.html).toContain("<b>Status:</b>");
  });

  it("shows a payment-status change with before and after", () => {
    const before = doc({ husbandFixed: [{ ...expense("a", "Listrik", 150000), checked: false }] });
    const after = doc({ husbandFixed: [{ ...expense("a", "Listrik", 150000), checked: true }] });
    const content = buildContent("id", "November 2026", collectEvents(before, after), meta);
    expect(content.html).toContain("<b>Status:</b> Belum lunas → <b>Lunas</b>");
  });

  it("counts non-amount edits in the change summary", () => {
    const before = doc({ husbandFixed: [expense("a", "Listrik", 100000)] });
    const after = doc({
      husbandFixed: [expense("a", "Listrik PLN", 100000), expense("b", "Air", 50000)]
    });
    const content = buildContent("en", "November 2026", collectEvents(before, after), meta);
    expect(content.html).toContain("Changed: 1");
  });

  it("names the language action and translates its detail", () => {
    const content = buildActivityContent("id", {
      action: "notify.language",
      outcome: "success",
      detail: "id",
      createdAt: "2026-11-25T08:15:00"
    }, meta);
    expect(content.title).toContain("Bahasa notifikasi diperbarui");
    expect(content.html).toContain("Bahasa Indonesia");
    expect(content.html).toContain("25 Nov 2026, 08.15");
  });

  it("translates recipient details for notification toggles", () => {
    const content = buildActivityContent("id", {
      action: "notify.enable",
      outcome: "success",
      detail: "wife"
    }, meta);
    expect(content.html).toContain("<b>Detail:</b> untuk istri");
  });
});
