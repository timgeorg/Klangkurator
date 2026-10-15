/** Shared types and constants for the library table (header, rows, page). */

import { crateOf } from "@/lib/trackFormat";
import type { Song } from "@/lib/storage";

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
  rank: RangeValue;
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
  rank: { type: "range", min: 1, max: 5 },
  duration: { type: "range", min: 0, max: 600 },
  tags: { type: "multiselect", optionsKey: "tags" },
};

/** The filters the library starts with, and the value a cleared filter goes back to. */
export const INITIAL_FILTERS: FilterState = {
  title: "",
  artist: "",
  album: "",
  rootFolder: [],
  genre: [],
  subgenres: [],
  bpm: {},
  key: [],
  energy: {},
  danceability: {},
  social: {},
  rank: {},
  duration: {},
  tags: [],
};

/** A song's tags by song id. Only the ids are read, so the table's `Tag`
 * objects and the map's tag join (track ids only) both fit. */
export type SongTagsById = Readonly<Record<string, readonly { id: string }[]>>;

/**
 * The library's rows after its search and filters: the table's own predicate,
 * extracted unchanged so the table and the map share one implementation
 * (phase 4a, TM-R11). Sorting stays with the caller, and the rows the caller
 * already had are returned in their stored order.
 *
 * @param songs - The library's songs.
 * @param songTags - Each song's tags by song id; only their ids are read.
 * @param filters - The active column filters.
 * @param searchQuery - The header search: title, artist, genres, key.
 * @returns The songs that pass the search and every active filter.
 */
export function filterSongs(
  songs: readonly Song[],
  songTags: SongTagsById,
  filters: FilterState,
  searchQuery: string,
): Song[] {
  const q = searchQuery.trim().toLowerCase();
  return songs.filter((song) => {
    if (q) {
      const hit =
        song.title.toLowerCase().includes(q) ||
        song.artist.toLowerCase().includes(q) ||
        song.mainGenre?.toLowerCase().includes(q) ||
        song.subgenres?.some((g) => g.toLowerCase().includes(q)) ||
        song.genres?.some((g) => g.toLowerCase().includes(q)) ||
        song.genre?.toLowerCase().includes(q) ||
        song.musical_key?.toLowerCase().includes(q);
      if (!hit) return false;
    }
    if (filters.title && !song.title.toLowerCase().includes(filters.title.toLowerCase())) return false;
    if (filters.artist && !song.artist.toLowerCase().includes(filters.artist.toLowerCase())) return false;
    if (filters.album && !song.album?.toLowerCase().includes(filters.album.toLowerCase())) return false;
    if (filters.rootFolder.length > 0 && !filters.rootFolder.includes(crateOf(song))) return false;
    if (filters.genre.length > 0) {
      const g = [song.mainGenre, ...(song.genres || []), song.genre].filter(Boolean) as string[];
      if (!g.some((x) => filters.genre.includes(x))) return false;
    }
    if (filters.subgenres.length > 0 && !(song.subgenres || []).some((g) => filters.subgenres.includes(g))) return false;
    if (filters.key.length > 0 && (!song.musical_key || !filters.key.includes(song.musical_key))) return false;
    if (filters.bpm.min !== undefined && (!song.bpm || song.bpm < filters.bpm.min)) return false;
    if (filters.bpm.max !== undefined && (!song.bpm || song.bpm > filters.bpm.max)) return false;
    if (filters.energy.min !== undefined && song.energy < filters.energy.min) return false;
    if (filters.energy.max !== undefined && song.energy > filters.energy.max) return false;
    if (filters.danceability.min !== undefined && song.danceability < filters.danceability.min) return false;
    if (filters.danceability.max !== undefined && song.danceability > filters.danceability.max) return false;
    if (filters.social.min !== undefined && song.social_acceptance < filters.social.min) return false;
    if (filters.social.max !== undefined && song.social_acceptance > filters.social.max) return false;
    if (filters.rank.min !== undefined && (song.rank ?? 0) < filters.rank.min) return false;
    if (filters.duration.min !== undefined && (!song.duration || song.duration < filters.duration.min)) return false;
    if (filters.duration.max !== undefined && (!song.duration || song.duration > filters.duration.max)) return false;
    if (filters.tags.length > 0) {
      const ids = songTags[song.id]?.map((t) => t.id) || [];
      if (!filters.tags.some((id) => ids.includes(id))) return false;
    }
    return true;
  });
}

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
