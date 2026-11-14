/**
 * Restore October 2026 daily expenses (husband salary + savings) which were
 * lost because the earlier seed scripts wrote to the OLD field names
 * (dailyFromSalary / savingsWithdrawals) that the current app model no longer
 * reads.
 *
 * Source: seed-daily-2026.mjs (Sheet2 transcription) — husband daily + savings.
 * This script writes ONLY the missing daily arrays; everything else (income,
 * fixed, header) is preserved.
 *
 * Run with: node scripts/fix-october-daily.mjs
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initAdmin } from "./admin-app.mjs";

const app = initAdmin();
const db = getFirestore(app);

let seq = 0;
const id = () => `fx-${(++seq).toString(36).padStart(4, "0")}`;

const monthId = "2026-10";

const husbandDailyFromSalary = [
  ["Sedekah Jariyah", 30000, "Auto Donate"],
  ["Sedekah Tiap Subuh", 30000, "Auto Donate"],
  ["Sedekah Darurat Dibantu", 30928, "Auto Donate"],
  ["Belanja Minyak, Garam, Masako, Sarden, Bumbu Nasgor, Sasa", 87500, ""],
  ["Warung Apotek, Bensin, Sop Buah", 200000, ""],
  ["Roti, Teh Pucuk", 23600, ""],
  ["Tambahan BTM", 5000, ""],
  ["Gojek Ke CFD", 8500, ""],
  ["Gojek Dari CFD", 8500, ""],
  ["Gojek Perjalanan Cilegon Bandung", 200000, ""],
  ["Nasgor Mie", 30000, ""],
  ["Bubur Ayam", 16000, ""],
  ["Warteg", 15000, ""],
  ["Kopi Serenceng, Gabin", 21000, ""],
  ["Kecap Enza", 45000, ""],
  ["Ambil 100k buat maksi", 100000, ""],
  ["Warteg", 12000, ""],
  ["Dimsum Ayang", 30000, ""],
  ["Labbaik Ayang", 35600, ""],
  ["Roti'O ayang", 75000, ""],
  ["Gas, Telur", 35000, ""],
  ["Warteg tongkol oreg", 23000, ""],
  ["Nasgor", 15000, ""],
  ["Teh Pucuk, Kecap", 11000, ""],
  ["Nombok BTM Travel", 5000, ""],
  ["Bubur Ayam, Lotek, Warteg", 47000, ""]
];

const husbandDailyFromSavings = [
  ["Pegangan 31 Oktober", 300000],
  ["Truk, Sutra", 104610],
  ["Gojek Isna Ayang", 50000],
  ["Sabun Nuvo", 85000],
  ["Galon Vit, Bubur Sun Enza", 62500],
  ["Beli Android box / ayunan (365k tambahan 85)", 365000],
  ["AI Neuraline", 20000],
  ["Karpet Kamar", 250000]
];

async function main() {
  const ref = db.doc(`budget/${monthId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`Document ${monthId} not found`);

  const patch = {
    husbandDailyFromSalary: husbandDailyFromSalary.map(([name, amount, method]) => ({
      id: id(), name, amount, method: method || ""
    })),
    husbandDailyFromSavings: husbandDailyFromSavings.map(([purpose, amount]) => ({
      id: id(), name: purpose, amount, method: ""
    })),
    // wife daily arrays exist but empty for October — keep them empty (no source data)
    wifeDailyFromSalary: [],
    wifeDailyFromSavings: [],
    updatedAt: FieldValue.serverTimestamp()
  };

  await ref.set(patch, { merge: true });

  const hSalary = patch.husbandDailyFromSalary.reduce((s, e) => s + e.amount, 0);
  const hSavings = patch.husbandDailyFromSavings.reduce((s, e) => s + e.amount, 0);
  console.log(`✓ ${monthId} daily restored`);
  console.log(`  husbandDailyFromSalary: ${husbandDailyFromSalary.length} items (${hSalary.toLocaleString("id-ID")})`);
  console.log(`  husbandDailyFromSavings: ${husbandDailyFromSavings.length} items (${hSavings.toLocaleString("id-ID")})`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
