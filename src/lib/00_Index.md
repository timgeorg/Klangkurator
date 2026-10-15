---
source: auto
tags:
  - index
---
# Index — src/lib

- [[api.ts]] — Generic HTTP client wrapper for the FastAPI backend with typed requests and error handling utilities.
- [[appearance.ts]] — Manages cover art display preference (editorial/original) with React hook and localStorage persistence.
- [[genreData.ts]] — Genre hierarchy configuration with main genres, subgenres, and their assigned colors.
- [[palette.ts]] — Color palette for user-facing entities (tags, genres, blocks, sets) with a stable deterministic color-picker.
- [[mapRoute.ts]] — The `/map` route test (`isMapRoute`) the app shell reads: the player sits at the bottom and hides its dock buttons there without touching the saved dock preference (TM-M8), and the sidebar's Library item stays active (TM-M1).
- [[PlayerContext.tsx]] — React context providing the player state across the app: the run Play was pressed in and the position in it (next / previous), play/pause, dock position.
- [[relationshipStyle.ts]] — Labels and line styles (colour, weight, dash) for the eight relationship types, shared by the graph, its legend and the lists.
- [[returnFocus.ts]] — Hook that returns focus to the element that opened a controlled dialog when it closes (or to the main content if that element is gone).
- [[songWriter.ts]] — Write queue for inline edits: one save request at a time, changes to a track merged while a save runs, idle() for reloads.
- [[storage.ts]] — Data model types (Song, Tag, Block, DJSet, SongPatch, BpmRange, ReanalyzeResult …) and the storage layer the components call: the backend API implementation plus a legacy localStorage one.
- [[trackFormat.ts]] — Track display and input rules shared across views: duration, BPM (format and parse), keys (names, the 24-key list), crate, shown genre.
- [[utils.ts]] — Tailwind class name merging utility combining clsx and twMerge.
