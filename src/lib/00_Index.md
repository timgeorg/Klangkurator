---
source: auto
tags:
  - index
---
# Index — src/lib

- [[api.ts]] — Generic HTTP client wrapper for the FastAPI backend with typed requests and error handling utilities.
- [[appearance.ts]] — Manages the cover art display preference (editorial/original) through `settings.json`, with a React hook.
- [[genreData.ts]] — Genre hierarchy configuration with main genres, subgenres, and their assigned colors.
- [[LibraryFilterContext.tsx]] — The library's search and one set of column filters, shared for the session by the library table and the track map (phase 4a). Provided above the routes so they survive navigating between the two and the browser's Back; clearing in either place clears for both (TM-R11).
- [[BackgroundJobsContext.tsx]] — The scan and the BPM/key analysis as one app-wide pair of background jobs (issue #46): both statuses, `startScan`, `startAnalysis`, `abortAnalysis`, a per-run "toast closed" flag, one resume read on mount, 500 ms polling while a job runs, `klangkurator:library-changed` when one ends, and the end notice ("Scan finished" without numbers; "Analysis complete"/"Analysis stopped" with them).
- [[palette.ts]] — Color palette for user-facing entities (tags, genres, blocks, sets) with a stable deterministic color-picker.
- [[mapRoute.ts]] — The `/map` route test (`isMapRoute`) the app shell reads: the player sits at the bottom and hides its dock buttons there without touching the saved dock preference (TM-M8), and the sidebar's Library item stays active (TM-M1).
- [[PlayerContext.tsx]] — React context providing the player state across the app: the run Play was pressed in and the position in it (next / previous), play/pause, dock position.
- [[relationshipStyle.ts]] — Labels and line styles (colour, weight, dash) for the eight relationship types, shared by the graph, its legend and the lists.
- [[returnFocus.ts]] — Hook that returns focus to the element that opened a controlled dialog when it closes (or to the main content if that element is gone).
- [[songWriter.ts]] — Write queue for inline edits: one save request at a time, changes to a track merged while a save runs, idle() for reloads.
- [[audioVariants.ts]] — The display rules behind audio variants (issue #65), pure so they test without a DOM: the primary-first file list, the badge count, which file playback will use when the primary is gone, size and fact formatting, and the octave-apart test.
- [[audioVariants.test.ts]] — Tests for those rules, including the measured 132.0 / 66.3 pair.
- [[storage.ts]] — Data model types (Song, Tag, Block, DJSet, SongPatch, BpmRange, ReanalyzeResult …) and the storage layer the components call: the backend API implementation, including `AudioVariant` and the attach / make-primary / detach calls (issue #65).
- [[trackFormat.ts]] — Track display and input rules shared across views: duration, BPM (format and parse), keys (names, the 24-key list), crate, shown genre.
- [[utils.ts]] — Tailwind class name merging utility combining clsx and twMerge.
- [[jobProgress.ts]] — The pure rules of the background jobs (Import-page match, how a run ended, the failed-read limit), apart from the provider so they are testable without a DOM.
- [[jobProgress.test.ts]] — Tests for those rules: the trailing-slash Import page and the finished / failed / vanished run ends (issue #57).
- [[settings.ts]] — the preferences and genre documents as files (issue #51): one load before the first paint, synchronous getters, a 300 ms debounced save per document. Nothing is read from or written to `localStorage`.
- [[settings.test.ts]] — tests for that module: both documents are the only store (nothing reaches the browser), unchanged values are not re-sent, a burst debounces to one request, a genre write and a preference write both land, and loading survives denied browser storage.
- [[theme.tsx]] — the theme provider that replaced `next-themes`: the choice lives in `settings.json` alone, so a copied data folder reproduces the theme; "system" follows the computer.
- [[setItems.ts]] — Reading a set's items against the library (issue #64): the referenced id across the stored shapes, whether a set already holds a song in its items or its phases, and the normalised, renumbered `items` a save should send.
- [[crates.ts]] — the crate and music-location registry (issue #11): crates as `{id, name, location_path}` entries loaded before the first row renders, a name resolved from an id at display time, and the ids a location holds.
- [[crates.test.ts]] — tests for that module: two crates with one name stay apart, an unknown id still shows something honest, a location's crates come from its path, and an unmounted location reports itself.
