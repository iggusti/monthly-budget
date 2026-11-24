/**
 * Drain `notification-outbox` and deliver queued budget changes via Pushover.
 *
 * Run by the scheduled GitHub Actions workflow in `.github/workflows/`, where
 * the Pushover keys and the Firebase service account live as repo secrets.
 * No Cloud Functions / Blaze plan is involved.
 */

const { getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const helpers = require("./notify-helpers");

const OUTBOX = "notification-outbox";
const DEVICES = "devices";
const MAX_JOBS = 25;
const MAX_ATTEMPTS = 5;
const STALE_AFTER_MS = 10 * 60 * 1000;
const PUSHOVER_URL = "https://api.pushover.net/1/messages.json";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required secret: ${name}`);
  return value;
}

/** Return processing jobs from a crashed run to the pending queue. */
async function resetStaleJobs(db) {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();
  const snapshot = await db.collection(OUTBOX).where("status", "==", "processing").limit(MAX_JOBS).get();

  const stale = snapshot.docs.filter((entry) => {
    const processingAt = entry.data().processingAt;
    return typeof processingAt === "string" && processingAt < cutoff;
  });
  if (stale.length === 0) return 0;

  const batch = db.batch();
  for (const entry of stale) {
    batch.update(entry.ref, { status: "pending", processingAt: null });
  }
  await batch.commit();
  return stale.length;
}

/**
 * Claim pending jobs with a transaction so two overlapping workflow runs can
 * never send the same job twice. Sorting happens in memory to avoid needing a
 * composite Firestore index.
 */
async function claimJobs(db) {
  const snapshot = await db.collection(OUTBOX).where("status", "==", "pending").limit(200).get();
  const pending = snapshot.docs
    .filter((entry) => entry.data().createdAt)
    .sort((a, b) => String(a.data().createdAt).localeCompare(String(b.data().createdAt)))
    .slice(0, MAX_JOBS);

  const claimed = [];
  for (const entry of pending) {
    const job = await db.runTransaction(async (transaction) => {
      const fresh = await transaction.get(entry.ref);
      if (!fresh.exists || fresh.data().status !== "pending") return null;
      transaction.update(entry.ref, {
        status: "processing",
        processingAt: new Date().toISOString()
      });
      return { ref: entry.ref, data: fresh.data() };
    });
    if (job) claimed.push(job);
  }
  return claimed;
}

/** All enabled device registrations. Small collection, so no query needed. */
async function loadDevices(db) {
  const snapshot = await db.collection(DEVICES).get();
  return snapshot.docs.map((entry) => entry.data());
}

async function deliver(message) {
  const response = await fetch(PUSHOVER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(message).toString()
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.status !== 1) {
    throw new Error((result.errors || []).join("; ") || `Pushover HTTP ${response.status}`);
  }
}

async function main() {
  const token = requireEnv("PUSHOVER_APP_TOKEN");
  if (!helpers.userKeysConfigured(process.env)) {
    throw new Error("Set PUSHOVER_USER_KEY or PUSHOVER_USER_KEY_HUSBAND / PUSHOVER_USER_KEY_WIFE");
  }
  const env = { ...process.env, PUSHOVER_APP_TOKEN: token };

  if (!getApps().length) initializeApp();
  const db = getFirestore();

  const reset = await resetStaleJobs(db);
  const jobs = await claimJobs(db);
  const devices = jobs.length ? await loadDevices(db) : [];

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const job of jobs) {
    const { before, after, monthId, editorUid } = job.data;
    try {
      const sends = helpers.plannedSends({
        before: before || null,
        after: after || null,
        monthId,
        editorUid: editorUid || null,
        devices,
        env
      });

      if (!sends.length) {
        console.log(`No recipients for ${monthId}: editor=${editorUid || "none"} devices=${devices.length}`);
      }

      for (const send of sends) {
        await deliver(send.message);
        console.log(`Sent ${send.recipient}/${send.lang} push for ${monthId}`);
      }

      await job.ref.update({
        status: "sent",
        processedAt: new Date().toISOString(),
        processingAt: null,
        recipients: sends.length
      });
      if (sends.length) sent += 1;
      else skipped += 1;
    } catch (error) {
      const attempts = Number(job.data.attempts || 0) + 1;
      const message = String(error?.message || error);
      console.error(`Failed job ${job.ref.id}: ${message}`);
      await job.ref.update({
        status: attempts >= MAX_ATTEMPTS ? "error" : "pending",
        attempts,
        lastError: message,
        processingAt: null
      });
      failed += 1;
    }
  }

  console.log(
    `Pushover sender: ${jobs.length} claimed, ${reset} reset, ${sent} sent, ${skipped} skipped, ${failed} failed`
  );
}

main().catch((error) => {
  console.error("Pushover sender stopped:", error);
  process.exitCode = 1;
});
