// Track map (issue #8) — the library's search and filters, shared for the
// session by the table and the map (plan phase 4a, TM-R11). The provider sits
// above the routes, so the values survive navigating between the table and the
// map and the browser's Back, and clearing them in either place clears them for
// both. Session-only, like the table's own state: nothing is stored
// (REQ-33-PS); the map's inputs, layers and collapse states are what persists.
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

import {
  FILTER_CONFIG,
  INITIAL_FILTERS,
  isFilterActive,
  type FilterState,
  type FilterValue,
} from "@/components/dj/libraryTable";

/** The one search and one set of filters the table and the map share. */
export interface LibraryFilterValue {
  /** The header search: title, artist, genres, key. */
  searchQuery: string;
  setSearchQuery(query: string): void;
  /** The column filters, the same shape the library table's header edits. */
  filters: FilterState;
  /** Sets one column filter; a null or undefined value resets that one key. */
  updateFilter(key: keyof FilterState, value: FilterValue): void;
  /** The filters with something in them, in `FILTER_CONFIG` order. */
  activeFilterKeys: (keyof FilterState)[];
  /** Whether the search or any filter is narrowing the library. */
  isFiltering: boolean;
  /** Clears the search and every filter. */
  clearAll(): void;
  /** Clears the filters, leaving the search alone. */
  clearFilters(): void;
}

const LibraryFilterContext = createContext<LibraryFilterValue | null>(null);

/**
 * Holds the session's one search and one set of filters. Mounted above the
 * routes, so the table, the map and the browser's Back all read and write the
 * same state (TM-R11).
 */
export function LibraryFilterProvider({ children }: { children: React.ReactNode }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);

  const updateFilter = useCallback((key: keyof FilterState, value: FilterValue) => {
    setFilters((prev) => ({ ...prev, [key]: value ?? INITIAL_FILTERS[key] }));
  }, []);

  const activeFilterKeys = useMemo(
    () =>
      (Object.keys(FILTER_CONFIG) as (keyof FilterState)[]).filter((key) =>
        isFilterActive(FILTER_CONFIG[key].type, filters[key]),
      ),
    [filters],
  );

  const clearFilters = useCallback(() => setFilters(INITIAL_FILTERS), []);
  const clearAll = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    setSearchQuery("");
  }, []);

  const value = useMemo<LibraryFilterValue>(
    () => ({
      searchQuery,
      setSearchQuery,
      filters,
      updateFilter,
      activeFilterKeys,
      isFiltering: activeFilterKeys.length > 0 || searchQuery.trim() !== "",
      clearAll,
      clearFilters,
    }),
    [activeFilterKeys, clearAll, clearFilters, filters, searchQuery, updateFilter],
  );

  return <LibraryFilterContext.Provider value={value}>{children}</LibraryFilterContext.Provider>;
}

/**
 * The shared search and filters. Throws without a provider, as `usePlayer`
 * does, so a view that forgot one fails loudly instead of filtering nothing.
 */
// eslint-disable-next-line react-refresh/only-export-components -- the provider and its hook belong together
export function useLibraryFilters(): LibraryFilterValue {
  const context = useContext(LibraryFilterContext);
  if (!context) {
    throw new Error("useLibraryFilters must be used within a LibraryFilterProvider");
  }
  return context;
}
