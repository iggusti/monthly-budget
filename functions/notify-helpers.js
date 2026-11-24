/**
 * Pure helpers for the scheduled Telegram sender.
 *
 * No Firebase or network calls here: given a queued job and the registered
 * devices, these functions decide exactly which Telegram messages to send.
 * Kept CommonJS to match `changes.js` so the same code runs in Node and Vitest.
 */

const { collectEvents, buildContent } = require("./changes");

const DEFAULT_APP_URL = "https://monthly-budget-nia-ilham.web.app";

/** Husband/wife chat IDs are optional; a single family chat works as fallback. */
function resolveChatId(env, recipient) {
  const specific = env[`TELEGRAM_CHAT_ID_${String(recipient || "").toUpperCase()}`];
  if (specific) return specific;
  return env.TELEGRAM_CHAT_ID || null;
}

/** Whether at least one chat can be resolved from the environment. */
function chatIdsConfigured(env) {
  return Boolean(
    env.TELEGRAM_CHAT_ID ||
      env.TELEGRAM_CHAT_ID_HUSBAND ||
      env.TELEGRAM_CHAT_ID_WIFE
  );
}

/** Telegram's `retry_after` hint (seconds) on a 429, or 0 when absent. */
function retryAfterSeconds(result) {
  const seconds = Number(result?.parameters?.retry_after ?? 0);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 0;
}

/** Whether a job is still waiting out a Telegram rate limit. */
function isDeferred(job, nowMs = Date.now()) {
  const until = Date.parse(job?.retryAfterAt || "");
  return Number.isFinite(until) && until > nowMs;
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
    if (device.recipient !== "husband" && device.recipient !== "wife") continue;

    const recipient = device.recipient;
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

/** Build the sendMessage payload for one Telegram chat. */
function buildMessage(env, group, content, monthId) {
  const chatId = resolveChatId(env, group.recipient);
  if (!chatId) return null;

  const appUrl = (env.APP_URL || DEFAULT_APP_URL).replace(/\/$/, "");
  const linkLabel = group.lang === "en" ? "Open budget" : "Buka anggaran";
  return {
    chat_id: chatId,
    text: `${content.title}\n${content.body}`,
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [[{ text: linkLabel, url: `${appUrl}/month/${monthId}` }]]
    }
  };
}

/**
 * Turn one queued job into the list of Telegram payloads it should produce.
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
  const sentChats = new Set();

  for (const group of groups) {
    const chatId = resolveChatId(env, group.recipient);
    if (!chatId || sentChats.has(chatId)) continue;
    // A shared family chat must not receive one message per family member.
    sentChats.add(chatId);

    const content = buildContent(group.lang, monthTitle, events);
    const message = buildMessage(env, group, content, monthId);
    if (message) messages.push({ message, recipient: group.recipient, lang: group.lang });
  }

  return messages;
}

module.exports = {
  DEFAULT_APP_URL,
  resolveChatId,
  chatIdsConfigured,
  retryAfterSeconds,
  isDeferred,
  groupRecipients,
  buildMessage,
  plannedSends
};
