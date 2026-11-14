/**
 * Resync daily expenses from the "Budgeting Bulanan.xlsx" Sheet2.
 *
 * Classification rule:
 *  - Entries in columns A/B/C (the main daily-expense table) -> dailyFromSalary
 *  - Entries in columns E/F ("Ambil ke Dana Tabungan")        -> dailyFromSavings
 *
 * Other budget fields (income, fixed expenses, title, period, ...) are
 * preserved from whatever is already in Firestore.
 *
 * Run with: node scripts/resync-daily-from-excel.mjs
 */
import fs from "fs";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

const EXTRACTED =
  process.env.BUDGET_EXTRACTED ||
  "C:/Users/DevTI-TelU/AppData/Local/Temp/opencode/budget_xlsx2/extracted";

import { firebaseConfig } from "./firebase-config.mjs";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ── Read shared strings ─────────────────────────────────────────────────────
const ssXml = fs.readFileSync(`${EXTRACTED}/xl/sharedStrings.xml`, "utf8");
const strings = [];
{
  const siRe = /<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = siRe.exec(ssXml))) {
    const texts = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]);
    strings.push(
      texts
        .join("")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#10;/g, "\n")
    );
  }
}

// ── Read sheet2 rows ────────────────────────────────────────────────────────
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

// ── Helpers ─────────────────────────────────────────────────────────────────
const MONTHS = {
  Januari: 1, Februari: 2, Maret: 3, April: 4, Mei: 5, Juni: 6,
  Juli: 7, Agustus: 8, September: 9, Oktober: 10, November: 11, Desember: 12
};

function parseBlockHeader(text) {
  // e.g. "25 Januari - 24 Februari 2026"
  const m = String(text).match(/25\s+(\w+)\s*-\s*24\s+(\w+)\s+(\d{4})/);
  if (!m) return null;
  const startMonth = MONTHS[m[1]];
  const year = parseInt(m[3]);
  if (!startMonth || !year) return null;
  return { id: `${year}-${String(startMonth).padStart(2, "0")}` };
}

const isNumber = (s) => /^\d+$/.test(String(s).trim());
const isDateLike = (s) => /^25\s+\w+/.test(String(s).trim());

function splitNameMethod(name) {
  const idx = name.indexOf("|");
  if (idx === -1) return { name: name.trim(), method: "" };
  return {
    name: name.slice(0, idx).trim(),
    method: name.slice(idx + 1).trim()
  };
}

// ── Parse blocks ────────────────────────────────────────────────────────────
// Structural header cells (exact match) that are never line items.
const STRUCTURAL = new Set([
  "Pengeluaran",
  "Jumlah",
  "Total Pengeluaran",
  "Keterangan",
  "Ambil ke Dana Tabungan",
  "Kebutuhan",
  "Estimasi",
  "Realita",
  "Total Uang Suami",
  "Sisa Uang Suami",
  "Total Ambil Tabungan"
]);

const blocks = [];
let current = null;
for (const row of rows) {
  const A = (row.A || "").trim();
  const header = parseBlockHeader(A);
  if (header) {
    if (current) blocks.push(current);
    current = { id: header.id, salary: [], savings: [] };
    continue;
  }
  if (!current) continue;

  // Savings entry: column F (keterangan) + column E (amount). Checked
  // independently of column A so continuation rows (E/F only) are captured.
  const F = (row.F || "").trim();
  if (F && row.E && isNumber(row.E) && !STRUCTURAL.has(F)) {
    current.savings.push({ name: F, amount: Number(row.E) });
  }

  // Salary entry: column A contains the expense name (+ method), B the amount.
  if (A && row.B && isNumber(row.B) && !STRUCTURAL.has(A) && !isDateLike(A)) {
    const { name, method } = splitNameMethod(A);
    if (name) {
      current.salary.push({ name, method, amount: Number(row.B) });
    }
  }
}
if (current) blocks.push(current);

// ── Write to Firestore ──────────────────────────────────────────────────────
let seq = 0;
const itemId = () => `resync-${(++seq).toString(36).padStart(4, "0")}`;

async function main() {
  console.log(`Parsed ${blocks.length} month blocks.\n`);
  for (const block of blocks) {
    const ref = doc(db, "budget", block.id);
    const snap = await getDoc(ref);
    const existing = snap.exists() ? snap.data() : {};

    const dailyFromSalary = block.salary.map((e) => ({
      id: itemId(),
      name: e.name,
      amount: e.amount,
      method: e.method
    }));
    const dailyFromSavings = block.savings.map((e) => ({
      id: itemId(),
      name: e.name,
      amount: e.amount,
      method: ""
    }));

    const merged = {
      ...existing,
      id: block.id,
      dailyFromSalary,
      dailyFromSavings,
      updatedAt: new Date().toISOString()
    };

    await setDoc(ref, merged);

    const salSum = dailyFromSalary.reduce((s, e) => s + e.amount, 0);
    const savSum = dailyFromSavings.reduce((s, e) => s + e.amount, 0);
    console.log(
      `✓ ${block.id}: salary ${dailyFromSalary.length} (${salSum.toLocaleString("id-ID")})` +
        `, savings ${dailyFromSavings.length} (${savSum.toLocaleString("id-ID")})`
    );
  }
  console.log("\n✅ Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
