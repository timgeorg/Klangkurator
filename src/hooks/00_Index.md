---
source: auto
tags:
  - index
---
# Index — src/hooks

- [[use-media-query.ts]] — Custom React hook to detect CSS media queries (e.g., screen width) reactively; exports `useMediaQuery()` and the `WIDE_QUERY` constant for layout breakpoints.
- [[use-mobile.tsx]] — Mobile breakpoint hook from the shadcn template, used by the sidebar primitive to turn the rail into a sheet below 768px.
- [[use-toast.ts]] — Hook for triggering toast notifications in the app, imported by components that need user feedback.
- [[useColumnConfig.ts]] — Manages the library table's column configuration, including definitions, visibility, sizing, and persistence; exports `COLUMN_DEFINITIONS` and the config state hook.
- [[useMapConfig.ts]] — The track map's saved settings (phase 4a) under `klangkurator.map.v1`: the similarity inputs and weights, the `layers` slice the rail's Layers section switches (phase 5: relationships, transitions and nearest; a switch writes back through `setLayer`, so it round-trips — TM-L7), and the rail's and each section's collapse states, all validated on read so a stored value that does not fit falls back to the default (REQ-33-PS).
- [[useRevealedRows.ts]] — How many library rows to render (issue #63): one page of 50, growing by 50 while the sentinel after the last row stays in view, reset when the list changes and kept across inline edits.
