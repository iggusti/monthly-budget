/**
 * Pure helpers for the scheduled Telegram sender.
 *
 * No Firebase or network calls here: given a queued job and the registered
 * devices, these functions decide exactly which Telegram messages to send.
 * Kept CommonJS to match `changes.js` so the same code runs in Node and Vitest.
 */

const { collectEvents, buildContent, buildActivityContent } = require("./changes");

const DEFAULT_APP_URL = "https://monthly-budget-nia-ilham.web.app";

/** Split a comma-separated secret into unique, non-empty chat IDs. */
function parseChatIds(value) {
  return [...new Set(
    String(value || "")
      .split(/[\s,]+/)
      .map((id) => id.trim())
      .filter(Boolean)
  )];
}

/** Husband/wife chat IDs are optional; a shared family chat works as fallback. */
function resolveChatIds(env, recipient) {
  const specific = env[`TELEGRAM_CHAT_ID_${String(recipient || "").toUpperCase()}`];
  const ids = parseChatIds(specific);
  return ids.length ? ids : parseChatIds(env.TELEGRAM_CHAT_ID);
}

/** First chat for a recipient, kept for callers that need a single ID. */
function resolveChatId(env, recipient) {
  return resolveChatIds(env, recipient)[0] || null;
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
function buildMessage(env, group, content, monthId, chatId = resolveChatId(env, group.recipient)) {
  if (!chatId) return null;

  const appUrl = (env.APP_URL || DEFAULT_APP_URL).replace(/\/$/, "");
  const linkLabel = group.lang === "en" ? "Open budget" : "Buka anggaran";
  const payload = {
    chat_id: chatId,
    text: content.html || `${content.title}\n${content.body}`,
    parse_mode: content.html ? "HTML" : undefined,
    disable_web_page_preview: true
  };
  if (monthId && monthId !== "activity") {
    payload.reply_markup = {
      inline_keyboard: [[{ text: linkLabel, url: `${appUrl}/month/${monthId}` }]]
    };
  }
  return payload;
}

/** Recipients we know from Secrets, used when devices are not registered yet. */
function configuredGroups(env, skipRecipient = null) {
  return ["husband", "wife"]
    .filter((recipient) => recipient !== skipRecipient && resolveChatIds(env, recipient).length > 0)
    .map((recipient) => ({ recipient, lang: "id", uids: [] }));
}

/** Errors that will not fix themselves by retrying the same chat. */
function isPermanentTelegramError(result) {
  const code = Number(result?.error_code || 0);
  const description = String(result?.description || "").toLowerCase();
  if (code === 400 && /chat not found|chat_id is invalid|can't initiate|bot can't initiate/.test(description)) return true;
  if (code === 403 && /blocked|kicked|deactivated/.test(description)) return true;
  return false;
}

/** Activity jobs notify the other device; if none exists, tell the actor. */
function activitySends({ activity, monthId, editorUid, devices, env, deliveredChats = [] }) {
  const payload = { ...activity, monthId: activity?.monthId || monthId || null };
  const allGroups = groupRecipients(devices, null);
  const otherGroups = groupRecipients(devices, editorUid);
  let groups = otherGroups.length ? otherGroups : allGroups;
  if (groups.length === 0) {
    // Login and "disable notifications" can happen before any device record
    // exists. Still deliver the card to whichever chats are configured.
    groups = configuredGroups(env);
  }
  const messages = [];
  const sentChats = new Set(deliveredChats);

  for (const group of groups) {
    const chatIds = resolveChatIds(env, group.recipient);
    const content = buildActivityContent(group.lang, payload, {
      recipient: group.recipient,
      editorUid: editorUid || payload.editorUid || null,
      devices
    });
    for (const chatId of chatIds) {
      if (sentChats.has(chatId)) continue;
      sentChats.add(chatId);
      const message = buildMessage(env, group, content, payload.monthId || "activity", chatId);
      if (message) {
        messages.push({ message, recipient: group.recipient, lang: group.lang, chatId });
      }
    }
  }

  return messages;
}

/**
 * Turn one queued job into the list of Telegram payloads it should produce.
 * Returns an empty list when nothing changed or nobody else is registered.
 */
function plannedSends({ before, after, monthId, editorUid, devices, env, job, deliveredChats = [] }) {
  const editor = editorUid || job?.editorUid || null;
  const events = after
    ? collectEvents(before || undefined, after)
    : before
      ? [{ type: "month-delete" }]
      : [];

  // Auth/device actions and Firebase failures are pure activity jobs. A
  // successful save with no tracked expense change stays silent on Telegram.
  if (job?.kind === "activity") {
    return activitySends({ activity: job, monthId, editorUid: editor, devices, env, deliveredChats });
  }
  if (events.length === 0) return [];

  let groups = groupRecipients(devices, editor);
  if (groups.length === 0) {
    const actor = (Array.isArray(devices) ? devices : []).find((device) => device?.uid === editor);
    groups = configuredGroups(env, actor?.recipient || null);
  }
  if (groups.length === 0) return [];

  const monthTitle = after?.title || before?.title || monthId;
  const messages = [];
  const sentChats = new Set(deliveredChats);

  for (const group of groups) {
    const chatIds = resolveChatIds(env, group.recipient);
    if (!chatIds.length) continue;
    const content = buildContent(group.lang, monthTitle, events, {
      recipient: group.recipient,
      editorUid: editor,
      devices,
      outcome: job?.outcome || "success",
      createdAt: job?.createdAt || null
    });

    for (const chatId of chatIds) {
      // A shared family chat must not receive one message per family member.
      if (sentChats.has(chatId)) continue;
      sentChats.add(chatId);
      const message = buildMessage(env, group, content, monthId, chatId);
      if (message) {
        messages.push({ message, recipient: group.recipient, lang: group.lang, chatId });
      }
    }
  }

  return messages;
}

module.exports = {
  DEFAULT_APP_URL,
  parseChatIds,
  resolveChatIds,
  resolveChatId,
  chatIdsConfigured,
  retryAfterSeconds,
  isDeferred,
  groupRecipients,
  buildMessage,
  activitySends,
  configuredGroups,
  isPermanentTelegramError,
  plannedSends
};
