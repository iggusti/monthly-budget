/**
 * Push notifications for the monthly budget app.
 *
 * A single Firestore trigger watches `/budget/{monthId}`. On every write it
 * diffs the expense arrays before/after, classifies the change as an add, edit
 * or delete, and sends a data-only FCM message to every registered device
 * **except** the one that made the change (matched through `lastEditBy`).
 *
 * Deleting a whole month also lands here: `deleteBudget()` stamps the deleter's
 * uid just before removing the document, so the `before` snapshot identifies
 * them.
 */

const { setGlobalOptions } = require("firebase-functions/v2");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

const { collectEvents, buildContent } = require("./changes");

admin.initializeApp();

/**
 * Firestore-triggered functions must be deployed to a region that matches the
 * database location. This project's database is `nam5` (US multi-region), which
 * pairs with `us-central1`. Override with FUNCTION_REGION if that changes.
 */
const REGION = process.env.FUNCTION_REGION || "us-central1";

setGlobalOptions({ region: REGION, maxInstances: 10 });

const DEVICES_COLLECTION = "devices";
const BUDGET_COLLECTION = "budget";

/** Chrome/Android report dead tokens through a handful of error codes. */
function isStaleTokenError(code) {
  return (
    code === "messaging/registration-token-not-registered" ||
    code === "messaging/invalid-registration-token" ||
    code === "messaging/invalid-argument"
  );
}

/** Load device tokens grouped by language, skipping the editor's devices. */
async function loadDevices(editorUid) {
  const snapshot = await admin.firestore().collection(DEVICES_COLLECTION).get();
  const byLang = { id: [], en: [] };

  for (const entry of snapshot.docs) {
    const data = entry.data() || {};
    if (data.enabled === false) continue;
    // Never notify the device that made the change.
    if (editorUid && data.uid === editorUid) continue;

    const lang = data.lang === "en" ? "en" : "id";
    byLang[lang].push(entry.id);
  }

  return byLang;
}

/** Send one multicast message per token chunk and prune dead tokens. */
async function sendToTokens(tokens, data) {
  const messaging = admin.messaging();
  const stale = [];

  for (let index = 0; index < tokens.length; index += 500) {
    const chunk = tokens.slice(index, index + 500);
    const response = await messaging.sendEachForMulticast({
      tokens: chunk,
      data,
      android: { priority: "high", ttl: 60 * 60 * 1000 },
      webpush: { headers: { Urgency: "high", TTL: "3600" } }
    });

    response.responses.forEach((result, tokenIndex) => {
      if (result.success) return;
      const code = result.error?.code || "";
      logger.warn("Push failed", { code, message: result.error?.message });
      if (isStaleTokenError(code)) stale.push(chunk[tokenIndex]);
    });
  }

  await Promise.all(
    stale.map((token) =>
      admin
        .firestore()
        .collection(DEVICES_COLLECTION)
        .doc(token)
        .delete()
        .catch((error) => logger.warn("Failed to prune stale token", { error: String(error) }))
    )
  );
}

exports.notifyBudgetChanges = onDocumentWritten(
  { document: `${BUDGET_COLLECTION}/{monthId}` },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const monthId = event.params.monthId;

    let events = [];

    if (after) {
      events = collectEvents(before, after);
      if (events.length === 0) return;
    } else if (before) {
      // The whole month was deleted. The document was stamped with the
      // deleter's uid right before removal.
      events = [{ type: "month-delete" }];
    } else {
      return;
    }

    const editorUid = after?.lastEditBy ?? before?.lastEditBy ?? null;
    const monthTitle = after?.title ?? before?.title ?? monthId;
    const devices = await loadDevices(editorUid);

    const url = `/month/${monthId}`;
    const tag = `budget-${monthId}`;

    for (const lang of ["id", "en"]) {
      const tokens = devices[lang];
      if (tokens.length === 0) continue;

      const { title, body } = buildContent(lang, monthTitle, events);
      await sendToTokens(tokens, {
        title,
        body,
        url,
        tag,
        monthId
      });
    }

    logger.info("Budget change notified", {
      monthId,
      editor: editorUid,
      events: events.length,
      devices: devices.id.length + devices.en.length
    });
  }
);
