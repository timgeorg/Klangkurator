---
source: auto
tags:
  - index
---
# Index — src/components/dj

- [[ColumnSettingsDialog.tsx]] — Modal dialog to toggle column visibility, reorder columns, and reset to defaults in the library table.
- [[EditSongDialog.tsx]] — Edit track dialog: title, artist, album, year, BPM, key, genres, ratings and notes; Cancel discards, emptied fields clear; opens the lyrics and relationships dialogs.
- [[FolderBrowserDialog.tsx]] — In-app folder browser (browser mode) for choosing the music folder inside the home folder; the desktop app uses the system dialog instead.
- [[LyricsDialog.tsx]] — Dialog for writing a track's lyrics.
- [[NowPlaying.tsx]] — Player control component: displays the currently playing track with cover, waveform, playback controls, volume slider, and toggles between dock positions (right panel on wide screens, bottom bar on narrow).
- [[SongLibrary.tsx]] — Main library view component: renders the filterable, sortable table of songs with dynamic columns, manages filter state, and handles track selection.
- [[SongRelationshipGraph.tsx]] — Canvas graph of a song's relationships: cover nodes, one line style per relationship type, re-centres on click; follows the theme.
- [[SongRelationshipsDialog.tsx]] — Modal dialog for managing song relationships (add, edit, delete links to other songs by type).
- [[SongTableHeader.tsx]] — Table header row component with sortable column headers and filter inputs.
- [[SongTableRow.tsx]] — Individual table row component for a song entry; displays cover, waveform, metadata, and actions (edit, play, view detail).
- [[libraryTable.ts]] — Shared types, filter config, and constants for the library table (FilterState, SortState, FilterValue, FILTER_CONFIG, etc.).
