/**
 * Repair the October 2026 budget (2026-10) so it matches the source data.
 *
 * The document was overwritten by older seeding scripts that used the old
 * field model, leaving income/fixed/wife-daily empty. This script patches
 * ONLY the missing/incorrect fields, preserving everything else.
 *
 * Source: "Budgeting Bulanan.xlsx" Sheet1 (income + fixed) and Sheet2 (daily).
 *
 * Run with: node scripts/fix-october.mjs
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initAdmin } from "./admin-app.mjs";

const app = initAdmin();
const db = getFirestore(app);

let seq = 0;
const id = () => `fx-${(++seq).toString(36).padStart(4, "0")}`;

const monthId = "2026-10";

const husbandFixed = [
  ["Bayar Air Ciparay", 80000],
  ["Bayar Listrik Ciparay", 150000],
  ["Tabungan Pensiun", 200000],
  ["Biaya PP Bandung Cilegon", 300000],
  ["Galon Cilegon", 160000],
  ["Keamanan & Sampah Ciparay", 45000],
  ["Imunisasi Enza", 200000],
  ["Tabungan Dana Darurat", 200000],
  ["Bayar Kontrakan Bu Uut", 800000],
  ["Internet Smartfren", 160000],
  ["Tabungan Emas", 100000],
  ["Bayar Listrik Kontrakan", 302000],
  ["Pampers", 300000],
  ["Susu", 500000],
  ["Gaji Pengasuh", 800000],
  ["Bulanan Sabun dll", 130000],
  ["Kebutuhan Lain Enza", 100000],
  ["Sampah", 30000]
];

const wifeFixed = [
  ["Untuk Orang Tua", 1500000],
  ["Koperasi", 350000],
  ["Zakat Infaq", 150000],
  ["Internet Telkomsel", 111000]
];

async function main() {
  const ref = db.doc(`budget/${monthId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`Document ${monthId} not found`);
  const current = snap.data();

  const patch = {
    id: monthId,
    title: current.title ?? "October 2026",
    period: current.period ?? "25 October - 24 November 2026",
    husbandIncome: 5500000,
    wifeIncome: 4100000,
    husbandFixed: husbandFixed.map(([name, amount]) => ({ id: id(), name, amount })),
    wifeFixed: wifeFixed.map(([name, amount]) => ({ id: id(), name, amount })),
    updatedAt: FieldValue.serverTimestamp()
  };

  // merge:true keeps existing arrays (husbandDailyFromSalary, savings, etc.)
  await ref.set(patch, { merge: true });

  const hFixed = patch.husbandFixed.reduce((s, e) => s + e.amount, 0);
  const wFixed = patch.wifeFixed.reduce((s, e) => s + e.amount, 0);
  console.log(`✓ ${monthId} repaired`);
  console.log(`  husbandIncome: Rp5.500.000, wifeIncome: Rp4.100.000`);
  console.log(`  husbandFixed: ${husbandFixed.length} items (${hFixed.toLocaleString("id-ID")})`);
  console.log(`  wifeFixed:    ${wifeFixed.length} items (${wFixed.toLocaleString("id-ID")})`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Repair failed:", err);
  process.exit(1);
});
