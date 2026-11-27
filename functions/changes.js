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
    was: "sebelumnya",
    success: "Berhasil",
    failed: "Gagal",
    detail: "Detail",
    errorLabel: "Kesalahan",
    name: "Nama",
    amount: "Jumlah",
    category: "Kategori",
    method: "Metode",
    date: "Tanggal",
    status: "Status",
    created: "Dibuat",
    updated: "Diperbarui",
    paid: "Lunas",
    unpaid: "Belum lunas",
    fromHusband: "dari suami",
    fromWife: "dari istri",
    fromUnknown: "dari perangkat lain",
    added: "Ditambahkan",
    removed: "Dihapus",
    net: "Selisih bersih",
    summary: "Ringkasan perubahan",
    more: "perubahan lainnya",
    changed: "Diubah",
    period: "Periode",
    monthDeletedBody: "Seluruh data anggaran untuk bulan ini telah dihapus.",
    footer: "Dikirim otomatis oleh Monthly Budget"
  },
  en: {
    add: "New expense",
    edit: "Expense updated",
    delete: "Expense deleted",
    monthDelete: "Month deleted",
    changes: "expense changes",
    was: "was",
    success: "Success",
    failed: "Failed",
    detail: "Detail",
    errorLabel: "Error",
    name: "Name",
    amount: "Amount",
    category: "Category",
    method: "Method",
    date: "Date",
    status: "Status",
    created: "Created",
    updated: "Updated",
    paid: "Paid",
    unpaid: "Unpaid",
    fromHusband: "from husband",
    fromWife: "from wife",
    fromUnknown: "from another device",
    added: "Added",
    removed: "Removed",
    net: "Net change",
    summary: "Change summary",
    more: "more changes",
    changed: "Changed",
    period: "Period",
    monthDeletedBody: "All budget data for this month has been deleted.",
    footer: "Sent automatically by Monthly Budget"
  }
};

const ICONS = { add: "🟢", edit: "✏️", delete: "🔴", "month-delete": "🗑️", many: "📊" };

const ACTIVITY_LABEL = {
  id: {
    "budget.save": "Anggaran disimpan",
    "budget.delete": "Anggaran dihapus",
    "auth.login": "Masuk ke aplikasi",
    "auth.logout": "Keluar dari aplikasi",
    "notify.enable": "Notifikasi diaktifkan",
    "notify.disable": "Notifikasi dimatikan",
    "notify.language": "Bahasa notifikasi diperbarui"
  },
  en: {
    "budget.save": "Budget saved",
    "budget.delete": "Budget deleted",
    "auth.login": "Signed in",
    "auth.logout": "Signed out",
    "notify.enable": "Notifications enabled",
    "notify.disable": "Notifications disabled",
    "notify.language": "Notification language updated"
  }
};

const ACTIVITY_DETAILS = {
  id: {
    "Anonymous sign-in": "Masuk anonim",
    "Signed out": "Keluar dari aplikasi",
    husband: "untuk suami",
    wife: "untuk istri",
    device: "pada perangkat ini",
    id: "Bahasa Indonesia",
    en: "English"
  },
  en: {
    "Anonymous sign-in": "Anonymous sign-in",
    "Signed out": "Signed out",
    husband: "for husband",
    wife: "for wife",
    device: "on this device",
    id: "Indonesian",
    en: "English"
  }
};


function formatRupiah(amount) {
  return "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(Number(amount) || 0));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function sectionLabel(lang, section) {
  return section ? section.label[lang] : "";
}

function itemKey(item, index) {
  if (item && typeof item === "object" && item.id) return String(item.id);
  return `#${index}`;
}

/** Daily spending is already paid, so it has no payment-status concept. */
function isDailySection(key) {
  return String(key ?? "").includes("Daily");
}

/** Compare every editable field; status only matters for fixed expenses. */
function sameItem(a, b, includeStatus = true) {
  return (
    String(a.name ?? "") === String(b.name ?? "") &&
    Number(a.amount ?? 0) === Number(b.amount ?? 0) &&
    String(a.method ?? "") === String(b.method ?? "") &&
    String(a.date ?? "") === String(b.date ?? "") &&
    (!includeStatus || Boolean(a.checked) === Boolean(b.checked))
  );
}

function diffSection(beforeList, afterList, section) {
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
    } else if (!sameItem(beforeMap.get(key), item, !isDailySection(section.key))) {
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
    const { added, edited, removed } = diffSection(before?.[section.key], after?.[section.key], section);

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

function row(label, value) {
  return `<b>${escapeHtml(label)}:</b> ${escapeHtml(value || "—")}`;
}

function changeRow(label, from, to) {
  return `<b>${escapeHtml(label)}:</b> ${escapeHtml(from || "—")} → <b>${escapeHtml(to || "—")}</b>`;
}

function editorLabel(lang, meta) {
  const text = TEXT[lang];
  const editor = (Array.isArray(meta.devices) ? meta.devices : []).find(
    (device) => device && device.uid === meta.editorUid
  );
  if (editor?.recipient === "husband") return text.fromHusband;
  if (editor?.recipient === "wife") return text.fromWife;
  return text.fromUnknown;
}

function footer(lang, meta) {
  const outcome = meta.outcome === "error" ? `⚠️ ${TEXT[lang].failed}` : "";
  const when = meta.createdAt ? formatTime(meta.createdAt) : "";
  const parts = [outcome, editorLabel(lang, meta), when].filter(Boolean);
  const suffix = parts.length ? ` · ${escapeHtml(parts.join(" · "))}` : "";
  return `───────────\n<i>${escapeHtml(TEXT[lang].footer)}${suffix}</i>`;
}

function htmlForSingle(lang, monthTitle, event, meta) {
  const text = TEXT[lang];
  const when = meta.createdAt ? formatTime(meta.createdAt) : "";
  const stamp = [monthTitle || "", when].filter(Boolean).join(" · ");
  const head = `<b>${ICONS[event.type] || "•"} ${escapeHtml(eventTitle(lang, event.type))}</b>\n<i>${escapeHtml(stamp)}</i>\n`;

  if (event.type === "month-delete") {
    return `${head}\n${escapeHtml(text.monthDeletedBody)}\n\n${footer(lang, meta)}`;
  }

  const item = event.item || {};
  const amount = formatRupiah(item.amount);
  const name = item.name || "—";
  const daily = isDailySection(event.section?.key);
  const details = [
    row(text.category, sectionLabel(lang, event.section)),
    row(text.method, item.method),
    row(text.date, formatDate(item.date)),
    ...(daily ? [] : [row(text.status, item.checked ? text.paid : text.unpaid)]),
    row(text.created, formatTime(item.createdAt)),
    row(text.updated, formatTime(item.updatedAt))
  ];

  if (event.type === "edit") {
    const previous = event.previous || {};
    const changes = [];
    if (String(previous.name ?? "") !== String(item.name ?? "")) {
      changes.push(changeRow(text.name, previous.name || "—", name));
    }
    if (Number(previous.amount ?? 0) !== Number(item.amount ?? 0)) {
      changes.push(changeRow(text.amount, formatRupiah(previous.amount), amount));
    }
    if (String(previous.method ?? "") !== String(item.method ?? "")) {
      changes.push(changeRow(text.method, previous.method || "—", item.method || "—"));
    }
    if (String(previous.date ?? "") !== String(item.date ?? "")) {
      changes.push(changeRow(text.date, formatDate(previous.date), formatDate(item.date)));
    }
    if (!daily && Boolean(previous.checked) !== Boolean(item.checked)) {
      changes.push(changeRow(text.status, previous.checked ? text.paid : text.unpaid, item.checked ? text.paid : text.unpaid));
    }
    changes.push(row(text.created, formatTime(item.createdAt || previous.createdAt)));
    changes.push(row(text.updated, formatTime(item.updatedAt)));
    if (changes.length === 2) changes.push(row(text.category, sectionLabel(lang, event.section)));
    return `${head}\n<b>${escapeHtml(name)}</b>\n<b>${amount}</b>\n\n${changes.join("\n")}\n\n${footer(lang, meta)}`;
  }

  return `${head}\n<b>${escapeHtml(name)}</b>\n<b>${amount}</b>\n\n${details.join("\n")}\n\n${footer(lang, meta)}`;
}

function htmlForMany(lang, monthTitle, events, meta) {
  const text = TEXT[lang];
  const when = meta.createdAt ? formatTime(meta.createdAt) : "";
  const stamp = [monthTitle || "", when].filter(Boolean).join(" · ");
  const head = `<b>${ICONS.many} ${events.length} ${escapeHtml(text.changes)}</b>\n<i>${escapeHtml(stamp)}</i>\n`;

  const lines = events.slice(0, 6).map((event, index) => {
    const label = event.type === "month-delete" ? text.monthDelete : eventTitle(lang, event.type);
    const name = event.item ? event.item.name || "—" : monthTitle || "—";
    const amount = event.item ? formatRupiah(event.item.amount) : "";
    const whenItem = event.item ? formatTime(event.item.updatedAt || event.item.createdAt) : "";
    const subline = [label, sectionLabel(lang, event.section), whenItem]
      .filter(Boolean)
      .map((part) => escapeHtml(part))
      .join(" · ");
    return `${index + 1}. <b>${escapeHtml(name)}</b>${amount ? ` — ${escapeHtml(amount)}` : ""}\n   <i>${subline}</i>`;
  });
  const more = events.length > 6 ? `\n\n+${events.length - 6} ${escapeHtml(text.more)}` : "";

  let added = 0;
  let removed = 0;
  let changed = 0;
  let delta = 0;
  for (const event of events) {
    const amount = Number(event.item?.amount || 0);
    if (event.type === "add") {
      added += amount;
      delta += amount;
    } else if (event.type === "delete") {
      removed += amount;
      delta -= amount;
    } else if (event.type === "edit") {
      changed += 1;
      const change = amount - Number(event.previous?.amount || 0);
      delta += change;
      if (change >= 0) added += change;
      else removed -= change;
    }
  }

  const summary = [
    `<b>${escapeHtml(text.summary)}</b>`,
    `${escapeHtml(text.added)}: ${formatRupiah(added)}`,
    `${escapeHtml(text.removed)}: ${formatRupiah(removed)}`,
    `${escapeHtml(text.changed)}: ${changed}`,
    `${escapeHtml(text.net)}: ${delta >= 0 ? "+" : "−"}${formatRupiah(Math.abs(delta))}`
  ].join("\n");

  return `${head}\n${lines.join("\n\n")}${more}\n\n${summary}\n\n${footer(lang, meta)}`;
}

/** Compose a card for an audit action (auth, device toggle, or no-diff save). */
function buildActivityContent(lang, activity, meta = {}) {
  const text = TEXT[lang];
  const label = ACTIVITY_LABEL[lang][activity.action] || activity.action;
  const failed = activity.outcome === "error";
  const outcome = failed ? text.failed : text.success;
  const icon = failed ? "⚠️" : "✅";
  const rawDetail = activity.detail || "";
  const detail = ACTIVITY_DETAILS[lang][rawDetail] || rawDetail;
  const detailLabel = activity.action?.startsWith("budget.") ? text.period : text.detail;
  const when = activity.createdAt ? formatTime(activity.createdAt) : "";
  const stamp = [`${icon} ${outcome}`, when, activity.monthId].filter(Boolean).join(" · ");

  const lines = [
    `<b>${icon} ${escapeHtml(label)}</b>`,
    `<i>${escapeHtml(stamp)}</i>`
  ];
  if (detail) lines.push(`<b>${escapeHtml(detailLabel)}:</b> ${escapeHtml(detail)}`);
  if (activity.error) lines.push(`<b>${escapeHtml(text.errorLabel)}:</b> ${escapeHtml(activity.error)}`);
  lines.push("", footer(lang, { ...meta, outcome: activity.outcome, createdAt: activity.createdAt }));

  return {
    title: `${icon} ${label}`,
    body: `${outcome} · ${label}${detail ? `\n${detail}` : ""}${activity.error ? `\n${text.errorLabel}: ${activity.error}` : ""}`,
    html: lines.join("\n")
  };
}

/** Compose the title/body/html for one recipient language. */
function buildContent(lang, monthTitle, events, meta = {}) {
  const text = TEXT[lang];

  if (events.length === 1) {
    const event = events[0];

    if (event.type === "month-delete") {
      return {
        title: text.monthDelete,
        body: monthTitle || "",
        html: htmlForSingle(lang, monthTitle, event, meta)
      };
    }

    const item = event.item;
    const amount = formatRupiah(item.amount);

    if (event.type === "edit") {
      const previous = formatRupiah(event.previous?.amount);
      const detail = previous !== amount ? `${text.was} ${previous}` : sectionLabel(lang, event.section);
      return {
        title: text.edit,
        body: `${item.name || "—"} · ${amount}\n${detail}`,
        html: htmlForSingle(lang, monthTitle, event, meta)
      };
    }

    return {
      title: eventTitle(lang, event.type),
      body: `${item.name || "—"} · ${amount}\n${sectionLabel(lang, event.section)}`,
      html: htmlForSingle(lang, monthTitle, event, meta)
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
    body: lines.join("\n"),
    html: htmlForMany(lang, monthTitle, events, meta)
  };
}

module.exports = {
  SECTIONS,
  TEXT,
  formatRupiah,
  collectEvents,
  buildContent,
  buildActivityContent
};
