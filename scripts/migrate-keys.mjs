/**
 * Migrate Firestore budget documents to the current, consistent key names.
 * Rewrites each document with only model-valid fields, which removes any
 * deprecated/legacy keys for good.
 *
 * Renames:
 *   dailyFromSalary   -> husbandDailyFromSalary
 *   dailyFromSavings  -> husbandDailyFromSavings
 *
 * Removes deprecated keys:
 *   savingsWithdrawals, transferToWife
 *
 * Ensures wife daily arrays exist:
 *   wifeDailyFromSalary, wifeDailyFromSavings
 *
 * Run with: node scripts/migrate-keys.mjs
 */
const PROJECT_ID = "monthly-budget-580b2";
const API_KEY = "AIzaSyA76dfX8IPTvTx7ehorlHi9OFvr2s-Npug";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const RENAME = {
  dailyFromSalary: "husbandDailyFromSalary",
  dailyFromSavings: "husbandDailyFromSavings"
};
const REMOVE = ["savingsWithdrawals", "transferToWife"];
const ENSURE = ["wifeDailyFromSalary", "wifeDailyFromSavings"];

async function listAll() {
  const out = [];
  let pageToken = "";
  let url = `${BASE}/budget?key=${API_KEY}&pageSize=300`;
  do {
    if (pageToken) url = `${url}&pageToken=${encodeURIComponent(pageToken)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    out.push(...(data.documents || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return out;
}

async function migrate(doc) {
  const id = doc.name.split("/").pop();
  const fields = doc.fields || {};
  const next = {};

  for (const [key, value] of Object.entries(fields)) {
    const newKey = RENAME[key] ?? key;
    if (REMOVE.includes(newKey)) continue; // drop deprecated keys
    next[newKey] = value;
  }

  for (const key of ENSURE) {
    if (!next[key]) next[key] = { arrayValue: { values: [] } };
  }

  // Full overwrite (no updateMask) — fields not present are removed.
  const res = await fetch(`${BASE}/budget/${id}?key=${API_KEY}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: next })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${id}: ${res.status} ${err}`);
  }
  return id;
}

async function main() {
  const docs = await listAll();
  console.log(`Found ${docs.length} budget documents.`);
  for (const doc of docs) {
    const id = await migrate(doc);
    console.log(`✓ ${id} migrated`);
  }
  console.log("\n✅ Done.");
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
