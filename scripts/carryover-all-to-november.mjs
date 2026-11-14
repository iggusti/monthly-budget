/**
 * Copy ALL fixed expenses from October 2026 (2026-10) into November 2026
 * (2026-11), reset to unchecked. This replaces November's fixed list entirely.
 *
 * Run with: node scripts/carryover-all-to-november.mjs
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initAdmin } from "./admin-app.mjs";

const app = initAdmin();
const db = getFirestore(app);

let seq = 0;
const newId = () => `carry-${(++seq).toString(36).padStart(4, "0")}`;

const PREV = "2026-10";
const NEXT = "2026-11";

async function main() {
  const prevRef = db.doc(`budget/${PREV}`);
  const nextRef = db.doc(`budget/${NEXT}`);
  const prevSnap = await prevRef.get();
  const nextSnap = await nextRef.get();
  if (!prevSnap.exists) throw new Error(`${PREV} not found`);
  if (!nextSnap.exists) throw new Error(`${NEXT} not found`);

  const prev = prevSnap.data();

  const allHusband = (prev.husbandFixed || []).map((i) => ({ ...i, id: newId(), checked: false }));
  const allWife = (prev.wifeFixed || []).map((i) => ({ ...i, id: newId(), checked: false }));

  const patch = {
    husbandFixed: allHusband,
    wifeFixed: allWife,
    updatedAt: FieldValue.serverTimestamp()
  };
  await nextRef.set(patch, { merge: true });

  console.log(`✓ ${NEXT} updated -> husbandFixed=${allHusband.length}, wifeFixed=${allWife.length} (all unchecked)`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
