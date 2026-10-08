# Settings

Status: Active
Last Updated: 2026-08-09
Source: Requirements.md section 11

## Tags Management

- Add / rename / edit color (20-color palette) / delete with confirmation
- Deleting a tag removes it from all songs

## Genres & Subgenres Management

- Add / rename / edit color / delete
- Collapsible per main genre
- **No "Reset to Defaults" button** — user changes are permanent

## Root Folder

- View current root folder path
- Change root folder (triggers re-scan)
- List of detected crates (subfolders) with track counts

## Backup & Export

- **Full JSON export**: entire library (songs, tags, song_tags, relationships,
  playlists, blocks, sets) in a single `.json` file
- **Full JSON import**: restore from backup file (replaces all data, with
  confirmation)
- **Set export**: export individual sets as markdown / text / JSON

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