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
- [[storage.ts]] — Data model types (Song, Tag, Block, DJSet, SongPatch …) and the storage layer the components call: the backend API implementation plus a legacy localStorage one.
- [[trackFormat.ts]] — Display formatting functions for track metadata (duration, BPM, musical key, crate name) shared across views.
- [[utils.ts]] — Tailwind class name merging utility combining clsx and twMerge.
