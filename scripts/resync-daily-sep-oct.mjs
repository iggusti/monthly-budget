/**
 * Resync daily expenses for two specific periods from "Budgeting Bulanan.xlsx" Sheet2.
 *
 * Targets:
 *  - 2026-08 → "25 Agustus - 24 September 2026"
 *  - 2026-09 → "25 September - 24 Oktober 2026"
 *
 * Classification rule (same as resync-daily-from-excel.mjs):
 *  - Entries in columns A/B (main daily-expense table) -> husbandDailyFromSalary (section 5)
 *  - Entries in columns E/F ("Ambil ke Dana Tabungan") -> husbandDailyFromSavings (section 6)
 *
 * Other budget fields (income, fixed expenses, title, period, ...) are preserved.
 *
 * Run with: node scripts/resync-daily-sep-oct.mjs
 */
import fs from "fs";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

const EXTRACTED =
  process.env.BUDGET_EXTRACTED ||
  "C:/Users/DevTI-TelU/AppData/Local/Temp/opencode/budget_xlsx_sync/extracted";

// Only these periods are touched.
const TARGETS = new Set(["2026-08", "2026-09"]);

import { firebaseConfig } from "./firebase-config.mjs";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
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
  return { name: name.slice(0, idx).trim(), method: name.slice(idx + 1).trim() };
}

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

// ── Parse blocks (only keep the targets) ────────────────────────────────────
const blocks = [];
let current = null;
for (const row of rows) {
  const A = (row.A || "").trim();
  const header = parseBlockHeader(A);
  if (header) {
    if (current) blocks.push(current);
    current = TARGETS.has(header.id) ? { id: header.id, salary: [], savings: [] } : null;
    continue;
  }
  if (!current) continue;

  const F = (row.F || "").trim();
  if (F && row.E && isNumber(row.E) && !STRUCTURAL.has(F)) {
    current.savings.push({ name: F, amount: Number(row.E) });
  }

  if (A && row.B && isNumber(row.B) && !STRUCTURAL.has(A) && !isDateLike(A)) {
    const { name, method } = splitNameMethod(A);
    if (name) current.salary.push({ name, method, amount: Number(row.B) });
  }
}
if (current) blocks.push(current);

// ── Diff helper ─────────────────────────────────────────────────────────────
function listKeys(list) {
  return (list || []).map((e) => `${e.name}|${e.amount}|${e.method || ""}`);
}

function diff(label, before, after) {
  const b = listKeys(before);
  const a = listKeys(after);
  const bSet = new Set(b);
  const aSet = new Set(a);
  const added = a.filter((x) => !bSet.has(x));
  const removed = b.filter((x) => !aSet.has(x));
  console.log(
    `   ${label}: ${b.length} -> ${a.length}  (+${added.length} / -${removed.length})`
  );
  for (const x of added) console.log(`      + ${x}`);
  for (const x of removed) console.log(`      - ${x}`);
}

// ── Write to Firestore ──────────────────────────────────────────────────────
let seq = 0;
const itemId = () => `resync-${(++seq).toString(36).padStart(4, "0")}`;

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  await signInAnonymously(auth);
  console.log(`Parsed ${blocks.length} target month block(s). DRY_RUN=${DRY_RUN}\n`);
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

    const salSum = dailyFromSalary.reduce((s, e) => s + e.amount, 0);
    const savSum = dailyFromSavings.reduce((s, e) => s + e.amount, 0);

    console.log(`Period ${block.id}:`);
    console.log(`   salary items: ${dailyFromSalary.length} (total ${salSum.toLocaleString("id-ID")})`);
    console.log(`   savings items: ${dailyFromSavings.length} (total ${savSum.toLocaleString("id-ID")})`);
    diff("husbandDailyFromSalary", existing.husbandDailyFromSalary, dailyFromSalary);
    diff("husbandDailyFromSavings", existing.husbandDailyFromSavings, dailyFromSavings);

    if (!DRY_RUN) {
      const merged = {
        ...existing,
        id: block.id,
        husbandDailyFromSalary: dailyFromSalary,
        husbandDailyFromSavings: dailyFromSavings,
        updatedAt: new Date().toISOString()
      };
      await setDoc(ref, merged);
      console.log("   ✓ written to Firestore");
    }
    console.log("");
  }
  console.log(DRY_RUN ? "ℹ️  Dry run complete (no writes)." : "✅ Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
