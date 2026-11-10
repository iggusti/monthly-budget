/**
 * Copy husbandIncome, wifeIncome, husbandFixed, and wifeFixed from one budget
 * period to one or more destination periods. Preserves all other fields on
 * each destination document. Gives copied fixed-expense items new ids.
 *
 * Run with: node scripts/copy-income-fixed.mjs <source> <dest1> [dest2] [...]
 * Example:  node scripts/copy-income-fixed.mjs 2026-08 2026-07 2026-06
 */
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
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
const auth = getAuth(app);
const db = getFirestore(app);

let seq = 0;
const newId = () => `fixed-${(++seq).toString(36).padStart(4, "0")}`;

const copyItems = (items = []) =>
  items.map((item) => ({ id: newId(), name: item.name, amount: item.amount, checked: item.checked }));

async function main() {
  const [source, ...dests] = process.argv.slice(2);
  if (!source || dests.length === 0) {
    console.error("Usage: node scripts/copy-income-fixed.mjs <source> <dest1> [dest2] ...");
    process.exit(1);
  }

  await signInAnonymously(auth);

  const srcSnap = await getDoc(doc(db, "budget", source));
  if (!srcSnap.exists()) {
    throw new Error(`Source budget ${source} does not exist`);
  }
  const src = srcSnap.data();

  const husbandIncome = Number(src.husbandIncome) || 0;
  const wifeIncome = Number(src.wifeIncome) || 0;
  const husbandFixed = copyItems(src.husbandFixed);
  const wifeFixed = copyItems(src.wifeFixed);

  const payload = {
    id: source,
    husbandIncome,
    wifeIncome,
    husbandFixed,
    wifeFixed,
    updatedAt: new Date().toISOString()
  };

  for (const dest of dests) {
    const destRef = doc(db, "budget", dest);
    await setDoc(destRef, { ...payload, id: dest }, { merge: true });

    const hTotal = husbandFixed.reduce((s, e) => s + e.amount, 0);
    const wTotal = wifeFixed.reduce((s, e) => s + e.amount, 0);
    console.log(`✓ Copied income and fixed expenses from ${source} to ${dest}`);
    console.log(`  husbandIncome: ${husbandIncome.toLocaleString("id-ID")}`);
    console.log(`  wifeIncome:    ${wifeIncome.toLocaleString("id-ID")}`);
    console.log(`  husbandFixed:  ${husbandFixed.length} items (${hTotal.toLocaleString("id-ID")})`);
    console.log(`  wifeFixed:     ${wifeFixed.length} items (${wTotal.toLocaleString("id-ID")})`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Copy failed:", err);
  process.exit(1);
});
