/**
 * Lightweight internationalisation for Monthly Budget Nia Ilham.
 *
 * Two languages are supported: English (`en`, default) and Indonesian (`id`).
 * The chosen language is persisted in localStorage so it survives reloads and
 * is applied across the whole app (login, dashboard, month page, components).
 *
 * Usage in components:
 *   import { t, lang, setLang } from "#lib/i18n.svelte";
 *   <p>{t("dashboard.title")}</p>
 *   <button onclick={() => setLang("id")}>ID</button>
 */

export type Lang = "en" | "id";

const STORAGE_KEY = "fhb-lang";

/** Flat dictionary of `key -> text`, one entry per language. */
type Dict = Record<string, string>;

const en: Dict = {
  // ── Common ────────────────────────────────────────────────────────────────
  "common.husband": "Husband",
  "common.wife": "Wife",
  "common.salary": "salary",
  "common.savings": "savings",
  "common.fixed": "fixed",
  "common.cancel": "Cancel",
  "common.add": "Add",
  "common.saveChanges": "Save changes",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.viewLess": "View less",
  "common.viewMore": "View {n} more",
  "common.loading": "Loading…",

  // ── Layout / topbar ───────────────────────────────────────────────────────
  "nav.dashboard": "Dashboard",
  "nav.familyPlan": "Family Plan",
  "nav.signOut": "Sign out",
  "nav.language": "Language",
  "nav.theme": "Theme",
  "nav.themeLight": "Switch to light mode",
  "nav.themeDark": "Switch to dark mode",
  "nav.notificationsOn": "Notifications on · tap to turn off",
  "nav.notificationsOff": "Turn on notifications",
  "notify.unsupported": "This browser does not support push notifications.",
  "notify.unconfigured": "Push notifications are not configured yet.",
  "notify.denied": "Notifications are blocked. Allow them in your browser settings.",
  "notify.error": "Could not enable notifications. Please try again.",
  "notify.disabled": "Notifications turned off for this device.",
  "footer.tagline": "Monthly Budget Nia Ilham · Stay balanced, save together",

  // ── Login ─────────────────────────────────────────────────────────────────
  "login.title": "Monthly Budget Nia Ilham",
  "login.subtitle": "Plan together, save beautifully.",
  "login.fieldLabel": "Family keyword",
  "login.placeholder": "type the keyword…",
  "login.show": "Show keyword",
  "login.hide": "Hide keyword",
  "login.error": "Incorrect keyword. Please try again.",
  "login.signingIn": "Signing in…",
  "login.signIn": "Sign in",
  "login.hint": "Only family members know the keyword.",
  "login.pageTitle": "Sign in — Monthly Budget Nia Ilham",
  "seo.dashboardDescription":
    "A private family budget planner to balance husband and wife income, fixed expenses, daily spending and savings — one budget period at a time.",
  "seo.loginDescription":
    "Sign in to the family budget planner to track income, fixed expenses, daily spending and savings together.",
  "seo.monthDescription":
    "Edit one budget period: income, fixed expenses, daily spending from salary and savings, plus the money-flow overview.",

  // ── Dashboard ─────────────────────────────────────────────────────────────
  "dashboard.pageTitle": "Monthly Budget Nia Ilham",
  "dashboard.heroEyebrow": "Family Finance Tracker",
  "dashboard.heroTitleLine1": "Plan together.",
  "dashboard.heroTitleLine2": "Save beautifully.",
  "dashboard.heroSub":
    "Track husband and wife income, fixed expenses, daily spending and savings withdrawals — one budget period at a time.",
  "dashboard.thisMonth": "This month",
  "dashboard.totalIncome": "Total Income",
  "dashboard.totalFixed": "Total Fixed Expenses",
  "dashboard.totalExpense": "Total Expenses",
  "dashboard.expense": "Expenses",
  "dashboard.expenseBreakdown": "fixed + daily salary + savings",
  "dashboard.maxPlannedPerPerson": "Max Planned Budget Per Person",
  "dashboard.dailyFromSalary": "Total Daily Expenses from Salary",
  "dashboard.dailyFromSavings": "Total Daily Expenses from Savings",
  "dashboard.husbandWife": "husband + wife",
  "dashboard.husbandWifeFixed": "husband + wife fixed",
  "dashboard.afterFixedSplit": "after fixed, split evenly",
  "dashboard.budgetPeriods": "Budget Periods",
  "dashboard.active": "Active",
  "dashboard.past": "Past",
  "dashboard.new": "New",
  "dashboard.noBudgetYetTap": "No budget yet — tap to create",
  "dashboard.viewMore": "View more ({n} more)",
  "dashboard.loading": "Loading your budgets…",
  "dashboard.noBudgetTitle": "No budget yet",
  "dashboard.noBudgetText":
    "Create your first budget period from the month buttons above.",
  "dashboard.infoIncomeFixed": "Income & fixed",
  "dashboard.infoIncomeFixedSub": "husband and wife",
  "dashboard.infoSalary": "Daily from salary",
  "dashboard.infoSalarySub": "husband and wife",
  "dashboard.infoSavings": "Daily from savings",
  "dashboard.infoSavingsSub": "husband and wife",
  "dashboard.infoPerPerson": "Per person",
  "dashboard.infoPerPersonSub": "after fixed, split evenly",
  "dashboard.confirmDelete": "Delete {month}? This cannot be undone.",
  "dashboard.searchPlaceholder": "Search expenses across months…",
  "dashboard.searchEmpty": "No expenses found matching",

  // ── Month page ────────────────────────────────────────────────────────────
  "month.allMonths": "All months",
  "month.saving": "Saving…",
  "month.saved": "Saved {time}",
  "month.editable": "Editable",
  "month.editHeader": "Edit header",
  "month.fieldTitle": "Title",
  "month.fieldPeriod": "Budget period",
  "month.fieldPeriodFrom": "From",
  "month.fieldPeriodTo": "To",
  "month.fieldPeriodHint": "Pick a start and end date",
  "month.totalIncome": "Total Income",
  "month.totalExpense": "Total Expenses",
  "month.totalDailyFromSavings": "Total Daily Expenses from Savings",
  "month.equalSplitTransfer": "Equal Split Transfer",
  "month.eachHolds": "each holds {amount} after transfer",
  "month.chartTitle": "How this month's money flows",
  "month.chartIncomeTitle": "Income by source",
  "month.chartExpenseTitle": "Expenses by source",
  "month.chartIncomeAria": "Vertical bar chart of income by source",
  "month.chartExpenseAria": "Vertical bar chart of expenses by category",
  "month.chartFixedShort": "Fixed",
  "month.chartSalaryShort": "Daily salary",
  "month.chartSavingsShort": "Daily savings",
  "month.chartCombined": "Husband + Wife",
  "month.chartFixedSalaryShort": "Fixed + daily salary",
  "month.chartFixedSalarySavingsShort": "Fixed + daily salary + daily savings",
  "month.chartFixed": "Total Fixed Expenses",
  "month.chartSalary": "Total Daily Expenses from Salary",
  "month.chartRemaining": "Remaining",
  "month.totalIncomeLabel": "total income",
  "month.chartDonutAria": "Income allocation donut",
  "month.dailyFromSavings": "Total Daily Expenses from Savings",
  "month.chartConclusionIncome":
    "Income comes from {husband} (husband) + {wife} (wife) = {income}.",
  "month.chartConclusionSplit":
    "That income covers fixed expenses {fixed} and daily expenses from salary {salary}, leaving {remaining} unspent.",
  "month.chartConclusionSavings":
    "Total spending {total} also includes {savings} of daily expenses paid from savings — money outside this month's income.",
  "month.section1": "1. Husband Income",
  "month.section2": "2. Wife Income",
  "month.section3": "3. Husband Fixed Expenses",
  "month.section4": "4. Wife Fixed Expenses",
  "month.section5": "5. Husband Daily Expenses (from salary)",
  "month.section6": "6. Husband Daily Expenses (from savings)",
  "month.section7": "7. Wife Daily Expenses (from salary)",
  "month.section8": "8. Wife Daily Expenses (from savings)",
  "month.sourceLabel": "Source",
  "month.husbandIncome": "Husband monthly income",
  "month.wifeIncome": "Wife monthly income",
  "month.husbandFixedRemaining": "Husband fixed — remaining",
  "month.wifeFixedRemaining": "Wife fixed — remaining",
  "month.subtotalSalary": "Subtotal from salary",
  "month.subtotalSavings": "Subtotal from savings",
  "month.maxPlanned": "Max Planned Budget Per Person",
  "month.remainingMoney": "Remaining money",
  "month.transferReceived": "Transfer from wife received",
  "month.waitingTransfer": "Waiting for {amount}",
  "month.sectionMenu": "Jump to section",
  "month.sectionMenuClose": "Close section menu",
  "month.searchPlaceholder": "Search expenses…",
  "month.searchEmpty": "No expenses found matching",
  "month.clearSearch": "Clear search",
  "month.clearFilter": "Clear filter",
  "month.pageTitle": "{title} — Monthly Budget Nia Ilham",

  // ── ExpenseSection component ──────────────────────────────────────────────
  "expense.nameLabel": "Name",
  "expense.amountLabel": "Amount (IDR)",
  "expense.namePlaceholder": "e.g. Electricity bill",
  "expense.nameRequired": "Enter a name first",
  "expense.method": "Payment method",
  "expense.methodPlaceholder": "e.g. Cash, BNI, QRIS",
  "expense.date": "Date",
  "expense.dateToday": "Today",
  "expense.dateYesterday": "1 day ago",
  "expense.daysAgo": "{n} days ago",
  "expense.dateOther": "Other date",
  "expense.noDate": "No date",
  "expense.add": "Add",
  "expense.addItem": "Add expense",
  "expense.saveChanges": "Save changes",
  "expense.cancel": "Cancel",
  "expense.edit": "Edit expense",
  "expense.delete": "Delete",
  "expense.markPaid": "Mark paid",
  "expense.markUnpaid": "Mark unpaid",
  "expense.dragToMove": "Drag to move",
  "expense.empty": "No entries yet — tap “+” to add one.",
  "expense.viewLess": "View less",
  "expense.viewMore": "View {n} more",
  "expense.remaining": "remaining",
  "expense.paid": "paid",
  "expense.deleteTitle": "Delete this expense?",
  "expense.deleteText": "{name} ({amount}) will be removed permanently.",
  "expense.thisItem": "This expense",
  "expense.inactiveTitle": "Inactive month",
  "expense.inactiveText":
    "This month is not the active budget period. Changes here affect past records. Continue?",
  "expense.continue": "Continue",
};

const id: Dict = {
  // ── Common ────────────────────────────────────────────────────────────────
  "common.husband": "Suami",
  "common.wife": "Istri",
  "common.salary": "gaji",
  "common.savings": "tabungan",
  "common.fixed": "tetap",
  "common.cancel": "Batal",
  "common.add": "Tambah",
  "common.saveChanges": "Simpan perubahan",
  "common.delete": "Hapus",
  "common.edit": "Ubah",
  "common.viewLess": "Lihat lebih sedikit",
  "common.viewMore": "Lihat {n} lagi",
  "common.loading": "Memuat…",

  // ── Layout / topbar ───────────────────────────────────────────────────────
  "nav.dashboard": "Beranda",
  "nav.familyPlan": "Rencana Keluarga",
  "nav.signOut": "Keluar",
  "nav.language": "Bahasa",
  "nav.notificationsOn": "Notifikasi aktif · ketuk untuk mematikan",
  "nav.notificationsOff": "Aktifkan notifikasi",
  "notify.unsupported": "Browser ini tidak mendukung notifikasi push.",
  "notify.unconfigured": "Notifikasi push belum dikonfigurasi.",
  "notify.denied": "Notifikasi diblokir. Izinkan lewat pengaturan browser.",
  "notify.error": "Gagal mengaktifkan notifikasi. Coba lagi.",
  "notify.disabled": "Notifikasi dimatikan untuk perangkat ini.",
  "footer.tagline":
    "Anggaran Bulanan Nia Ilham · Tetap seimbang, menabung bersama",

  // ── Login ─────────────────────────────────────────────────────────────────
  "login.title": "Anggaran Bulanan Nia Ilham",
  "login.subtitle": "Rencanakan bersama, menabung dengan indah.",
  "login.fieldLabel": "Kata kunci keluarga",
  "login.placeholder": "ketik kata kuncinya…",
  "login.show": "Tampilkan kata kunci",
  "login.hide": "Sembunyikan kata kunci",
  "login.error": "Kata kunci salah. Silakan coba lagi.",
  "login.signingIn": "Sedang masuk…",
  "login.signIn": "Masuk",
  "login.hint": "Hanya anggota keluarga yang tahu kata kuncinya.",
  "login.pageTitle": "Masuk — Anggaran Bulanan Nia Ilham",
  "seo.dashboardDescription":
    "Perencana anggaran keluarga privat untuk menyeimbangkan penghasilan suami dan istri, pengeluaran tetap, belanja harian, dan tabungan — satu periode anggaran sekaligus.",
  "seo.loginDescription":
    "Masuk ke perencana anggaran keluarga untuk melacak penghasilan, pengeluaran tetap, belanja harian, dan tabungan bersama.",
  "seo.monthDescription":
    "Ubah satu periode anggaran: penghasilan, pengeluaran tetap, belanja harian dari gaji dan tabungan, beserta ringkasan alur uang.",

  // ── Dashboard ─────────────────────────────────────────────────────────────
  "dashboard.pageTitle": "Anggaran Bulanan Nia Ilham",
  "dashboard.heroEyebrow": "Pelacak Keuangan Keluarga",
  "dashboard.heroTitleLine1": "Rencanakan bersama.",
  "dashboard.heroTitleLine2": "Menabung dengan indah.",
  "dashboard.heroSub":
    "Lacak penghasilan suami dan istri, pengeluaran tetap, belanja harian, dan penarikan tabungan — satu periode anggaran sekaligus.",
  "dashboard.thisMonth": "Bulan ini",
  "dashboard.totalIncome": "Total Penghasilan",
  "dashboard.totalFixed": "Total Pengeluaran Tetap",
  "dashboard.totalExpense": "Total Pengeluaran",
  "dashboard.expense": "Pengeluaran",
  "dashboard.expenseBreakdown": "tetap + harian gaji + tabungan",
  "dashboard.maxPlannedPerPerson": "Anggaran Maksimal Direncanakan Per Orang",
  "dashboard.dailyFromSalary": "Total Pengeluaran Harian dari Gaji",
  "dashboard.dailyFromSavings": "Total Pengeluaran Harian dari Tabungan",
  "dashboard.husbandWife": "suami + istri",
  "dashboard.husbandWifeFixed": "tetap suami + istri",
  "dashboard.afterFixedSplit": "setelah tetap, dibagi rata",
  "dashboard.budgetPeriods": "Periode Anggaran",
  "dashboard.active": "Aktif",
  "dashboard.past": "Sebelumnya",
  "dashboard.new": "Baru",
  "dashboard.noBudgetYetTap": "Belum ada anggaran — ketuk untuk membuat",
  "dashboard.viewMore": "Lihat {n} lagi",
  "dashboard.loading": "Memuat anggaran Anda…",
  "dashboard.noBudgetTitle": "Belum ada anggaran",
  "dashboard.noBudgetText":
    "Buat periode anggaran pertama Anda dari tombol bulan di atas.",
  "dashboard.infoIncomeFixed": "Penghasilan & tetap",
  "dashboard.infoIncomeFixedSub": "suami dan istri",
  "dashboard.infoSalary": "Harian dari gaji",
  "dashboard.infoSalarySub": "suami dan istri",
  "dashboard.infoSavings": "Harian dari tabungan",
  "dashboard.infoSavingsSub": "suami dan istri",
  "dashboard.infoPerPerson": "Per orang",
  "dashboard.infoPerPersonSub": "setelah tetap, dibagi rata",
  "dashboard.confirmDelete":
    "Hapus {month}? Tindakan ini tidak dapat dibatalkan.",
  "dashboard.searchPlaceholder": "Cari pengeluaran di semua bulan…",
  "dashboard.searchEmpty": "Tidak ada pengeluaran yang sesuai",

  // ── Month page ────────────────────────────────────────────────────────────
  "month.allMonths": "Semua bulan",
  "month.saving": "Menyimpan…",
  "month.saved": "Tersimpan {time}",
  "month.editable": "Dapat diubah",
  "month.editHeader": "Ubah judul",
  "month.fieldTitle": "Judul",
  "month.fieldPeriod": "Periode anggaran",
  "month.fieldPeriodFrom": "Dari",
  "month.fieldPeriodTo": "Sampai",
  "month.fieldPeriodHint": "Pilih tanggal mulai dan selesai",
  "month.totalIncome": "Total Penghasilan",
  "month.totalExpense": "Total Pengeluaran",
  "month.totalDailyFromSavings": "Total Pengeluaran Harian dari Tabungan",
  "month.equalSplitTransfer": "Transfer Bagi Rata",
  "month.eachHolds": "masing-masing memegang {amount} setelah ditransfer",
  "month.chartTitle": "Alur uang bulan ini",
  "month.chartIncomeTitle": "Penghasilan dari sumber",
  "month.chartExpenseTitle": "Pengeluaran dari sumber",
  "month.chartIncomeAria": "Diagram batang vertikal penghasilan per sumber",
  "month.chartExpenseAria": "Diagram batang vertikal pengeluaran per kategori",
  "month.chartFixedShort": "Tetap",
  "month.chartSalaryShort": "Harian gaji",
  "month.chartSavingsShort": "Harian tabungan",
  "month.chartCombined": "Suami + Istri",
  "month.chartFixedSalaryShort": "Tetap + harian gaji",
  "month.chartFixedSalarySavingsShort": "Tetap + harian gaji + harian tabungan",
  "month.chartFixed": "Total Pengeluaran Tetap",
  "month.chartSalary": "Pengeluaran Harian dari Gaji",
  "month.chartRemaining": "Sisa",
  "month.totalIncomeLabel": "total penghasilan",
  "month.chartDonutAria": "Donat alokasi penghasilan",
  "month.dailyFromSavings": "Total Pengeluaran Harian dari Tabungan",
  "month.chartConclusionIncome":
    "Penghasilan berasal dari {husband} (suami) + {wife} (istri) = {income}.",
  "month.chartConclusionSplit":
    "Penghasilan itu menutup pengeluaran tetap {fixed} dan pengeluaran harian dari gaji {salary}, menyisakan {remaining} yang belum terpakai.",
  "month.chartConclusionSavings":
    "Total pengeluaran {total} juga mencakup {savings} pengeluaran harian yang dibayar dari tabungan — di luar penghasilan bulan ini.",
  "month.section1": "1. Penghasilan Suami",
  "month.section2": "2. Penghasilan Istri",
  "month.section3": "3. Pengeluaran Tetap Suami",
  "month.section4": "4. Pengeluaran Tetap Istri",
  "month.section5": "5. Pengeluaran Harian Suami (dari gaji)",
  "month.section6": "6. Pengeluaran Harian Suami (dari tabungan)",
  "month.section7": "7. Pengeluaran Harian Istri (dari gaji)",
  "month.section8": "8. Pengeluaran Harian Istri (dari tabungan)",
  "month.sourceLabel": "Sumber",
  "month.husbandIncome": "Penghasilan bulanan suami",
  "month.wifeIncome": "Penghasilan bulanan istri",
  "month.husbandFixedRemaining": "Tetap suami — sisa",
  "month.wifeFixedRemaining": "Tetap istri — sisa",
  "month.subtotalSalary": "Subtotal dari gaji",
  "month.subtotalSavings": "Subtotal dari tabungan",
  "month.maxPlanned": "Anggaran Maksimal Direncanakan Per Orang",
  "month.remainingMoney": "Sisa uang",
  "month.transferReceived": "Transfer dari istri diterima",
  "month.waitingTransfer": "Menunggu {amount}",
  "month.sectionMenu": "Lompat ke bagian",
  "month.sectionMenuClose": "Tutup menu bagian",
  "month.searchPlaceholder": "Cari pengeluaran…",
  "month.searchEmpty": "Tidak ada pengeluaran yang sesuai",
  "month.clearSearch": "Bersihkan pencarian",
  "month.clearFilter": "Bersihkan filter",
  "month.pageTitle": "{title} — Anggaran Bulanan Nia Ilham",

  // ── ExpenseSection component ──────────────────────────────────────────────
  "expense.nameLabel": "Nama",
  "expense.amountLabel": "Jumlah (IDR)",
  "expense.namePlaceholder": "mis. Tagihan listrik",
  "expense.nameRequired": "Isi nama dulu",
  "expense.method": "Metode pembayaran",
  "expense.methodPlaceholder": "mis. Tunai, BNI, QRIS",
  "expense.date": "Tanggal",
  "expense.dateToday": "Hari ini",
  "expense.dateYesterday": "1 hari yang lalu",
  "expense.daysAgo": "{n} hari yang lalu",
  "expense.dateOther": "Tanggal lain",
  "expense.noDate": "Tanpa tanggal",
  "expense.add": "Tambah",
  "expense.addItem": "Tambah pengeluaran",
  "expense.saveChanges": "Simpan perubahan",
  "expense.cancel": "Batal",
  "expense.edit": "Ubah pengeluaran",
  "expense.delete": "Hapus",
  "expense.markPaid": "Tandai lunas",
  "expense.markUnpaid": "Tandai belum lunas",
  "expense.dragToMove": "Geser untuk memindah",
  "expense.empty": "Belum ada entri — ketuk “+” untuk menambah.",
  "expense.viewLess": "Lihat lebih sedikit",
  "expense.viewMore": "Lihat {n} lagi",
  "expense.remaining": "sisa",
  "expense.paid": "terbayar",
  "expense.deleteTitle": "Hapus pengeluaran ini?",
  "expense.deleteText": "{name} ({amount}) akan dihapus permanen.",
  "expense.thisItem": "Pengeluaran ini",
  "expense.inactiveTitle": "Bulan tidak aktif",
  "expense.inactiveText":
    "Bulan ini bukan periode anggaran aktif. Perubahan di sini memengaruhi catatan lampau. Lanjutkan?",
  "expense.continue": "Lanjutkan",
};

const dictionaries: Record<Lang, Dict> = { en, id };

/** Detect the initial language from storage, defaulting to English. */
function initialLang(): Lang {
  if (typeof localStorage === "undefined") return "en";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "id" ? "id" : "en";
}

/** Reactive current language (Svelte 5 rune-based store). */
export const lang = $state<{ value: Lang }>({ value: initialLang() });

/** Set and persist the active language. */
export function setLang(next: Lang) {
  lang.value = next;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, next);
  }
}

/** Toggle between English and Indonesian. */
export function toggleLang() {
  setLang(lang.value === "en" ? "id" : "en");
}

/**
 * Translate a key, optionally interpolating `{name}` placeholders.
 * Falls back to English, then to the raw key, when a translation is missing.
 */
export function t(
  key: string,
  params?: Record<string, string | number>,
): string {
  const dict = dictionaries[lang.value] ?? en;
  let text = dict[key] ?? en[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}
