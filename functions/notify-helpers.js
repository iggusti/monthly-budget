/**
 * Pure helpers for the scheduled Pushover sender.
 *
 * No Firebase or network calls here: given a queued job and the registered
 * devices, these functions decide exactly which Pushover messages to send.
 * Kept CommonJS to match `changes.js` so the same code runs in Node and Vitest.
 */

const { collectEvents, buildContent } = require("./changes");

const DEFAULT_APP_URL = "https://monthly-budget-nia-ilham.web.app";

/** Husband/wife keys are optional; a single family key works as a fallback. */
function resolveUserKey(env, recipient) {
  const specific = env[`PUSHOVER_USER_KEY_${String(recipient || "").toUpperCase()}`];
  if (specific) return specific;
  return env.PUSHOVER_USER_KEY || null;
}

/** Whether at least one recipient can be resolved from the environment. */
function userKeysConfigured(env) {
  return Boolean(
    env.PUSHOVER_USER_KEY ||
      env.PUSHOVER_USER_KEY_HUSBAND ||
      env.PUSHOVER_USER_KEY_WIFE
  );
}

/**
 * Group the other people's devices by recipient + language.
 *
 * Devices belonging to the editor are dropped, so nobody gets a push for
 * their own edit. Both family members can have several browsers registered.
 */
function groupRecipients(devices, editorUid) {
  const groups = [];
  const seen = new Map();

  for (const device of Array.isArray(devices) ? devices : []) {
    if (!device || device.enabled === false || !device.uid) continue;
    if (editorUid && device.uid === editorUid) continue;

    const recipient = device.recipient === "wife" ? "wife" : "husband";
    const lang = device.lang === "en" ? "en" : "id";
    const key = `${recipient}|${lang}`;

    if (!seen.has(key)) {
      const group = { recipient, lang, uids: [] };
      groups.push(group);
      seen.set(key, group);
    }
    const group = seen.get(key);
    if (!group.uids.includes(device.uid)) {
      group.uids.push(device.uid);
    }
  }

  return groups;
}

/** Build the form payload for one Pushover message. */
function buildMessage(env, group, content, monthId) {
  const user = resolveUserKey(env, group.recipient);
  if (!user) return null;

  const appUrl = (env.APP_URL || DEFAULT_APP_URL).replace(/\/$/, "");
  return {
    token: env.PUSHOVER_APP_TOKEN,
    user,
    title: content.title,
    message: content.body,
    url: `${appUrl}/month/${monthId}`,
    url_title: group.lang === "en" ? "Open budget" : "Buka anggaran",
    timestamp: Math.floor(Date.now() / 1000),
    priority: "0"
  };
}

/**
 * Turn one queued job into the list of Pushover payloads it should produce.
 * Returns an empty list when nothing changed or nobody else is registered.
 */
function plannedSends({ before, after, monthId, editorUid, devices, env }) {
  const events = after
    ? collectEvents(before || undefined, after)
    : before
      ? [{ type: "month-delete" }]
      : [];
  if (events.length === 0) return [];

  const groups = groupRecipients(devices, editorUid);
  if (groups.length === 0) return [];

  const monthTitle = after?.title || before?.title || monthId;
  const messages = [];
  const sentKeys = new Set();

  for (const group of groups) {
    const user = resolveUserKey(env, group.recipient);
    if (!user || sentKeys.has(user)) continue;
    // A single shared key must not receive one push per family member.
    sentKeys.add(user);

    const content = buildContent(group.lang, monthTitle, events);
    const message = buildMessage(env, group, content, monthId);
    if (message) messages.push({ message, recipient: group.recipient, lang: group.lang });
  }

  return messages;
}

module.exports = {
  DEFAULT_APP_URL,
  resolveUserKey,
  userKeysConfigured,
  groupRecipients,
  buildMessage,
  plannedSends
};
