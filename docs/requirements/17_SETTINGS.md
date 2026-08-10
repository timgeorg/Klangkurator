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
- Theme settings (dark only for now, future: accent color picker)