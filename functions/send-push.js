/**
 * Drain `notification-outbox` and deliver queued budget changes via Telegram.
 *
 * Run by the scheduled GitHub Actions workflow in `.github/workflows/`, where
 * the bot token, chat IDs and Firebase service account live as repo secrets.
 * No Cloud Functions or paid Firebase plan is involved.
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
const RETRY_COOLDOWN_SECONDS = 120; // Give a flooded bot a long, completely quiet window.
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
    error.permanent = helpers.isPermanentTelegramError(result);
    throw error;
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
    let delivered = Array.isArray(job.data.deliveredChats) ? [...job.data.deliveredChats] : [];
    try {
      const sends = helpers.plannedSends({
        before: before || null,
        after: after || null,
        monthId,
        editorUid: editorUid || null,
        devices,
        env,
        job: job.data,
        deliveredChats: delivered
      });

      if (!sends.length) {
        console.log(`No recipients for ${monthId}: editor=${editorUid || "none"} devices=${devices.length}`);
      }

      for (const send of sends) {
        await pace();
        await deliver(token, send.message);
        // Persist after every chat so a later failure never re-sends this one.
        delivered.push(send.chatId);
        await job.ref.update({ deliveredChats: delivered });
        console.log(`Sent ${send.recipient}/${send.lang} Telegram message for ${monthId}`);
      }

      await job.ref.update({
        status: "sent",
        processedAt: new Date().toISOString(),
        processingAt: null,
        retryAfterAt: null,
        recipients: delivered.length,
        deliveredChats: delivered
      });
      if (delivered.length) sent += 1;
      else skipped += 1;
    } catch (error) {
      const message = String(error?.message || error);
      const retryAfter = Number(error?.retryAfter || 0);
      console.error(`Failed job ${job.ref.id}: ${message}`);

      // A Telegram throttle is temporary: keep the job queued without burning
      // an attempt, so a long API outage cannot silently drop notifications.
      if (error?.permanent) {
        await job.ref.update({
          status: "error",
          lastError: `${message} (permanent)`,
          processingAt: null,
          retryAfterAt: null,
          recipients: delivered.length,
          deliveredChats: delivered
        });
        failed += 1;
        continue;
      }

      if (retryAfter) {
        await job.ref.update({
          status: "pending",
          lastError: message,
          processingAt: null,
          retryAfterAt: new Date(Date.now() + (retryAfter + RETRY_COOLDOWN_SECONDS) * 1000).toISOString(),
          deliveredChats: delivered
        });
        continue;
      }

      const attempts = Number(job.data.attempts || 0) + 1;
      await job.ref.update({
        status: attempts >= MAX_ATTEMPTS ? "error" : "pending",
        attempts,
        lastError: message,
        processingAt: null,
        retryAfterAt: null,
        deliveredChats: delivered
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
