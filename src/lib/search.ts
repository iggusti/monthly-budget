import { parseMethod } from "./expense-methods";

export type FilterPerson = "all" | "husband" | "wife";
export type FilterKind = "all" | "fixed" | "salary" | "savings";

export interface SearchFilters {
  person: FilterPerson;
  kind: FilterKind;
  method: string;
  channel: string;
  from: string;
  to: string;
}

export const EMPTY_FILTERS: SearchFilters = {
  person: "all",
  kind: "all",
  method: "",
  channel: "",
  from: "",
  to: ""
};

export function filtersActive(filters: SearchFilters): boolean {
  return (
    filters.person !== "all" ||
    filters.kind !== "all" ||
    filters.method !== "" ||
    filters.channel !== "" ||
    filters.from !== "" ||
    filters.to !== ""
  );
}

export function matchesQuery(name: string, method: string | undefined, query: string): boolean {
  if (!query.trim()) return true;
  const lowered = query.toLowerCase();
  return name.toLowerCase().includes(lowered) || (method ?? "").toLowerCase().includes(lowered);
}

export function sectionMatchesFilters(index: number, filters: SearchFilters): boolean {
  const person = index % 2 === 0 ? "husband" : "wife";
  if (filters.person !== "all" && filters.person !== person) return false;

  const kind = index < 4 ? "fixed" : index === 4 || index === 6 ? "salary" : "savings";
  if (index < 2 && filters.kind !== "all") return false;
  if (filters.kind !== "all" && filters.kind !== kind) return false;

  if (
    index < 4 &&
    (filters.method !== "" || filters.channel !== "" || filters.from !== "" || filters.to !== "")
  ) {
    return false;
  }
  return true;
}

export function itemMatchesFilters(
  item: { method?: string; date?: string },
  filters: SearchFilters
): boolean {
  const method = parseMethod(item.method);
  if (filters.method !== "" && method.baseLabel !== filters.method) return false;
  if (filters.channel !== "" && method.channel !== filters.channel) return false;
  if (filters.from && (!item.date || item.date < filters.from)) return false;
  if (filters.to && (!item.date || item.date > filters.to)) return false;
  return true;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function highlightText(name: string, query: string): string {
  if (!query.trim()) return name;
  const regex = new RegExp(`(${escapeRegExp(query)})`, "gi");
  return name.replace(regex, "<mark>$1</mark>");
}
