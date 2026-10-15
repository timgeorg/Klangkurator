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
- [[NowPlaying.tsx]] — Player control component: displays the currently playing track with cover, waveform, play/pause with previous / next through the run, volume, auto-advance at track end, and toggles between dock positions (right panel on wide screens, bottom bar on narrow).
- [[SongLibrary.tsx]] — Main library view: the filterable, sortable table with dynamic columns; applies inline edits optimistically through a write queue and keeps rows in place while editing.
- [[SongRelationshipsDialog.tsx]] — Modal dialog for managing song relationships (add, edit, delete links to other songs by type); its graph tab is the track map's canvas (pre-selected song, partner list, Show its relationships with history, legend of the types on screen).
- [[SongTableHeader.tsx]] — Table header row component with sortable column headers and filter inputs.
- [[TrackTitle.tsx]] — A track title with its version or catalogue part set quieter, so two versions of one track never read the same in lists.
- [[SongTableRow.tsx]] — One table row: cover, waveform, play and edit actions, and the inline-editable cells for every user-owned value.
- [[ReanalyzeDialog.tsx]] — The popup that re-analyzes one track's BPM and key, with an optional BPM range hint (issue #6).
- [[libraryTable.ts]] — Shared types, filter config, and constants for the library table (FilterState, SortState, FilterValue, FILTER_CONFIG, etc.).
