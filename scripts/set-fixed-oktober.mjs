/**
 * Update the October 2026 budget with husband/wife fixed expenses
 * (Kebutuhan Pokok Suami / Istri) from Sheet1.
 * Preserves existing dailyFromSalary and savingsWithdrawals.
 *
 * Run with: node scripts/set-fixed-oktober.mjs
 */
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA76dfX8IPTvTx7ehorlHi9OFvr2s-Npug",
  authDomain: "monthly-budget-580b2.firebaseapp.com",
  projectId: "monthly-budget-580b2",
  storageBucket: "monthly-budget-580b2.firebasestorage.app",
  messagingSenderId: "276706600878",
  appId: "1:276706600878:web:0d8914bd9e8ecbc4048a3f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let seq = 0;
const id = () => `fixed-${(++seq).toString(36).padStart(4, "0")}`;

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

const monthId = "2026-10";

async function main() {
  const ref = doc(db, "budget", monthId);
  const snap = await getDoc(ref);
  const current = snap.exists() ? snap.data() : {};

  const husbandFixedItems = husbandFixed.map(([name, amount]) => ({ id: id(), name, amount }));
  const wifeFixedItems = wifeFixed.map(([name, amount]) => ({ id: id(), name, amount }));

  const merged = {
    ...current,
    id: monthId,
    husbandFixed: husbandFixedItems,
    wifeFixed: wifeFixedItems,
    updatedAt: new Date().toISOString()
  };

  await setDoc(ref, merged);

  const hTotal = husbandFixedItems.reduce((s, e) => s + e.amount, 0);
  const wTotal = wifeFixedItems.reduce((s, e) => s + e.amount, 0);
  console.log(`✓ ${monthId} updated`);
  console.log(`  husbandFixed: ${husbandFixedItems.length} items (${hTotal.toLocaleString("id-ID")})`);
  console.log(`  wifeFixed:    ${wifeFixedItems.length} items (${wTotal.toLocaleString("id-ID")})`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Update failed:", err);
  process.exit(1);
});
