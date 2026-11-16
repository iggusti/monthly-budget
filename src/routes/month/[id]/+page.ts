import { error, redirect } from "@sveltejs/kit";
import { isKeywordGranted } from "#lib/auth";
import { budgetExists } from "#lib/budget-store";
import { isFuturePeriodId, isPastPeriodId } from "#lib/period";

/** A period id is `YYYY-MM` (see `period.ts`). */
const PERIOD_ID = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Gate the month page so only real periods open.
 *
 * The dashboard is the list of what exists: it shows the active period, the
 * upcoming one from the 21st, and every earlier month of the listed year. A
 * hand-typed URL for anything else — a malformed id, a future period, or a past
 * period that was never created — gets a 404 instead of a blank, editable
 * budget. The current and upcoming periods stay reachable before they exist
 * because their dashboard card creates the budget before navigating here.
 */
export async function load({ params }: { params: { id: string } }) {
  const id = params.id ?? "";

  // Not signed in: send the visitor to the keyword gate rather than a 404.
  if (!isKeywordGranted()) redirect(307, "/login");

  const missingPastPeriod = isPastPeriodId(id) && !(await budgetExists(id));
  if (!PERIOD_ID.test(id) || isFuturePeriodId(id) || missingPastPeriod) {
    error(404, `No budget period for "${id}".`);
  }

  return {};
}
