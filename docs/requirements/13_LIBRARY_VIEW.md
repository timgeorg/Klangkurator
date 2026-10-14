# Library View

Status: Active
Last Updated: 2026-10-14
Source: Requirements.md sections 4, 8; editorial redesign (issue #1); inline editing (issue #3)

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
| Artist | text | Edited in place |
| Genre | chip | Hairline chip with the genre's colour as a dot; a click opens the genre list |
| BPM | number | Mono, one decimal at most; edited in place |
| Key | text | Mono; minor keys in the info colour, full name as tooltip; a click opens the key list |
| Waveform | waveform | Static SVG |
| Time | duration | m:ss (minutes unpadded) |
| Subgenres | text | Up to three, "+N" beyond; a click opens the subgenre checklist |
| Energy | rating (0–5) | Five rising bars; decimals floor on display (3.8 → 3 bars), tooltip keeps the exact value; a click on a bar sets the rating |
| Dance | rating (0–5) | Five rising bars; decimals floor on display; a click on a bar sets the rating |
| Social | rating (0–5) | Five rising bars; decimals floor on display; a click on a bar sets the rating |
| Rank | rank (1–5) | Five stars; a click on a star sets the rank |
| Album | text | Edited in place |
| Crate | text | The track's crate (backend `root_folder`), full path as tooltip |
| Tags | chips | Side-by-side, auto-grow, inline add/remove; whole chips only, the rest as a "+N" count (names in its tooltip and for screen readers) |
| Lyrics | preview | First 50 characters, 200 in the tooltip; a click opens the lyrics editor |
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
- **Right edge**: while columns lie beyond the visible area, a cut column showing less than 120px is covered (a wider one fades), so the table ends on a whole column, and a "more columns" button scrolls right. The button only shows where it has room of its own (on the covered strip, over a wide faded column, or in an empty gap of at least 28px after the last whole column), never on a column's header; elsewhere the table's scrollbar is the hint. It is a mouse convenience outside the tab order; each press snaps so a column starts on the covered strip, which keeps the button available until the table's end. Keyboard focus inside the table scrolls the table itself, clear of the edge and below the sticky header (also when walking backwards with Shift+Tab); mouse clicks never scroll the control away from the pointer. On touch screens (coarse pointer) the button is left out (it would be a target under 44px) and the edge always fades, the usual "swipe for more" hint
- Layout (order, visibility, widths) persists in localStorage
  (`klangkurator.columnConfig.v1`)

## Sorting

- Clicking a sortable header (Title, Artist, Album, Crate, BPM, Key, Energy,
  Dance, Social, Rank, Time) cycles ascending → descending → off; the header shows
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
| Rank | Range (`≥ N`, 1–5; empty means any, unranked tracks show) |
| Genre, Subgenres, Key, Tags, Crate | Multi-select |

- When search and filters exclude every track, the header stays in place and
  a "No track matches" state offers **Clear search and filters**

Planned, not built — additional filters for set planning:
- **Phase Tags** — multi-select (`opening`, `building`, `sunset`, `peak`, `closing`)
- **Vibe Tags** — multi-select (`dark`, `uplifting`, `tearjerker`, `banger`, etc.)

## Inline Interaction

Every value the user owns edits where it stands, without a dialog (NFR-11);
the Edit dialog stays for changing everything at once. Behavior contract:
`docs/plans/INLINE_EDIT_BEHAVIOR_CONTRACT.md`.

- **Affordance**: hover lays a quiet fill behind an editable value, keyboard
  focus shows the ring. Each value's accessible name gives the field, the
  track and the value ("Genre for Feng Shui: Techno")
- **Saving**: every change saves at once. A failed save shows a notification,
  then the table reloads from the backend, so it never goes on showing a
  change that wasn't saved
- **Stable rows**: an edit never moves its row. The order on screen freezes at
  the first edit, so a track that no longer fits the sort, the search or a
  filter keeps its place until one of them changes
- **Text (Artist, Album, BPM, Notes)**: click → a field in place → Enter or
  blur saves, Escape restores the old value; after Enter or Escape focus is
  back on the cell. Values are trimmed, an emptied album, BPM or note is
  cleared, an unchanged value is not written, and an artist can't be emptied.
  BPM takes "127.5" or "127,5", from 40 to 250, one decimal at most. Enter on
  an invalid value keeps the field open with the reason beside it; leaving
  the field restores the old value and a notification says why
- **Notes**: as above, on the mixing note only, never the hint; Shift+Enter
  starts a new line
- **Genre, Key**: click → a list with a search field and the current value
  checked; a choice saves and closes it, "No genre" / "No key" clears it.
  Keys are in the analyser's notation with the full name ("Am · A minor"); a
  value from the file's tags that isn't in the list is offered on top.
  Changing the genre keeps the subgenres (the Subgenres column may be off
  screen; the edit dialog, a form you can cancel, clears them)
- **Subgenres**: click → a checklist with the track's subgenres first, then
  the genre's others; each choice saves at once and the list keeps its order
  until Escape or a click outside. "Create “…”" adds a new name to the track
  and to the genre's list (for a file-tag genre that Settings doesn't list:
  "Add “…” to this track"). Without a genre the list asks for one first. A
  genre read only from the file's tags becomes the main genre when subgenres
  are set (shown the same)
- **Ratings (Energy, Dance, Social) and Rank**: mouse: hovering previews, a
  click on a bar (a star for Rank) sets that whole value, a click on the
  current one clears it. Keyboard: a slider (arrows ±1 keeping a decimal set
  in the dialog, Home or 0 clears, End sets 5, 1–5 directly; Enter or Space
  opens the picker). Touch: a tap opens a picker of 44px targets (Unrated or
  Unranked, 1–5). Decimals (issue #7) still show as their whole bars; the
  exact value is in the tooltip and read to screen readers
- **Lyrics**: click → the lyrics editor
- **Read-only**: Cover, Waveform, Time and Crate come from the file
- Clicking a song title → opens the song detail page (`/song/:id`, PF-17)
- Play (or Pause on the current track) and Edit → in the # column, on row
  hover or keyboard focus
- Play starts a run of the rows as shown (search, filters, sort): the
  player's next and previous play the row below and above, and the row below
  starts when a track ends; no wraparound. The run is fixed when Play is
  pressed, so a new sort or filter applies from the next Play (PF-80)
- Tags: remove with the chip's ×, add with the + button (shows on hover and
  focus). The picker lists existing matches first and "Create “…”" last, so
  Enter picks a similar existing tag; with no match, Enter creates the tag.
  Removing a chip by keyboard moves focus to the next chip (or the + button);
  saving or discarding a note keeps focus on its cell
