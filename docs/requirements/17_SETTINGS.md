# Settings

Status: Active
Last Updated: 2026-10-29
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

## Where settings live (built 2026-10-29, PF-89, issue #51)

Settings used to sit only in the browser's `localStorage`: they did not travel
with the library, vanished when site data was cleared, and the desktop window
could not keep them at all. They are files now.

- **`~/.klangkurator/settings.json`** holds the UI preferences, as a fourth data
  file beside `library.json`, `blocks.json` and `sets.json`. Not in
  `library.json`: that file is library content, and a column drag must not
  rewrite it.
- **`genres` inside `library.json`** holds the genre list
  (`[{name, color, subgenres}]`). Genres are library vocabulary like tags, and
  the backup covers the whole library, so they join the export.
- **`GET /api/settings`** returns the document, or `{}` when nothing was saved.
  **`PUT /api/settings`** shallow-merges a partial object. Only `columns`,
  `map`, `theme`, `covers`, `playerDock`, `volume` and `crateTabsExpanded` are
  accepted, each type-checked; an unknown key or a wrong type is 422 and
  nothing is written. A key written by a newer version is returned as it is, so
  an older app never destroys it.
- **`GET /api/genres` / `PUT /api/genres`** read and replace the genre list.
  A blank name, a duplicate (case-insensitive), a missing colour or malformed
  subgenres is 422.
- **Loading:** the app reads both once, before it renders; a skeleton shows
  until then. The existing synchronous genre getters keep their signatures.
- **Writes:** applied in memory at once and saved about 300 ms later. A failed
  save toasts and keeps the value for the next attempt.
- **Migration:** on the first start, the browser's old values (all seven keys,
  genres included) are copied into the files once. A value already in a file
  wins. After that the files are the truth; the theme keeps its browser copy
  only so the first paint does not flash.
- **An unreadable data file is kept.** `BaseStore` renames it to
  `<name>.corrupt-<timestamp>.json` and logs an error before starting empty, so
  no data file is ever overwritten by the empty state that follows a read error.
- **Settings travel by copying `~/.klangkurator/`.** The Backup & Export file
  stays library content; the machine-local music folder path stays in
  `library.json` `_config` and out of the export.
- **The desktop window keeps browser storage** (`private_mode=False` with a
  storage path under the data folder); nothing the app needs depends on it.

## Preferences

- **Appearance** (built 2026-10-08, moved into `settings.json` 2026-10-29): theme
  Ink (dark, default) / Paper (light) / System; covers in black and white
  (default) or original colour; on wide screens the player as a right-hand panel
  or a bottom bar. No accent picker: orange carries meaning ("this one") and is
  not a preference.
- Column layout (order, visibility, widths), the map's inputs and layers, the
  player's volume and dock, and the crate bar's collapse choice are all in
  `settings.json`.
- **Not built, and out of scope:** default phase names for new sets, and a
  default target set duration. A set carries its own `target_duration_min`.
  They belong in `settings.json` once they exist.