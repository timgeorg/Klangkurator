---
source: auto
tags:
  - index
---
# Index — src/components/dj

- [[ColumnSettingsDialog.tsx]] — Modal dialog to toggle column visibility, reorder columns, and reset to defaults in the library table.
- [[EditSongDialog.tsx]] — Edit track dialog: title, artist, album, year, BPM, key, genres, ratings and notes; Cancel discards, emptied fields clear; opens the lyrics and relationships dialogs.
- [[InlineCells.tsx]] — The table's editable cells (text in place, genre and key pickers, subgenre checklist, rating bars, lyrics), each saving through one patch callback.
- [[FolderBrowserDialog.tsx]] — In-app folder browser (browser mode) for choosing the music folder inside the home folder; the desktop app uses the system dialog instead.
- [[LyricsDialog.tsx]] — Dialog for writing a track's lyrics.
- [[NowPlaying.tsx]] — Player control component: displays the currently playing track with cover, waveform, play/pause with previous / next through the run, volume, auto-advance at track end, and toggles between dock positions (right panel on wide screens, bottom bar on narrow). On the map route it is always the bottom bar with its dock buttons hidden, derived from the route and not from the saved dock preference (TM-M8).
- [[SongLibrary.tsx]] — Main library view: the filterable, sortable table with dynamic columns; applies inline edits optimistically through a write queue and keeps rows in place while editing. Since phase 4a its search and filters live in the shared `LibraryFilterContext`, so they carry to the track map and back (TM-R11), and it filters with `filterSongs`; it renders the first 50 matching rows and adds 50 while scrolling, so a new list opens at once (REQ-13-LR, issue #63); since phase 7 its header carries the Table | Map switch (`LibraryViewSwitch`), hidden below 768 px (TM-E1, TM-E4).
- [[SongRelationshipsDialog.tsx]] — Modal dialog for managing song relationships (add, edit, delete links to other songs by type); its graph tab is the track map's canvas, lazy-loaded (phase 7), with the pre-selected song, the partner list, Show its relationships with history, the legend of the types on screen and **Open in map** (`/map?core=<id>`, TM-E3).
- [[RelationshipGraphTab.tsx]] — The dialog's graph tab in its own lazy-loaded module (phase 7): the song at the origin with its partners on a seeded ring over the shared `TrackMapCanvas`, the legend of the relationship types on screen, and the compact `TrackDetails`. Loaded on demand, so the renderer stays out of the library's first paint.
- [[SongTableHeader.tsx]] — Table header row component with sortable column headers and filter inputs.
- [[TrackTitle.tsx]] — A track title with its version or catalogue part set quieter, so two versions of one track never read the same in lists.
- [[SongTableRow.tsx]] — One table row: cover, waveform, play and edit actions, and the inline-editable cells for every user-owned value.
- [[ReanalyzeDialog.tsx]] — The popup that re-analyzes one track's BPM and key, with an optional BPM range hint (issue #6).
- [[JobProgressToast.tsx]] — The scan/analysis progress toast on every page but Import (issue #46): one controlled Radix toast with the bar, `done / total`, the current file and crate (or track title), Abort for an analysis, and a close that holds for that run.
- [[libraryTable.ts]] — Shared types, filter config and constants for the library table (FilterState, SortState, FilterValue, FILTER_CONFIG, `INITIAL_FILTERS`) plus `filterSongs`, the search-and-filter predicate the table and the track map share (phase 4a), and the crate tabs' pure helpers `toggleCrate`, `clickCrate` and `visibleCrates` (issue #49: Shift+click multi-select, collapse past ten).
- [[libraryTable.test.ts]] — Vitest coverage of the crate tabs' helpers (issue #49): Shift+click adding, removing and emptying the selection, a plain click narrowing it to one crate, and the shown/hidden split at 10, 11 and 27 crates with selected crates that must never be hidden.
