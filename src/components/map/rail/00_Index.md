---
source: auto
tags:
  - index
---
# Index — src/components/map/rail

- [[MapRail.tsx]] — The rail beside the map (phase 3): the status line at the top (how many tracks the map shows, the unlinked count, the unknown-`?focus` notice, the above-threshold stopgap notice) and the sections below it. The rail itself collapses in phase 4a.
- [[RailSection.tsx]] — One collapsible map-rail section (plan phase 3, the scaffolding). Its header is a named, Tab-reachable button that stays reachable while the body is closed, so a collapsed section is still navigable; its chevron turns with the open state.
- [[SelectedTrackSection.tsx]] — The map rail's selected-track section: the full [[../TrackDetails.tsx]] (BPM, key, genre, ratings and tags; the nearest tracks with their percentages; the relationship partners; the transitions in and out; Play, Properties, Song page and Show its relationships) when a track is selected, and a one-line hint when none is.

Phase 4a adds the Similarity, Filters, Layers and Clusters sections beside these; phase 6 fills Clusters. See `docs/plans/TRACK_MAP_PLAN.md` › Hook ordering (PM-8) and the phases table.
