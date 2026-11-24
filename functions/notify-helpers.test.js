import { describe, expect, it } from "vitest";
import helpers from "./notify-helpers.js";

const { buildMessage, groupRecipients, plannedSends, resolveUserKey, userKeysConfigured } = helpers;

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
  PUSHOVER_APP_TOKEN: "app-token",
  PUSHOVER_USER_KEY_HUSBAND: "husband-key",
  PUSHOVER_USER_KEY_WIFE: "wife-key"
};

const devices = [
  { uid: "u1", recipient: "husband", lang: "en", enabled: true },
  { uid: "u1", recipient: "husband", lang: "en", enabled: true },
  { uid: "u2", recipient: "wife", lang: "id", enabled: true },
  { uid: "u3", recipient: "wife", lang: "id", enabled: false }
];

describe("resolveUserKey", () => {
  it("prefers the recipient-specific key, then the family fallback", () => {
    expect(resolveUserKey(env, "wife")).toBe("wife-key");
    expect(resolveUserKey({ PUSHOVER_USER_KEY: "shared" }, "husband")).toBe("shared");
    expect(resolveUserKey({}, "husband")).toBeNull();
  });

  it("reports whether any key is configured", () => {
    expect(userKeysConfigured(env)).toBe(true);
    expect(userKeysConfigured({ PUSHOVER_USER_KEY: "shared" })).toBe(true);
    expect(userKeysConfigured({})).toBe(false);
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
  it("builds a form payload with a deep link to the month", () => {
    const payload = buildMessage(
      { ...env, APP_URL: "https://example.test/" },
      { recipient: "wife", lang: "id" },
      { title: "Pengeluaran baru", body: "Listrik" },
      "2026-11"
    );
    expect(payload).toMatchObject({
      token: "app-token",
      user: "wife-key",
      title: "Pengeluaran baru",
      message: "Listrik",
      url: "https://example.test/month/2026-11",
      url_title: "Buka anggaran",
      priority: "0"
    });
    expect(payload.timestamp).toBeGreaterThan(0);
  });

  it("returns null when no key is configured for the recipient", () => {
    expect(buildMessage({ PUSHOVER_APP_TOKEN: "t" }, { recipient: "wife", lang: "en" }, { title: "t", body: "b" }, "x")).toBeNull();
  });
});

describe("plannedSends", () => {
  const after = budget({ husbandFixed: [expense("a", "Listrik", 150000)] });

  it("sends nothing when an edit does not change expenses", () => {
    const before = budget({ husbandFixed: [{ ...expense("a", "Listrik", 150000), checked: true }] });
    expect(plannedSends({ before, after, monthId: "2026-11", editorUid: "u1", devices, env })).toEqual([]);
  });

  it("sends one localized push per remaining recipient", () => {
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
    expect(sends[0].message).toMatchObject({ user: "wife-key", title: "Pengeluaran baru" });
    expect(sends[0].message.message).toContain("Listrik");
  });

  it("sends only once when both family members share one user key", () => {
    const sends = plannedSends({
      before: budget(),
      after,
      monthId: "2026-11",
      editorUid: "nobody",
      devices,
      env: { PUSHOVER_APP_TOKEN: "app-token", PUSHOVER_USER_KEY: "shared-key" }
    });
    expect(sends).toHaveLength(1);
    expect(sends[0].message.user).toBe("shared-key");
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
    expect(sends[0].message.title).toBe("Month deleted");
  });
});
