/**
 * Pure helpers for the notification sender.
 *
 * Kept free of Firebase imports so the diffing/formatting logic can be unit
 * tested (and reasoned about) without credentials.
 */

/** The six expense buckets, in the order the UI shows them. */
const SECTIONS = [
  { key: "husbandFixed", label: { id: "Pengeluaran tetap suami", en: "Husband fixed expenses" } },
  { key: "wifeFixed", label: { id: "Pengeluaran tetap istri", en: "Wife fixed expenses" } },
  { key: "husbandDailyFromSalary", label: { id: "Harian suami (gaji)", en: "Husband daily (salary)" } },
  { key: "husbandDailyFromSavings", label: { id: "Harian suami (tabungan)", en: "Husband daily (savings)" } },
  { key: "wifeDailyFromSalary", label: { id: "Harian istri (gaji)", en: "Wife daily (salary)" } },
  { key: "wifeDailyFromSavings", label: { id: "Harian istri (tabungan)", en: "Wife daily (savings)" } }
];

const TEXT = {
  id: {
    add: "Pengeluaran baru",
    edit: "Pengeluaran diubah",
    delete: "Pengeluaran dihapus",
    monthDelete: "Data bulan dihapus",
    changes: "perubahan pengeluaran",
    was: "sebelumnya"
  },
  en: {
    add: "New expense",
    edit: "Expense updated",
    delete: "Expense deleted",
    monthDelete: "Month deleted",
    changes: "expense changes",
    was: "was"
  }
};

function formatRupiah(amount) {
  return "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(Number(amount) || 0));
}

function sectionLabel(lang, section) {
  return section ? section.label[lang] : "";
}

function itemKey(item, index) {
  if (item && typeof item === "object" && item.id) return String(item.id);
  return `#${index}`;
}

/** Compare only the fields the family actually edits (`checked` is ignored). */
function sameItem(a, b) {
  return (
    String(a.name ?? "") === String(b.name ?? "") &&
    Number(a.amount ?? 0) === Number(b.amount ?? 0) &&
    String(a.method ?? "") === String(b.method ?? "")
  );
}

function diffSection(beforeList, afterList) {
  const beforeMap = new Map();
  const afterMap = new Map();

  (Array.isArray(beforeList) ? beforeList : []).forEach((item, index) => {
    beforeMap.set(itemKey(item, index), item);
  });
  (Array.isArray(afterList) ? afterList : []).forEach((item, index) => {
    afterMap.set(itemKey(item, index), item);
  });

  const added = [];
  const edited = [];
  const removed = [];

  for (const [key, item] of afterMap) {
    if (!beforeMap.has(key)) {
      added.push(item);
    } else if (!sameItem(beforeMap.get(key), item)) {
      edited.push({ item, previous: beforeMap.get(key) });
    }
  }
  for (const [key, item] of beforeMap) {
    if (!afterMap.has(key)) removed.push(item);
  }

  return { added, edited, removed };
}

/** Turn a before/after pair into a flat list of human-readable events. */
function collectEvents(before, after) {
  const events = [];

  for (const section of SECTIONS) {
    const { added, edited, removed } = diffSection(before?.[section.key], after?.[section.key]);

    for (const item of added) events.push({ type: "add", section, item });
    for (const change of edited) {
      events.push({ type: "edit", section, item: change.item, previous: change.previous });
    }
    for (const item of removed) events.push({ type: "delete", section, item });
  }

  return events;
}

function eventTitle(lang, type) {
  const text = TEXT[lang];
  if (type === "month-delete") return text.monthDelete;
  return text[type];
}

/** Compose the title/body for one recipient language. */
function buildContent(lang, monthTitle, events) {
  const text = TEXT[lang];

  if (events.length === 1) {
    const event = events[0];

    if (event.type === "month-delete") {
      return {
        title: text.monthDelete,
        body: monthTitle || ""
      };
    }

    const item = event.item;
    const amount = formatRupiah(item.amount);

    if (event.type === "edit") {
      const previous = formatRupiah(event.previous?.amount);
      const detail = previous !== amount ? `${text.was} ${previous}` : sectionLabel(lang, event.section);
      return {
        title: text.edit,
        body: `${item.name || "—"} · ${amount}\n${detail}`
      };
    }

    return {
      title: eventTitle(lang, event.type),
      body: `${item.name || "—"} · ${amount}\n${sectionLabel(lang, event.section)}`
    };
  }

  const lines = events.slice(0, 4).map((event) => {
    if (event.type === "month-delete") {
      return `− ${monthTitle || ""}`;
    }
    const sign = event.type === "add" ? "+" : event.type === "delete" ? "−" : "±";
    return `${sign} ${event.item.name || "—"} · ${formatRupiah(event.item.amount)}`;
  });
  if (events.length > 4) lines.push(`+${events.length - 4} …`);

  return {
    title: `${events.length} ${text.changes}`,
    body: lines.join("\n")
  };
}

module.exports = {
  SECTIONS,
  TEXT,
  formatRupiah,
  collectEvents,
  buildContent
};
