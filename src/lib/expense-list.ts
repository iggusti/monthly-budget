import { BUDGET_SECTION_KEYS, type ExpenseItem, type MonthBudget } from "./types";

export function allExpenseItems(budget: MonthBudget): ExpenseItem[] {
  const items: ExpenseItem[] = [];
  for (const key of BUDGET_SECTION_KEYS) {
    if (key === "husbandIncome" || key === "wifeIncome") continue;
    items.push(...((budget[key] ?? []) as ExpenseItem[]));
  }
  return items;
}

/** Collapse settings shared by the list helpers below. */
export interface CollapseOptions {
  collapsible: boolean;
  showAll: boolean;
  collapseLimit: number;
}

/**
 * True when every item in a checkboxable section is paid (and there is at
 * least one item). Used to fold the whole list away.
 */
export function allExpensesChecked(items: ExpenseItem[], checkboxable: boolean): boolean {
  return checkboxable && items.length > 0 && items.every((item) => item.checked);
}

/**
 * Items to render in a collapsible section.
 *
 * - expanded (`showAll`) → every item;
 * - everything paid → none: the list folds away and "View more" reopens it;
 * - otherwise → unpaid items first, backfilled with the most recent paid ones.
 *
 * `orderedItems` is expected to be sorted already (unpaid before paid).
 */
export function visibleExpenseItems(
  orderedItems: ExpenseItem[],
  options: CollapseOptions & { allChecked: boolean }
): ExpenseItem[] {
  const { collapsible, showAll, collapseLimit, allChecked } = options;
  if (!collapsible || showAll) return orderedItems;
  if (allChecked) return [];
  const unchecked = orderedItems.filter((item) => !item.checked);
  if (unchecked.length >= collapseLimit) return unchecked.slice(-collapseLimit);
  const checked = orderedItems.filter((item) => item.checked);
  return [...unchecked, ...checked.slice(-(collapseLimit - unchecked.length))];
}

/**
 * Whether to show the view more/less toggle: when there is more to reveal, when
 * everything is paid (so the folded list can be reopened), or when the list is
 * expanded (so the user can collapse it again).
 */
export function showsViewMoreToggle(
  options: CollapseOptions & { itemCount: number; allChecked: boolean }
): boolean {
  const { collapsible, showAll, itemCount, collapseLimit, allChecked } = options;
  return collapsible && (itemCount > collapseLimit || allChecked || showAll);
}
