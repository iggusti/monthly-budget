import { describe, expect, it } from "vitest";
import helpers from "./notify-helpers.js";

const { buildMessage, chatIdsConfigured, groupRecipients, isDeferred, plannedSends, resolveChatId, retryAfterSeconds } = helpers;

const expense = (id, name, amount) => ({ id, name, amount, method: "QRIS" });

function budget(overrides = {}) {
  return {
    title: "November 2026",
    husbandFixed: [],
    wifeFixed: [],
    husbandDailyFromSalary: [],
    husbandDailyFromSavings: [],
    wifeDailyFromSalary: [],
    wifeDailyFromSavings: [],
    ...overrides
  };
}

const env = {
  TELEGRAM_BOT_TOKEN: "bot-token",
  TELEGRAM_CHAT_ID_HUSBAND: "111",
  TELEGRAM_CHAT_ID_WIFE: "222"
};

const devices = [
  { uid: "u1", recipient: "husband", lang: "en", enabled: true },
  { uid: "u1", recipient: "husband", lang: "en", enabled: true },
  { uid: "u2", recipient: "wife", lang: "id", enabled: true },
  { uid: "u3", recipient: "wife", lang: "id", enabled: false }
];

describe("resolveChatId", () => {
  it("prefers the recipient-specific chat, then the family fallback", () => {
    expect(resolveChatId(env, "wife")).toBe("222");
    expect(resolveChatId({ TELEGRAM_CHAT_ID: "shared" }, "husband")).toBe("shared");
    expect(resolveChatId({}, "husband")).toBeNull();
  });

  it("reports whether any chat is configured", () => {
    expect(chatIdsConfigured(env)).toBe(true);
    expect(chatIdsConfigured({ TELEGRAM_CHAT_ID: "shared" })).toBe(true);
    expect(chatIdsConfigured({})).toBe(false);
  });
});

describe("retryAfterSeconds", () => {
  it("reads Telegram's retry hint and ignores missing or invalid values", () => {
    expect(retryAfterSeconds({ parameters: { retry_after: 32 } })).toBe(32);
    expect(retryAfterSeconds({ parameters: { retry_after: 1.4 } })).toBe(2);
    expect(retryAfterSeconds({ ok: false })).toBe(0);
    expect(retryAfterSeconds(undefined)).toBe(0);
  });
});

describe("isDeferred", () => {
  it("defers a job only while its retry window is open", () => {
    const now = Date.parse("2026-11-24T05:00:00.000Z");
    expect(isDeferred({ retryAfterAt: "2026-11-24T05:00:35.000Z" }, now)).toBe(true);
    expect(isDeferred({ retryAfterAt: "2026-11-24T04:59:00.000Z" }, now)).toBe(false);
    expect(isDeferred({}, now)).toBe(false);
  });
});

describe("groupRecipients", () => {
  it("drops the editor, disabled devices and duplicate uids", () => {
    expect(groupRecipients(devices, "u1")).toEqual([
      { recipient: "wife", lang: "id", uids: ["u2"] }
    ]);
  });

  it("keeps every language and recipient pair separate", () => {
    const groups = groupRecipients(devices, null);
    expect(groups).toEqual([
      { recipient: "husband", lang: "en", uids: ["u1"] },
      { recipient: "wife", lang: "id", uids: ["u2"] }
    ]);
  });

  it("ignores legacy records without a recipient", () => {
    const legacy = [{ uid: "old", lang: "en", enabled: true, platform: "web" }];
    expect(groupRecipients(legacy, null)).toEqual([]);
  });
});

describe("buildMessage", () => {
  it("builds a Telegram payload with a deep link to the month", () => {
    const payload = buildMessage(
      { ...env, APP_URL: "https://example.test/" },
      { recipient: "wife", lang: "id" },
      { title: "Pengeluaran baru", body: "Listrik" },
      "2026-11"
    );
    expect(payload).toEqual({
      chat_id: "222",
      text: "Pengeluaran baru\nListrik",
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [{ text: "Buka anggaran", url: "https://example.test/month/2026-11" }]
        ]
      }
    });
  });

  it("returns null when no chat is configured for the recipient", () => {
    expect(
      buildMessage({ TELEGRAM_BOT_TOKEN: "t" }, { recipient: "wife", lang: "en" }, { title: "t", body: "b" }, "x")
    ).toBeNull();
  });
});

describe("plannedSends", () => {
  const after = budget({ husbandFixed: [expense("a", "Listrik", 150000)] });

  it("sends nothing when an edit does not change expenses", () => {
    const before = budget({ husbandFixed: [{ ...expense("a", "Listrik", 150000), checked: true }] });
    expect(plannedSends({ before, after, monthId: "2026-11", editorUid: "u1", devices, env })).toEqual([]);
  });

  it("sends one localized message per remaining recipient", () => {
    const sends = plannedSends({
      before: budget(),
      after,
      monthId: "2026-11",
      editorUid: "u1",
      devices,
      env
    });
    expect(sends).toHaveLength(1);
    expect(sends[0]).toMatchObject({ recipient: "wife", lang: "id" });
    expect(sends[0].message.chat_id).toBe("222");
    expect(sends[0].message.text).toContain("Listrik");
  });

  it("sends only once when both family members share one chat", () => {
    const sends = plannedSends({
      before: budget(),
      after,
      monthId: "2026-11",
      editorUid: "nobody",
      devices,
      env: { TELEGRAM_BOT_TOKEN: "bot-token", TELEGRAM_CHAT_ID: "shared-chat" }
    });
    expect(sends).toHaveLength(1);
    expect(sends[0].message.chat_id).toBe("shared-chat");
  });

  it("notifies the other spouse when a whole month is deleted", () => {
    const sends = plannedSends({
      before: after,
      after: null,
      monthId: "2026-11",
      editorUid: "u2",
      devices,
      env
    });
    expect(sends).toHaveLength(1);
    expect(sends[0]).toMatchObject({ recipient: "husband", lang: "en" });
    expect(sends[0].message.text).toContain("Month deleted");
  });
});
