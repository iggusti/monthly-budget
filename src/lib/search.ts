/**
 * Query matching and highlighting shared by the dashboard's cross-month search
 * and the month page's per-section filter.
 */

/** True when an item's name or payment method contains the query. */
export function matchesQuery(name: string, method: string | undefined, query: string): boolean {
  if (!query.trim()) return true;
  const lowered = query.toLowerCase();
  return name.toLowerCase().includes(lowered) || (method ?? "").toLowerCase().includes(lowered);
}

/** Escape a string for safe use inside a RegExp. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Wrap the matching part of a name in `<mark>` for highlighting. */
export function highlightText(name: string, query: string): string {
  if (!query.trim()) return name;
  const regex = new RegExp(`(${escapeRegExp(query)})`, "gi");
  return name.replace(regex, "<mark>$1</mark>");
}
