/**
 * Equal-split messaging shared by the dashboard and month summary cards.
 *
 * One card changes meaning depending on where the period and the transfer are:
 *
 * - Wife → Husband: the card keeps showing the pending transfer until the wife
 *   marks it received in section 5. Her salary (and therefore her transfer)
 *   only arrives on the 1st, so there is nothing to send before that.
 * - Husband → Wife: the card shows the transfer only on the period's first day
 *   (the 25th). From the 26th on the husband has certainly sent it, so the card
 *   switches to the planned per-person budget.
 */

import { toISODate } from "./types";

export type EqualSplitCardKind = "transfer" | "plan";

/**
 * Pick the card to display for the equal-split row.
 *
 * @param equalSplitTransfer Positive = Husband → Wife, negative = Wife → Husband.
 * @param transferReceived Whether the Wife → Husband transfer has landed.
 * @param isPeriodStartDay Whether the viewed period starts today.
 */
export function equalSplitCardKind(
  equalSplitTransfer: number,
  transferReceived: boolean,
  isPeriodStartDay: boolean
): EqualSplitCardKind {
  if (equalSplitTransfer < 0) return transferReceived ? "plan" : "transfer";
  if (equalSplitTransfer > 0) return isPeriodStartDay ? "transfer" : "plan";
  return "plan";
}

/** True when `periodStart` (`YYYY-MM-DD`) is today's local date. */
export function isPeriodStartDay(periodStart: string | undefined, now: Date = new Date()): boolean {
  if (!periodStart) return false;
  return periodStart === toISODate(now);
}
