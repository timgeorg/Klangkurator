// Track map (issue #8) — the map rail's Filters section (plan phase 4a): the
// same search and the same column filters as the library table, over the same
// shared state, so a search or a filter set here shows in the table and
// clearing it in either place clears it for both (TM-R11). The controls are the
// table's own `ui/column-filter.tsx` over the table's `FILTER_CONFIG`, so both
// views offer exactly the same set.
//
// Phase 4b adds the core chip above the filters: the core is the track the map
// is anchored on (`?core=<id>`, or Show its relationships on the map), and it
// narrows the shown set to that track and its relationship partners, alongside
// these filters. Removing the chip drops the core and `core` from the URL
// (TM-H1, TM-H2). The cluster-filter chips arrive in phase 6 (TM-C3); that slot
// is marked below and deliberately renders nothing yet.
import { Search, X } from "lucide-react";

import { FILTER_CONFIG, type FilterOptions, isFilterActive } from "@/components/dj/libraryTable";
import { Button } from "@/components/ui/button";
import { ColorChip } from "@/components/ui/color-chip";
import { ColumnFilter } from "@/components/ui/column-filter";
import { Input } from "@/components/ui/input";
import { COLUMN_DEFINITIONS } from "@/hooks/useColumnConfig";
import { useLibraryFilters } from "@/lib/LibraryFilterContext";
import type { Song } from "@/lib/storage";
import { cn } from "@/lib/utils";

interface FiltersSectionProps {
  /** The filter options from the loaded library, in the table's own shape. */
  options: FilterOptions;
  /** The core track, or null when the map carries no core. */
  coreSong: Song | null;
  /** Removing the core chip drops the core (TM-H2). */
  onRemoveCore(): void;
}

/** The filter keys in `FILTER_CONFIG`'s own order, which is the table's. */
const FILTER_KEYS = Object.keys(FILTER_CONFIG) as (keyof typeof FILTER_CONFIG)[];

/**
 * The library's search and filters, shared with the table. Each filter is the
 * table's own column filter: a named, Tab-reachable button that shows the
 * filter's state and opens its popover. When anything is active, Clear filters
 * resets the filters (and nothing else) for both views. Above them sits the
 * core chip, when the map carries a core, which narrows the map to that track
 * and its relationship partners and can be removed to show the whole library.
 */
export function FiltersSection({ options, coreSong, onRemoveCore }: FiltersSectionProps) {
  const { searchQuery, setSearchQuery, filters, updateFilter, activeFilterKeys, clearFilters } = useLibraryFilters();
  const activeCount = activeFilterKeys.length;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search the library"
          placeholder="Search title, artist, genre, key"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="h-9 rounded-chip pl-9 pr-9"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* The core chip (TM-H1, TM-H2): the track the map is anchored on, which
          narrows the shown set to it and its relationship partners. Removing it
          drops the core, and the canvas counts the whole library again. */}
      {coreSong && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Core</span>
          <ColorChip
            size="md"
            label={coreSong.title}
            title={`The core: ${coreSong.title} — ${coreSong.artist}. Remove it to show the whole library.`}
            onRemove={onRemoveCore}
            className="min-w-0 shrink"
          />
        </div>
      )}

      {/* Phase 6: the chosen cluster filters go here, one removable chip per
          `ClusterFilter`, removing it bringing the clusters back (TM-C3). */}

      <ul className="space-y-1">
        {FILTER_KEYS.map((key) => {
          const config = FILTER_CONFIG[key];
          const label = COLUMN_DEFINITIONS[key]?.label ?? String(key);
          const active = isFilterActive(config.type, filters[key]);
          return (
            <li key={key} className="flex items-center justify-between gap-2">
              <span className={cn("text-[13px]", active && "font-medium")}>{label}</span>
              <ColumnFilter
                title={label}
                type={config.type}
                value={filters[key]}
                onChange={(value) => updateFilter(key, value)}
                options={config.optionsKey ? options[config.optionsKey] : undefined}
                placeholder={config.placeholder}
                min={config.min}
                max={config.max}
                triggerClassName={cn(
                  "h-7 w-7 rounded-chip border border-border",
                  !active && "opacity-60 hover:opacity-100",
                )}
              />
            </li>
          );
        })}
      </ul>

      {(activeCount > 0 || searchQuery.trim() !== "") && (
        <div className="flex items-center justify-between gap-2">
          <span className="k-num text-xs text-muted-foreground">
            {activeCount} {activeCount === 1 ? "filter" : "filters"}
          </span>
          <Button variant="link" size="sm" onClick={clearFilters} className="h-6 text-xs">
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
