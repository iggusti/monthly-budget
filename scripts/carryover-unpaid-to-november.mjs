/**
 * Carry over unpaid fixed expenses from October 2026 (2026-10) into
 * November 2026 (2026-11), if November is currently empty of fixed items.
 *
 * 2026-11 already exists in Firestore (seeded), so the normal createMonth
 * carry-over never ran for it. This script repairs that one-time.
 *
 * Run with: node scripts/carryover-unpaid-to-november.mjs
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
  const next = nextSnap.data();

  const unpaidHusband = (prev.husbandFixed || []).filter((i) => !i.checked);
  const unpaidWife = (prev.wifeFixed || []).filter((i) => !i.checked);

  console.log(`October unpaid -> husbandFixed=${unpaidHusband.length}, wifeFixed=${unpaidWife.length}`);
  console.log(`Current November husbandFixed=${(next.husbandFixed || []).length}, wifeFixed=${(next.wifeFixed || []).length}`);

  const nextHusband = (next.husbandFixed || []).slice();
  const nextWife = (next.wifeFixed || []).slice();
  if (nextHusband.length === 0 && unpaidHusband.length > 0) {
    nextHusband.push(...unpaidHusband.map((i) => ({ ...i, id: newId() })));
  }
  if (nextWife.length === 0 && unpaidWife.length > 0) {
    nextWife.push(...unpaidWife.map((i) => ({ ...i, id: newId() })));
  }

  const patch = {
    husbandFixed: nextHusband,
    wifeFixed: nextWife,
    updatedAt: FieldValue.serverTimestamp()
  };
  await nextRef.set(patch, { merge: true });

  console.log(`✓ ${NEXT} updated -> husbandFixed=${nextHusband.length}, wifeFixed=${nextWife.length}`);
  for (const i of nextHusband) console.log(`  husband: ${i.name} (${i.amount.toLocaleString("id-ID")})`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
