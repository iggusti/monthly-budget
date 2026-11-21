import { describe, expect, it } from "vitest";
import { en, id } from "./i18n-dicts";

/** Names of `{placeholders}` used by a string. */
function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

describe("i18n dictionaries", () => {
  it("has the same keys in both languages", () => {
    expect(Object.keys(id).sort()).toEqual(Object.keys(en).sort());
  });

  it("keeps each key's placeholders in sync", () => {
    const mismatches = Object.keys(en).filter(
      (key) => id[key] !== undefined && placeholders(en[key]).join() !== placeholders(id[key]).join()
    );
    expect(mismatches).toEqual([]);
  });

  it("has no empty copy", () => {
    const empty = [...Object.entries(en), ...Object.entries(id)]
      .filter(([, text]) => text.trim().length === 0)
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });
});
