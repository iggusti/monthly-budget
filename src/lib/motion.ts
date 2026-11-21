/** Motion durations in milliseconds, matching the tokens in `app.css`. */
export const MOTION = { fast: 180, base: 280, slow: 450 } as const;

/** True when the OS asks for reduced motion. Safe to call during SSR. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** JS-transition duration, collapsed to zero for reduced motion. */
export function motionDuration(ms: number): number {
  return prefersReducedMotion() ? 0 : ms;
}

/** `fly` params: distance, duration and delay all collapse for reduced motion. */
export function motionFly(y: number, ms: number, delay = 0) {
  return {
    y: prefersReducedMotion() ? 0 : y,
    duration: motionDuration(ms),
    delay: motionDuration(delay)
  };
}

/** `fade`/`slide` params with the same reduced-motion handling. */
export function motionFade(ms: number, delay = 0) {
  return { duration: motionDuration(ms), delay: motionDuration(delay) };
}

const NAV_DIRECTION_KEY = "fhb-nav-direction";

/** Remember whether a month change moves back or forward in time. */
export function setMonthNavDirection(from: string, to: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(NAV_DIRECTION_KEY, to < from ? "back" : "forward");
  } catch {
    // Storage may be disabled; navigation still works without a direction.
  }
}

/** Consume the pending month direction, or 0 for an ordinary page change. */
export function takeNavOffset(distance = 12): number {
  if (typeof sessionStorage === "undefined") return 0;
  try {
    const direction = sessionStorage.getItem(NAV_DIRECTION_KEY);
    sessionStorage.removeItem(NAV_DIRECTION_KEY);
    return direction === "back" ? -distance : direction === "forward" ? distance : 0;
  } catch {
    return 0;
  }
}
