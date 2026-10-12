/** Shared types and constants for the library table (header, rows, page). */

export interface RangeValue {
  min?: number;
  max?: number;
}

export type FilterType = "text" | "select" | "range" | "multiselect";
export type FilterValue = string | string[] | RangeValue | null | undefined;

export interface FilterState {
  title: string;
  artist: string;
  album: string;
  rootFolder: string[];
  genre: string[];
  subgenres: string[];
  bpm: RangeValue;
  key: string[];
  energy: RangeValue;
  danceability: RangeValue;
  social: RangeValue;
  duration: RangeValue;
  tags: string[];
}

export interface FilterOption {
  label: string;
  value: string;
  color?: string;
}

export interface FilterOptions {
  mainGenres: FilterOption[];
  subgenres: FilterOption[];
  keys: FilterOption[];
  tags: FilterOption[];
  rootFolders: FilterOption[];
}

export type SortState = { column: string; dir: "asc" | "desc" } | null;

/** Columns whose values are numbers: right-aligned in header and cells. */
export const NUMERIC_COLUMNS = new Set(["bpm", "duration"]);

export const FILTER_CONFIG: Record<
  keyof FilterState,
  { type: Exclude<FilterType, "select">; optionsKey?: keyof FilterOptions; min?: number; max?: number; placeholder?: string }
> = {
  title: { type: "text", placeholder: "Filter titles…" },
  artist: { type: "text", placeholder: "Filter artists…" },
  album: { type: "text", placeholder: "Filter albums…" },
  rootFolder: { type: "multiselect", optionsKey: "rootFolders" },
  bpm: { type: "range", min: 60, max: 200 },
  key: { type: "multiselect", optionsKey: "keys" },
  genre: { type: "multiselect", optionsKey: "mainGenres" },
  subgenres: { type: "multiselect", optionsKey: "subgenres" },
  energy: { type: "range", min: 0, max: 5 },
  danceability: { type: "range", min: 0, max: 5 },
  social: { type: "range", min: 0, max: 5 },
  duration: { type: "range", min: 0, max: 600 },
  tags: { type: "multiselect", optionsKey: "tags" },
};

export function isFilterActive(type: FilterType, value: FilterValue): boolean {
  if (type === "text") return typeof value === "string" && value.length > 0;
  if (type === "select") return value !== null && value !== undefined;
  if (type === "multiselect") return Array.isArray(value) && value.length > 0;
  if (type === "range") {
    const r = value as RangeValue | null | undefined;
    return r?.min !== undefined || r?.max !== undefined;
  }
  return false;
}
