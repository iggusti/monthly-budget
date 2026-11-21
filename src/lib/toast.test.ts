import { describe, expect, it } from "vitest";
import { dropToast, pushToast, TOAST_DURATION, TOAST_LIMIT, type Toast } from "./toast";

function toast(id: number, kind: Toast["kind"] = "success", message = `m${id}`): Toast {
  return { id, kind, message };
}

describe("pushToast", () => {
  it("appends the newest toast last", () => {
    const list = pushToast([toast(1)], toast(2));
    expect(list.map((t) => t.id)).toEqual([1, 2]);
  });

  it("does not mutate the list it is given", () => {
    const original = [toast(1)];
    pushToast(original, toast(2));
    expect(original.map((t) => t.id)).toEqual([1]);
  });

  it("drops the oldest once past the limit", () => {
    let list: Toast[] = [];
    for (let id = 1; id <= TOAST_LIMIT + 1; id++) list = pushToast(list, toast(id));
    expect(list).toHaveLength(TOAST_LIMIT);
    expect(list.map((t) => t.id)).toEqual([2, 3, 4]);
  });

  it("replaces a showing toast with the same kind and message", () => {
    const list = pushToast([toast(1, "success", "Entry added")], toast(2, "success", "Entry added"));
    expect(list.map((t) => t.id)).toEqual([2]);
  });

  it("keeps same-message toasts that differ in kind", () => {
    const list = pushToast([toast(1, "success", "Saved")], toast(2, "error", "Saved"));
    expect(list.map((t) => t.id)).toEqual([1, 2]);
  });

  it("keeps same-message toasts when only one offers an action", () => {
    const first = { ...toast(1, "success", "Deleted"), action: { label: "Undo", run: () => {} } };
    const list = pushToast([first], toast(2, "success", "Deleted"));
    expect(list.map((t) => t.id)).toEqual([1, 2]);
  });
});

describe("dropToast", () => {
  it("removes only the given id", () => {
    const list = dropToast([toast(1), toast(2), toast(3)], 2);
    expect(list.map((t) => t.id)).toEqual([1, 3]);
  });

  it("is a no-op for an unknown id", () => {
    const list = dropToast([toast(1)], 99);
    expect(list.map((t) => t.id)).toEqual([1]);
  });
});

describe("TOAST_DURATION", () => {
  it("keeps failures on screen longer than successes", () => {
    expect(TOAST_DURATION.error).toBeGreaterThan(TOAST_DURATION.success);
    expect(TOAST_DURATION.success).toBeGreaterThan(0);
  });
});
