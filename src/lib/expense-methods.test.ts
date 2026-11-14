import { describe, expect, it } from "vitest";
import {
  CHANNEL_BASES,
  METHOD_CHANNELS_ALL,
  METHOD_CHANNELS_BANK,
  channelsFor,
  isMethodBase,
  joinMethod,
  parseMethod
} from "./expense-methods";

describe("isMethodBase", () => {
  it("accepts only the three known bases", () => {
    expect(CHANNEL_BASES.every(isMethodBase)).toBe(true);
    expect(isMethodBase("qris")).toBe(true);
    expect(isMethodBase("QRIS")).toBe(false);
    expect(isMethodBase("")).toBe(false);
  });
});

describe("channelsFor", () => {
  it("offers every bank and e-wallet for QRIS and transfer", () => {
    expect(channelsFor("qris")).toEqual(METHOD_CHANNELS_ALL);
    expect(channelsFor("transfer")).toEqual(METHOD_CHANNELS_ALL);
  });

  it("offers banks only for a cash withdrawal", () => {
    expect(channelsFor("cash")).toEqual(METHOD_CHANNELS_BANK);
  });

  it("offers nothing for an unknown base", () => {
    expect(channelsFor("")).toEqual([]);
    expect(channelsFor("legacy")).toEqual([]);
  });
});

describe("parseMethod", () => {
  it("splits a base label from its channel", () => {
    expect(parseMethod("QRIS · BRI")).toEqual({ baseLabel: "QRIS", channel: "BRI" });
  });

  it("handles a base without a channel", () => {
    expect(parseMethod("Tarik tunai")).toEqual({ baseLabel: "Tarik tunai", channel: "" });
  });

  it("keeps a legacy free-text value as the base label", () => {
    expect(parseMethod("Auto Donate")).toEqual({ baseLabel: "Auto Donate", channel: "" });
  });

  it("handles missing values", () => {
    expect(parseMethod(undefined)).toEqual({ baseLabel: "", channel: "" });
  });
});

describe("joinMethod", () => {
  it("joins a base and channel with the separator", () => {
    expect(joinMethod("QRIS", "BRI")).toBe("QRIS · BRI");
  });

  it("omits the separator when there is no channel", () => {
    expect(joinMethod("QRIS", "")).toBe("QRIS");
    expect(joinMethod("QRIS", "   ")).toBe("QRIS");
  });

  it("round-trips through parseMethod", () => {
    const stored = joinMethod("Tarik tunai", "Bank Jago");
    expect(parseMethod(stored)).toEqual({ baseLabel: "Tarik tunai", channel: "Bank Jago" });
  });
});
