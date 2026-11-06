/**
 * Update every budget document's `title` (and `period`) to the new convention:
 * title = the END month of the period (e.g. id 2026-10 -> "November 2026").
 *
 * Run with: node scripts/update-titles.mjs
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import fs from "fs";

const SERVICE_ACCOUNT = "C:/Users/DevTI-TelU/Downloads/monthly-budget-580b2-firebase-adminsdk-fbsvc-bc1049a859.json";
const app = initializeApp({ credential: cert(JSON.parse(fs.readFileSync(SERVICE_ACCOUNT, "utf8"))) });
const db = getFirestore(app);

function titleFor(id) {
  const [year, month] = id.split("-").map(Number);
  const start = new Date(year, (month || 1) - 1, 25);
  const end = new Date(year, month || 1, 24);
  const fmtDay = (d) => `${d.getDate()} ${d.toLocaleString("en-US", { month: "long" })}`;
  const title = `${end.toLocaleString("en-US", { month: "long" })} ${end.getFullYear()}`;
  const period = `${fmtDay(start)} - ${fmtDay(end)}`;
  return { title, period };
}

async function main() {
  const snap = await db.collection("budget").get();
  console.log(`Found ${snap.size} budget documents.`);
  let updated = 0;
  for (const doc of snap.docs) {
    const id = doc.id;
    const { title, period } = titleFor(id);
    const data = doc.data();
    if (data.title === title && data.period === period) continue;
    await doc.ref.set({ title, period, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    console.log(`✓ ${id}: "${data.title}" -> "${title}"`);
    updated++;
  }
  console.log(`\nDone. Updated ${updated} documents.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
