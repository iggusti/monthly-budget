import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MOTION,
  motionDuration,
  motionFade,
  motionFly,
  prefersReducedMotion,
  setMonthNavDirection,
  takeNavOffset
} from "./motion";

function setReducedMotion(matches: boolean) {
  vi.stubGlobal("window", { matchMedia: () => ({ matches }) });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("motion helpers", () => {
  it("mirrors the CSS motion tokens", () => {
    expect(MOTION).toEqual({ fast: 180, base: 280, slow: 450 });
  });

  it("keeps durations when reduced motion is not requested", () => {
    setReducedMotion(false);
    expect(prefersReducedMotion()).toBe(false);
    expect(motionDuration(MOTION.base)).toBe(280);
    expect(motionFly(12, MOTION.slow, 60)).toEqual({ y: 12, duration: 450, delay: 60 });
    expect(motionFade(MOTION.fast)).toEqual({ duration: 180, delay: 0 });
  });

  it("removes movement and waiting when reduced motion is requested", () => {
    setReducedMotion(true);
    expect(prefersReducedMotion()).toBe(true);
    expect(motionDuration(MOTION.slow)).toBe(0);
    expect(motionFly(12, MOTION.slow, 60)).toEqual({ y: 0, duration: 0, delay: 0 });
    expect(motionFade(MOTION.base, 100)).toEqual({ duration: 0, delay: 0 });
  });

  it("assumes full motion when window is unavailable (SSR)", () => {
    vi.stubGlobal("window", undefined);
    expect(prefersReducedMotion()).toBe(false);
    expect(motionDuration(MOTION.base)).toBe(280);
  });

  it("turns a month change into a directional offset, then clears it", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key)
    });

    expect(takeNavOffset(12)).toBe(0);
    setMonthNavDirection("2026-10", "2026-09");
    expect(takeNavOffset(12)).toBe(-12);
    expect(takeNavOffset(12)).toBe(0);
    setMonthNavDirection("2026-10", "2026-11");
    expect(takeNavOffset(12)).toBe(12);
  });
});
