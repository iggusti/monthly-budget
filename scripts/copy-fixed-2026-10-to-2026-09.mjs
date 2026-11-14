/**
 * Copy husbandFixed and wifeFixed from budget 2026-10 to budget 2026-09.
 * Preserves all other fields on the destination document.
 * Gives copied items new ids.
 *
 * Run with: node scripts/copy-fixed-2026-10-to-2026-09.mjs
 */
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

import { firebaseConfig } from "./firebase-config.mjs";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const SOURCE = "2026-10";
const DEST = "2026-09";

let seq = 0;
const newId = () => `fixed-${(++seq).toString(36).padStart(4, "0")}`;

const copyItems = (items = []) =>
  items.map((item) => ({ id: newId(), name: item.name, amount: item.amount, checked: item.checked }));

async function main() {
  await signInAnonymously(auth);

  const srcSnap = await getDoc(doc(db, "budget", SOURCE));
  if (!srcSnap.exists()) {
    throw new Error(`Source budget ${SOURCE} does not exist`);
  }
  const src = srcSnap.data();

  const husbandFixed = copyItems(src.husbandFixed);
  const wifeFixed = copyItems(src.wifeFixed);

  const destRef = doc(db, "budget", DEST);
  await setDoc(
    destRef,
    {
      id: DEST,
      husbandFixed,
      wifeFixed,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );

  const hTotal = husbandFixed.reduce((s, e) => s + e.amount, 0);
  const wTotal = wifeFixed.reduce((s, e) => s + e.amount, 0);
  console.log(`✓ Copied fixed expenses from ${SOURCE} to ${DEST}`);
  console.log(`  husbandFixed: ${husbandFixed.length} items (${hTotal.toLocaleString("id-ID")})`);
  console.log(`  wifeFixed:    ${wifeFixed.length} items (${wTotal.toLocaleString("id-ID")})`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Copy failed:", err);
  process.exit(1);
});
