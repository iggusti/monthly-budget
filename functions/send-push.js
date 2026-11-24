/**
 * Drain `notification-outbox` and deliver queued budget changes via Telegram.
 *
 * Run by the scheduled GitHub Actions workflow in `.github/workflows/`, where
 * the bot token, chat IDs and Firebase service account live as repo secrets.
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
const SEND_SPACING_MS = 1200; // Telegram allows roughly one message per second per chat.
const MAX_RETRY_WAIT_SECONDS = 60;
const TELEGRAM_API = "https://api.telegram.org/bot";

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
    .filter((entry) => entry.data().createdAt && !helpers.isDeferred(entry.data()))
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function deliver(token, message) {
  const response = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok !== true) {
    const error = new Error(result.description || `Telegram HTTP ${response.status}`);
    const retryAfter = helpers.retryAfterSeconds(result);
    if (retryAfter) error.retryAfter = retryAfter;
    throw error;
  }
}

/** Rate limits are usually short: wait once, then let the next run pick it up. */
async function deliverWithRetry(token, message) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await deliver(token, message);
    } catch (error) {
      const retryAfter = Number(error?.retryAfter || 0);
      if (attempt >= 1 || !retryAfter || retryAfter > MAX_RETRY_WAIT_SECONDS) throw error;
      console.log(`Telegram rate limit: retrying in ${retryAfter + 1}s`);
      await sleep((retryAfter + 1) * 1000);
    }
  }
}

async function main() {
  const token = requireEnv("TELEGRAM_BOT_TOKEN");
  if (!helpers.chatIdsConfigured(process.env)) {
    throw new Error("Set TELEGRAM_CHAT_ID or TELEGRAM_CHAT_ID_HUSBAND / TELEGRAM_CHAT_ID_WIFE");
  }
  const env = { ...process.env, TELEGRAM_BOT_TOKEN: token };

  if (!getApps().length) initializeApp();
  const db = getFirestore();

  const reset = await resetStaleJobs(db);
  const jobs = await claimJobs(db);
  const devices = jobs.length ? await loadDevices(db) : [];

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let lastSentAt = 0;

  // Pace every message in the run, including ones from different jobs.
  async function pace() {
    const wait = SEND_SPACING_MS - (Date.now() - lastSentAt);
    if (wait > 0) await sleep(wait);
    lastSentAt = Date.now();
  }

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
        await pace();
        await deliverWithRetry(token, send.message);
        console.log(`Sent ${send.recipient}/${send.lang} Telegram message for ${monthId}`);
      }

      await job.ref.update({
        status: "sent",
        processedAt: new Date().toISOString(),
        processingAt: null,
        retryAfterAt: null,
        recipients: sends.length
      });
      if (sends.length) sent += 1;
      else skipped += 1;
    } catch (error) {
      const attempts = Number(job.data.attempts || 0) + 1;
      const message = String(error?.message || error);
      console.error(`Failed job ${job.ref.id}: ${message}`);
      const retryAfter = Number(error?.retryAfter || 0);
      await job.ref.update({
        status: attempts >= MAX_ATTEMPTS ? "error" : "pending",
        attempts,
        lastError: message,
        processingAt: null,
        ...(retryAfter && attempts < MAX_ATTEMPTS
          ? { retryAfterAt: new Date(Date.now() + (retryAfter + 2) * 1000).toISOString() }
          : { retryAfterAt: null })
      });
      failed += 1;
    }
  }

  console.log(
    `Telegram sender: ${jobs.length} claimed, ${reset} reset, ${sent} sent, ${skipped} skipped, ${failed} failed`
  );
}

main().catch((error) => {
  console.error("Telegram sender stopped:", error);
  process.exitCode = 1;
});
