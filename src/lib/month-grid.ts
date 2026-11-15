/**
 * First-page sizing for the dashboard month grid.
 *
 * The grid is responsive (1 column on phones up to 4 on wide screens), so a
 * hard-coded 8 cards meant eight tall rows on a phone. Instead the first page
 * fills a whole number of rows for the current column count.
 */

/** How many rows of month cards to show before "View more". */
export function monthRowsForColumns(columns: number): number {
  const cols = normaliseColumns(columns);
  if (cols === 1) return 4;
  if (cols === 2) return 3;
  return 2;
}

/** Number of month cards on the first page: always whole rows, never 0. */
export function monthPageSize(columns: number): number {
  const cols = normaliseColumns(columns);
  return cols * monthRowsForColumns(cols);
}

function normaliseColumns(columns: number): number {
  return Number.isFinite(columns) ? Math.max(1, Math.floor(columns)) : 1;
}
