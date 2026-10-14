# Settings

Status: Active
Last Updated: 2026-10-08
Source: Requirements.md section 11

## Tags Management

- Add / rename / edit color (20-color palette) / delete with confirmation
- Deleting a tag removes it from all songs
- Each tag shows how many tracks use it; the delete confirmation repeats the
  number. Names are unique (case-insensitive), checked in the dialog

## Genres & Subgenres Management

- Add / rename / edit color / delete
- Collapsible per main genre (the row is a disclosure button); subgenres
  show as chips: the name renames, the × deletes after a confirmation
- Renaming or deleting does not touch tracks: they keep the old name until
  they are edited (the dialogs say so). Duplicate names are refused
- Edit and delete are always visible, never only on hover
- **No "Reset to Defaults" button** — user changes are permanent

## Root Folder

Lives on the Import page, not in Settings (see 10_LIBRARY_AND_FILE_LOADING):

- View current root folder path
- Change root folder (triggers re-scan)
- List of detected crates (subfolders) with track counts

## Backup & Export (built 2026-10-13, PF-83, issue #10)

- **Full JSON export**: entire library (songs, tags, song_tags, relationships,
  playlists, playlist_songs, blocks, sets) in a single versioned envelope
  `klangkurator-library-<date>.json`. The machine-local `_config` (root path)
  is excluded.
- **Merge import with a conflict popup**: matched tracks are found by
  file_path → artist+title+duration ±2 s → artist+title; empty local fields
  are filled silently, differing values are resolved one by one (overwrite
  yes/no per field, default local wins) with an apply-to-all checkbox. Local
  `file_path` is never rewritten; foreign song ids are never written — added
  tracks get fresh ids.
- **Set export**: export individual sets as markdown / text / JSON (still
  open — set-level export is not this feature)

## Preferences

- Default phase names for new sets (e.g. "Opening, Building, Sunset, Peak, Closing")
- Default target set duration
- Column layout persistence (order, visibility, widths) — saved to localStorage
- **Appearance** (built 2026-10-08): theme Ink (dark, default) / Paper (light) /
  System; covers in black and white (default) or original colour; on wide
  screens the player as a right-hand panel or a bottom bar. All stored in
  localStorage (`klangkurator.theme.v1`, `klangkurator.covers.v1`,
  `klangkurator.player.dock.v1`). No accent picker: orange carries meaning
  ("this one") and is not a preference.