<script lang="ts">
  /**
   * Animated rupiah figure: eases from the previous value to the new one whenever
   * `value` changes, and from 0 on first mount.
   *
   * Used only for headline numbers (dashboard totals, month summary cards) so the
   * motion stays meaningful instead of animating every line item. Honours the OS
   * "reduce motion" setting by snapping straight to the final value.
   *
   *   <CountUp value={totals.totalIncome} />
   */
  import { formatCurrency } from "#lib/types";

  interface Props {
    /** Target amount in rupiah. */
    value: number;
    /** Animation duration in ms. */
    duration?: number;
    /** Optional extra class for styling/colour. */
    class?: string;
  }

  let { value, duration = 900, class: className = "" }: Props = $props();

  let displayed = $state(0);
  let frame: number | null = null;

  function prefersReducedMotion(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  /** Ease-out cubic — fast start, gentle settle. */
  function easeOut(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  function animateTo(target: number) {
    if (frame !== null) cancelAnimationFrame(frame);

    if (prefersReducedMotion()) {
      displayed = target;
      return;
    }

    const from = displayed;
    const delta = target - from;
    if (delta === 0) return;

    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      displayed = from + delta * easeOut(t);
      if (t < 1) {
        frame = requestAnimationFrame(step);
      } else {
        displayed = target;
        frame = null;
      }
    };
    frame = requestAnimationFrame(step);
  }

  // Re-run whenever the target changes (including the first render).
  $effect(() => {
    const target = Number(value) || 0;
    animateTo(target);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
    };
  });
</script>

<span class="count-up {className}" style:font-variant-numeric="tabular-nums">
  {formatCurrency(Math.round(displayed))}
</span>
