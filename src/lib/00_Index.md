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
- [[PlayerContext.tsx]] — React context providing single-track player state (current track, play/pause, dock position) across the app.
- [[relationshipStyle.ts]] — Labels and line styles (colour, weight, dash) for the eight relationship types, shared by the graph, its legend and the lists.
- [[returnFocus.ts]] — Hook that returns focus to the element that opened a controlled dialog when it closes (or to the main content if that element is gone).
- [[songWriter.ts]] — Write queue for inline edits: one save request at a time, changes to a track merged while a save runs, idle() for reloads.
- [[storage.ts]] — Data model types (Song, Tag, Block, DJSet, SongPatch, BpmRange, ReanalyzeResult …) and the storage layer the components call: the backend API implementation plus a legacy localStorage one.
- [[trackFormat.ts]] — Track display and input rules shared across views: duration, BPM (format and parse), keys (names, the 24-key list), crate, shown genre.
- [[utils.ts]] — Tailwind class name merging utility combining clsx and twMerge.
