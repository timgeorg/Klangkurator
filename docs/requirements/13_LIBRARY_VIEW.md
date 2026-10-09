# Library View

Status: Active
Last Updated: 2026-10-08
Source: Requirements.md sections 4, 8; editorial redesign (issue #1)

## Overview

The library is the central hub. The rail holds **Library**, **Sets**,
**Import** and **Settings**; the five links to unbuilt pages (Playlists, Add
Song, Bulk Import, Export Data, Import Data) were removed on 2026-10-08 and
come back only with their features. Search/Tags/Relationships pages were
removed earlier — the table handles all of it.

## Empty-Library Redirect

- Opening the Library view with **zero songs** auto-redirects to the Import
  page (`/load-files`) — an empty table is a dead end, so the app routes the
  user to where loading actually happens
- Import shows the already-configured root folder (if any) and the
  picker/scan actions; no redirect once the library has ≥ 1 song
- While the first load runs, skeleton rows stand in for the table; if the
  backend is unreachable, an error state with "Try again" replaces it

## Header

- Title "Library" with the track count in mono ("92 tracks"; "12 of 92
  tracks" while a search or filter is active)
- Search field (title, artist, genres, key), **Columns** (column settings),
  **Import** (goes to the Import page — the only import surface)
- **Crate tabs**: "All tracks" plus one tab per crate with its count; a tab
  sets the Crate filter to that crate
- **Active-filter chips**: one chip per active column filter, each removable,
  plus "Clear all"

## Table Layout

- Flat, **dense, multi-column table** in the editorial design system (see
  `02_SYSTEM_CONTEXT.md`): 44px rows, hairlines between rows, black-and-white
  covers, numbers in mono and right-aligned
- Each track is a single flat row, all metadata in adjacent columns
- Static SVG waveform per row (one path, scales with the column, not animated)
- The **current track** (loaded in the player, playing or paused) carries the
  orange cut on its cover, an orange index and title, an orange waveform and
  a tinted row

## Columns

| Column | Type | Notes |
|---|---|---|
| # | index + actions | Mono row number; Play/Pause and Edit replace it on row hover **and keyboard focus** |
| Cover | image | 32px, black and white (Settings: original colour) |
| Title | text (link) | Opens the song detail page; a trailing version or catalogue number in brackets is set quieter |
| Artist | text | |
| Genre | chip | Hairline chip with the genre's colour as a dot |
| BPM | number | Mono, one decimal at most |
| Key | text | Mono; minor keys in the info colour, full name as tooltip |
| Waveform | waveform | Static SVG |
| Time | duration | m:ss (minutes unpadded) |
| Subgenres | text | Up to three, "+N" beyond |
| Energy | rating (0–5) | Five rising bars |
| Dance | rating (0–5) | Five rising bars |
| Social | rating (0–5) | Five rising bars |
| Album | text | |
| Crate | text | The track's crate (backend `root_folder`), full path as tooltip |
| Tags | chips | Side-by-side, auto-grow, inline add/remove; whole chips only, the rest as a "+N" count (names in its tooltip and for screen readers) |
| Lyrics | preview | First 50 characters, 200 in the tooltip |
| Notes | text | The mixing note; flex-fills remaining width, inline-editable. While it is empty, a drum or element note shows as a muted italic hint ("Drums: …") |

Default order as listed (title, artist, genre, BPM and key lead, as on the
moodboard). Column ids are unchanged from PF-15, so saved layouts stay valid
and keep their own order.

## Column Controls

- **Resize**: drag the right edge of a header (not on Notes while it is the last column and fills the remaining width)
- **Show/Hide**: switches in the Column Settings dialog
- **Reorder**: drag-and-drop in the header (insert before/after) or in the
  Column Settings dialog
- **Auto-grow**: the Tags column widens with the widest tag list, until the user resizes it by hand (that choice is saved with the layout)
- **Right edge**: while columns lie beyond the visible area, a cut column showing less than 120px is covered (a wider one fades), so the table ends on a whole column, and a "more columns" button scrolls right. The button is a mouse convenience outside the tab order: keyboard focus inside the table scrolls the table itself, clear of the edge and below the sticky header (also when walking backwards with Shift+Tab). On touch screens (coarse pointer) the button is left out (it would be a target under 44px) and the edge always fades, the usual "swipe for more" hint
- Layout (order, visibility, widths) persists in localStorage
  (`klangkurator.columnConfig.v1`)

## Sorting

- Clicking a sortable header (Title, Artist, Album, Crate, BPM, Key, Energy,
  Dance, Social, Time) cycles ascending → descending → off; the header shows
  the direction and carries `aria-sort`
- Missing values sort last in both directions; text sorts naturally
  ("Track 2" before "Track 10")
- Session-only, like search and filters

## Filtering

Per-column filter popovers (the filter button shows on header hover, on
focus, and permanently while the filter is active):

| Column | Filter Type |
|---|---|
| Title, Artist, Album | Text search |
| BPM, Energy, Dance, Social, Time | Range (empty defaults — no auto-applied 0–200) |
| Genre, Subgenres, Key, Tags, Crate | Multi-select |

- When search and filters exclude every track, the header stays in place and
  a "No track matches" state offers **Clear search and filters**

Planned, not built — additional filters for set planning:
- **Phase Tags** — multi-select (`opening`, `building`, `sunset`, `peak`, `closing`)
- **Vibe Tags** — multi-select (`dark`, `uplifting`, `tearjerker`, `banger`, etc.)

## Inline Interaction

- Notes field: click → edit the mixing note → Enter/blur to save, Escape
  discards (no dialog). The editor opens on the mixing note only, never the
  hint; the note is trimmed, an emptied note is cleared, an unchanged note is
  not written
- Clicking a song title → opens the song detail page (`/song/:id`, PF-17)
- Play (or Pause on the current track) and Edit → in the # column, on row
  hover or keyboard focus
- Tags: remove with the chip's ×, add with the + button (shows on hover and
  focus). The picker lists existing matches first and "Create “…”" last, so
  Enter picks a similar existing tag; with no match, Enter creates the tag.
  Removing a chip by keyboard moves focus to the next chip (or the + button);
  saving or discarding a note keeps focus on its cell
