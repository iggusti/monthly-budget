/**
 * For Jan-Apr 2026, capture non-A/B/C entries from Sheet2 and add them to the
 * matching month's `husbandDailyFromSavings`.
 *
 * Uses the Firebase client SDK with an anonymous sign-in so the write satisfies
 * the Firestore rule (`request.auth != null`).
 *
 * Run with: node scripts/add-janapril-savings.mjs
 */
import fs from "fs";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

const EXTRACTED =
  process.env.BUDGET_EXTRACTED ||
  "C:/Users/DevTI-TelU/AppData/Local/Temp/opencode/budget_xlsx2/extracted";

import { firebaseConfig } from "./firebase-config.mjs";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ---- Parse shared strings ----
const ssXml = fs.readFileSync(`${EXTRACTED}/xl/sharedStrings.xml`, "utf8");
const strings = [];
{
  const siRe = /<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = siRe.exec(ssXml))) {
    const texts = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]);
    strings.push(texts.join("").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#10;/g, "\n"));
  }
}

// ---- Read sheet2 rows ----
const xml = fs.readFileSync(`${EXTRACTED}/xl/worksheets/sheet2.xml`, "utf8");
const rows = [];
{
  const rowRe = /<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  let rm;
  while ((rm = rowRe.exec(xml))) {
    const rowNum = parseInt(rm[1]);
    const cells = [...rm[2].matchAll(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)];
    const row = { r: rowNum };
    for (const c of cells) {
      const col = c[1];
      const inner = c[4] || "";
      const attrs = c[3] || "";
      const tMatch = attrs.match(/t="([^"]+)"/);
      let val = "";
      const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
      if (tMatch && tMatch[1] === "s" && vMatch) val = strings[parseInt(vMatch[1])];
      else if (vMatch) val = vMatch[1];
      if (val !== "") row[col] = val;
    }
    rows.push(row);
  }
}

const MONTHS = { Januari: 1, Februari: 2, Maret: 3, April: 4, Mei: 5, Juni: 6, Juli: 7, Agustus: 8, September: 9, Oktober: 10, November: 11, Desember: 12 };
const isNumber = (s) => /^\d+$/.test(String(s).trim());
const STRUCTURAL = new Set(["Kebutuhan", "Estimasi", "Realita", "Jumlah", "Keterangan", "Ambil ke Dana Tabungan", "Total Pengeluaran", "Pengeluaran", "Total Uang Suami", "Sisa Uang Suami"]);

// ---- Split into month blocks ----
const blocks = [];
let current = null;
for (const row of rows) {
  const A = (row.A || "").trim();
  const h = /25\s+(\w+)\s*-\s*24\s+(\w+)\s+(\d{4})/.exec(A);
  if (h) {
    if (current) blocks.push(current);
    const m = MONTHS[h[1]];
    const y = parseInt(h[3]);
    current = { id: `${y}-${String(m).padStart(2, "0")}`, extras: [] };
    continue;
  }
  if (!current) continue;
  const E = (row.E || "").trim();
  const F = (row.F || "").trim();
  if (E && F && isNumber(F) && !STRUCTURAL.has(E) && !STRUCTURAL.has(F)) {
    current.extras.push({ name: E, amount: Number(F) });
  }
}
if (current) blocks.push(current);

let seq = 0;
const itemId = () => `extra-${(++seq).toString(36).padStart(4, "0")}`;

async function main() {
  await signInAnonymously(auth);
  console.log("Signed in anonymously.");

  const targetBlocks = blocks.filter((b) => b.id >= "2026-01" && b.id <= "2026-04");
  for (const block of targetBlocks) {
    if (!block.extras.length) {
      console.log(`- ${block.id}: no numeric non-A/B/C entries`);
      continue;
    }
    const ref = doc(db, "budget", block.id);
    const snap = await getDoc(ref);
    const existing = snap.exists() ? snap.data() : {};
    const existingSavings = existing.husbandDailyFromSavings ?? [];

    const newItems = block.extras.map((e) => ({ id: itemId(), name: e.name, amount: e.amount, method: "" }));
    const mergedSavings = [...existingSavings, ...newItems];

    await setDoc(ref, { ...existing, id: block.id, husbandDailyFromSavings: mergedSavings, updatedAt: new Date().toISOString() });

    console.log(`✓ ${block.id}: added ${newItems.length} savings item(s)`);
    for (const item of newItems) {
      console.log(`   - ${item.name}: ${item.amount.toLocaleString("id-ID")}`);
    }
  }
  console.log("\n✅ Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Failed:", err.message || err);
  process.exit(1);
});
