/**
 * Extract all k (thousand) / jt (million) amounts from non-A/B/C columns
 * (D..I) for Jan-Apr 2026 in Sheet2, and append them to the matching month's
 * `husbandDailyFromSavings` as line items.
 *
 * Per user rule: include all entries, even narrative/chronology ones.
 * A narrative line with multiple amounts yields one item per amount.
 *
 * Run with: node scripts/add-janapril-savings-kjt.mjs
 */
import fs from "fs";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

const EXTRACTED = "C:/Users/DevTI-TelU/AppData/Local/Temp/opencode/budget_xlsx2/extracted";

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
const auth = getAuth(app);

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
const amountRe = /(\d+(?:[.,]\d+)?)\s*(k|jt|juta|ribu)/gi;

function extractAmounts(text) {
  const out = [];
  let m;
  while ((m = amountRe.exec(text))) {
    const num = parseFloat(m[1].replace(",", "."));
    const mult = m[2].toLowerCase().startsWith("j") ? 1000000 : 1000;
    out.push({ raw: m[0], value: Math.round(num * mult) });
  }
  return out;
}

// Short label from the narrative (first ~30 chars of the cell text).
function makeLabel(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 42 ? clean.slice(0, 42).trimEnd() + "…" : clean;
}

const blocks = [];
let current = null;
for (const r of rows) {
  const A = (r.A || "").trim();
  const h = /25\s+(\w+)\s*-\s*24\s+(\w+)\s+(\d{4})/.exec(A);
  if (h) {
    if (current) blocks.push(current);
    current = { id: h[3] + "-" + String(MONTHS[h[1]]).padStart(2, "0"), items: [] };
    continue;
  }
  if (!current) continue;
  // Non-A/B/C columns only
  for (const col of ["D", "E", "F", "G", "H", "I"]) {
    const text = r[col];
    if (!text) continue;
    const amts = extractAmounts(text);
    for (const a of amts) {
      current.items.push({ label: makeLabel(text), amount: a.value });
    }
  }
}
if (current) blocks.push(current);

let seq = 0;
const itemId = () => `kjt-${(++seq).toString(36).padStart(4, "0")}`;

async function main() {
  await signInAnonymously(auth);
  console.log("Signed in anonymously.\n");

  const targetBlocks = blocks.filter((b) => b.id >= "2026-01" && b.id <= "2026-04");
  for (const block of targetBlocks) {
    if (!block.items.length) {
      console.log(`- ${block.id}: no k/jt entries`);
      continue;
    }
    const ref = doc(db, "budget", block.id);
    const snap = await getDoc(ref);
    const existing = snap.exists() ? snap.data() : {};
    const existingSavings = existing.husbandDailyFromSavings ?? [];

    const newItems = block.items.map((it) => ({ id: itemId(), name: it.label, amount: it.amount, method: "" }));
    await setDoc(ref, { ...existing, id: block.id, husbandDailyFromSavings: [...existingSavings, ...newItems], updatedAt: new Date().toISOString() });

    const total = newItems.reduce((s, it) => s + it.amount, 0);
    console.log(`✓ ${block.id}: added ${newItems.length} item(s), total ${total.toLocaleString("id-ID")}`);
    for (const it of newItems) {
      console.log(`   - ${it.amount.toLocaleString("id-ID")} | ${it.name}`);
    }
  }
  console.log("\n✅ Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Failed:", err.message || err);
  process.exit(1);
});
