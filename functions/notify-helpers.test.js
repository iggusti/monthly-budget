import { describe, expect, it } from "vitest";
import helpers from "./notify-helpers.js";

const {
  buildMessage,
  chatIdsConfigured,
  groupRecipients,
  isDeferred,
  parseChatIds,
  plannedSends,
  resolveChatId,
  resolveChatIds,
  retryAfterSeconds
} = helpers;

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

describe("chat ID parsing", () => {
  it("splits, trims and deduplicates a comma-separated secret", () => {
    expect(parseChatIds("5959164056, 949805387, 5959164056")).toEqual([
      "5959164056",
      "949805387"
    ]);
    expect(parseChatIds("")).toEqual([]);
  });

  it("resolves every chat for a recipient and falls back to the shared chat", () => {
    expect(resolveChatIds({ TELEGRAM_CHAT_ID_WIFE: "5959164056,949805387" }, "wife")).toEqual([
      "5959164056",
      "949805387"
    ]);
    expect(resolveChatId({ TELEGRAM_CHAT_ID_WIFE: "5959164056,949805387" }, "wife")).toBe("5959164056");
    expect(resolveChatIds({ TELEGRAM_CHAT_ID: "shared" }, "husband")).toEqual(["shared"]);
    expect(resolveChatIds({}, "husband")).toEqual([]);
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
  it("builds a rich Telegram payload with a deep link to the month", () => {
    const payload = buildMessage(
      { ...env, APP_URL: "https://example.test/" },
      { recipient: "wife", lang: "id" },
      { title: "Pengeluaran baru", body: "Listrik", html: "<b>Listrik</b>" },
      "2026-11"
    );
    expect(payload).toEqual({
      chat_id: "222",
      text: "<b>Listrik</b>",
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [{ text: "Buka anggaran", url: "https://example.test/month/2026-11" }]
        ]
      }
    });
  });

  it("uses an explicit chat ID when one is supplied", () => {
    const payload = buildMessage(
      env,
      { recipient: "wife", lang: "en" },
      { title: "t", body: "b" },
      "x",
      "949805387"
    );
    expect(payload.chat_id).toBe("949805387");
    expect(payload.parse_mode).toBeUndefined();
  });

  it("returns null when no chat is configured for the recipient", () => {
    expect(
      buildMessage({ TELEGRAM_BOT_TOKEN: "t" }, { recipient: "wife", lang: "en" }, { title: "t", body: "b" }, "x")
    ).toBeNull();
  });
});

describe("plannedSends", () => {
  const after = budget({ husbandFixed: [expense("a", "Listrik", 150000)] });

  it("sends nothing when a save changes no tracked expense field", () => {
    const before = budget({ title: "Lama" });
    const differentTitle = budget({ title: "Baru" });
    expect(plannedSends({
      before,
      after: differentTitle,
      monthId: "2026-11",
      editorUid: "u1",
      devices,
      env
    })).toEqual([]);
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
    expect(sends[0]).toMatchObject({ recipient: "wife", lang: "id", chatId: "222" });
    expect(sends[0].message.text).toContain("Listrik");
    expect(sends[0].message.parse_mode).toBe("HTML");
  });

  it("sends to every chat configured for one recipient", () => {
    const sends = plannedSends({
      before: budget(),
      after,
      monthId: "2026-11",
      editorUid: "u1",
      devices,
      env: {
        TELEGRAM_BOT_TOKEN: "bot-token",
        TELEGRAM_CHAT_ID_HUSBAND: "111",
        TELEGRAM_CHAT_ID_WIFE: "5959164056, 949805387"
      }
    });
    expect(sends.map((send) => send.chatId)).toEqual(["5959164056", "949805387"]);
    expect(sends.every((send) => send.message.text.includes("<b>🟢 Pengeluaran baru</b>"))).toBe(true);
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
    expect(sends[0].message.text).toContain("🗑️ Month deleted");
  });
});


describe("activity jobs", () => {
  it("sends one activity card per chat for a failed Firebase action", () => {
    const sends = helpers.plannedSends({
      before: null,
      after: null,
      monthId: "2026-11",
      editorUid: "u1",
      devices,
      env: { ...env, TELEGRAM_CHAT_ID_WIFE: "5959164056,949805387" },
      job: {
        kind: "activity",
        action: "notify.enable",
        outcome: "error",
        detail: "wife",
        error: "permission-denied",
        editorUid: "u1"
      }
    });
    expect(sends.map((send) => send.chatId)).toEqual(["5959164056", "949805387"]);
    expect(sends[0].message.parse_mode).toBe("HTML");
    expect(sends[0].message.text).toContain("⚠️ Gagal");
    expect(sends[0].message.text).toContain("permission-denied");
  });

  it("falls back to a success card when a save changed no tracked expense", () => {
    const sends = helpers.plannedSends({
      before: budget({ title: "Lama" }),
      after: budget({ title: "Baru" }),
      monthId: "2026-11",
      editorUid: "u1",
      devices,
      env,
      job: {
        kind: "budget",
        outcome: "success",
        action: "budget.save",
        detail: "November 2026",
        editorUid: "u1",
        createdAt: "2026-11-25T08:15:00"
      }
    });
    expect(sends).toHaveLength(1);
    expect(sends[0].message.text).toContain("Anggaran disimpan");
    expect(sends[0].message.text).toContain("<b>Periode:</b> November 2026");
    expect(sends[0].message.text).toContain("dari suami · 25 Nov 2026, 08.15");
  });

  it("uses configured chats when no device is registered yet", () => {
    const sends = helpers.plannedSends({
      before: null,
      after: null,
      monthId: "activity",
      editorUid: "u1",
      devices: [],
      env: {
        TELEGRAM_BOT_TOKEN: "bot-token",
        TELEGRAM_CHAT_ID_HUSBAND: "111",
        TELEGRAM_CHAT_ID_WIFE: "5959164056,949805387"
      },
      job: {
        kind: "activity",
        action: "auth.login",
        outcome: "success",
        detail: "Anonymous sign-in",
        editorUid: "u1",
        createdAt: "2026-11-25T08:15:00"
      }
    });
    expect(sends.map((send) => send.chatId)).toEqual(["111", "5959164056", "949805387"]);
    expect(sends.every((send) => send.message.text.includes("Masuk anonim"))).toBe(true);
  });

  it("reports a checked item as a detailed status change", () => {
    const before = budget({ husbandFixed: [{ ...expense("a", "Listrik", 150000), checked: false }] });
    const after = budget({ husbandFixed: [{ ...expense("a", "Listrik", 150000), checked: true }] });
    const sends = helpers.plannedSends({
      before,
      after,
      monthId: "2026-11",
      editorUid: "u1",
      devices,
      env,
      job: {
        kind: "budget",
        outcome: "success",
        action: "budget.save",
        detail: "November 2026",
        editorUid: "u1",
        createdAt: "2026-11-25T08:15:00"
      }
    });
    expect(sends).toHaveLength(1);
    expect(sends[0].message.text).toContain("✏️ Pengeluaran diubah");
    expect(sends[0].message.text).toContain("<b>Status:</b> Belum lunas → <b>Lunas</b>");
  });
});
