---
source: auto
tags:
  - index
---
# Index — src/components/map/rail

- [[MapRail.tsx]] — The rail beside the map: the status line at the top (how many tracks the map shows, the unlinked count, the unknown-`?focus` notice, the above-threshold stopgap notice, and phase 4a's "Pick at least one input" and "No track matches" reports), then the Similarity, Filters and selected-track sections. It collapses as a whole into a narrow strip, and every section collapses on its own.
- [[RailSection.tsx]] — One collapsible map-rail section: a named, Tab-reachable header that stays reachable while the body is closed, so a collapsed section is still navigable. Its open state comes from `useMapConfig`, so it persists (TM-R3, TM-R10).
- [[SimilaritySection.tsx]] — The similarity inputs (phase 4a): one row per input with a switch and a weight 0.5–3 in steps of 0.5, and Reset to defaults. A switch commits at once; a weight commits on release (TM-R1, TM-R4).
- [[FiltersSection.tsx]] — The same search and column filters as the library table, over the shared `LibraryFilterContext` and `ui/column-filter.tsx` (TM-R6, TM-R11), with the core-chip (phase 4b) and cluster-filter (phase 6) slots marked.
- [[SelectedTrackSection.tsx]] — The map rail's selected-track section: the full [[../TrackDetails.tsx]] (BPM, key, genre, ratings and tags; the nearest tracks with their percentages; the relationship partners; the transitions in and out; Play, Properties, Song page and Show its relationships) when a track is selected, and a one-line hint when none is.

Phase 5 adds the Layers section beside these; phase 6 fills Clusters. See `docs/plans/TRACK_MAP_PLAN.md` › Hook ordering (PM-8) and the phases table.
