---
source: session
tags:
  - plan
  - contract
  - redesign
status: active
created: 2026-10-08
---
# Behavior contract — editorial redesign (issue #1)

Observable behavior the redesigned app must show, written before verification
so a source-blind validator can judge the running app. Each clause is
Given / When / Then. "Current track" = the track loaded in the player.

Run against a sandbox copy of the library, never the user's real data.

## Shell

- **SH-1** Given any page at ≥ 768px, then a rail shows the Klangkurator mark and the links Library, Sets, Import, Settings, and no other destinations.
- **SH-2** Given the rail, when the user is on `/`, `/song/:id`, `/sets`, `/load-files` or `/settings`, then exactly the matching link is marked active (distinct style and `aria-current="page"`).
- **SH-3** Given ≥ 768px, when the rail's collapse button is pressed or Ctrl/Cmd+B is pressed, then the rail toggles between labels and icons only.
- **SH-4** Given < 768px, then a top bar shows a menu button and the wordmark; when the menu is pressed, the rail opens as a sheet, and choosing a destination navigates and closes it.
- **SH-5** Given the rail's theme button, when pressed, then the app switches between the dark (ink) and light (paper) theme, and the choice survives a reload with no flash of the other theme.
- **SH-6** Given an unknown path, then a not-found page says the page isn't in the library and offers "Back to Library", which navigates without a full page reload.
- **SH-7** Given keyboard use, when Tab is pressed on page load, then a "Skip to content" link appears first.

## Player

- **PL-1** Given no current track, then no player is visible.
- **PL-2** Given the library, when a track's Play is pressed, then the track plays and a player appears: a right-hand panel at ≥ 1280px (cover, title, artist, waveform, times, play/pause, volume, BPM, key), a bottom bar below 1280px.
- **PL-3** Given the player, when the waveform is clicked or dragged, or focused and the arrow keys are used, then playback seeks.
- **PL-4** Given the player, when the volume is changed, then the level persists across reloads and is applied before the next track starts.
- **PL-5** Given the panel at ≥ 1280px, when "Dock to the bottom" is pressed, then the player becomes a bottom bar; when "Show the panel" is pressed in the bar, then it returns to the panel. The choice persists.
- **PL-6** Given a playing track, when the window is resized across 1280px, then playback continues without interruption.
- **PL-7** Given the player, when Stop is pressed or the track ends, then the player disappears.
- **PL-8** Given a file that cannot be played, then a toast says playback failed and the player stops.

## Library

- **LB-1** Given an empty library, when `/` opens, then the app goes to the Import page.
- **LB-2** Given a library, then the header shows "Library" and the track count; while searching or filtering it shows "N of M tracks".
- **LB-3** Given a library, then covers are black and white by default, and the current track's row shows an orange cut on its cover, an orange index and title, and an orange waveform.
- **LB-4** Given a row, when it is hovered or receives keyboard focus, then Play and Edit buttons appear in the # column; Play on the current playing track pauses it.
- **LB-5** Given a row, when the title is activated, then the song detail page opens.
- **LB-6** Given the search field, when text is typed, then only tracks whose title, artist, genre, subgenre or key contain it remain.
- **LB-7** Given crate tabs, when a crate tab is pressed, then only that crate's tracks remain and the tab is marked active; "All tracks" clears it.
- **LB-8** Given a column filter, when values are applied, then rows filter accordingly, the filter button stays visible and highlighted, and a removable chip names the filter; "Clear all" clears every filter and the search.
- **LB-9** Given filters that match nothing, then the header stays, and a "No track matches" state offers to clear search and filters.
- **LB-10** Given a sortable header, when clicked repeatedly, then the rows sort ascending, then descending, then return to the original order; missing values stay last.
- **LB-11** Given a header, when it is dragged onto another header, then the column moves there; when the edge is dragged, then the column resizes; both persist across reloads. "Columns" opens a dialog to hide, show and reorder, with "Reset to default".
- **LB-12** Given a Notes cell, when clicked, typed into and Enter is pressed (or focus leaves), then the note is saved; Escape discards the edit.
- **LB-13** Given a Tags cell, when + is used to add an existing or new tag, or × removes one, then the change persists.
- **LB-14** Given the Crate column, then it shows the crate (folder) name, not a path segment like "home".

## Song detail

- **SD-1** Given `/song/:id`, then the page shows the cover, the title, artist, play/pause and edit actions, a waveform, the metadata (BPM, key, duration, genre, subgenres, crate, dates, file), the notes, tags and relationships.
- **SD-2** Given the current track, then its cover carries the orange cut; Play toggles playback.
- **SD-3** Given notes in more than one notes field, then each non-empty note is shown.
- **SD-4** Given a relationship, when the partner title is activated, then that song's detail page opens.
- **SD-5** Given the detail page, when the relationships action is used, then the relationships dialog opens; list and graph views are both reachable, and clicking a related song in either view re-centres on it without an error.
- **SD-6** Given the edit dialog, when fields are changed and saved, then the page shows the new values without a reload; Cancel discards changes.
- **SD-7** Given an unknown song id, then a "not in the library" state with a link to the Library appears.

## Sets and blocks

- **ST-1** Given `/sets`, then each set shows its name, track count, total time and a numbered preview of its first items, each block shows its name, track count, total time and its track titles in order, and every set and block has edit and delete actions reachable by keyboard. No item reads "Unknown" when its track or block exists.
- **ST-2** Given "New block", when a name and at least two songs are added and saved, then the block appears; fewer than two songs shows a message and saves nothing.
- **ST-3** Given a block or set editor, when items are moved up/down, removed, or transition notes are typed, then saving keeps that order and those notes.
- **ST-4** Given an existing set, when it is opened and saved again without changes, then its items still resolve to the same songs and blocks.
- **ST-5** Given a set, when an alternative transition is added and the set is saved, then saving succeeds and the alternative is shown when reopened.
- **ST-6** Given a delete action, then a confirmation names the set or block, and confirming removes it.

## Import

- **IM-1** Given no root folder, then the Import page explains what a root folder is and offers "Choose folder & scan".
- **IM-2** Given the browser (not the desktop window), when "Choose folder & scan" is pressed, then an in-app folder browser opens at the home folder; a folder opens on click or Enter; the use button (“Use “<folder>””) saves the open folder as root and scans.
- **IM-3** Given a root folder, then the page shows it, offers Re-scan, and after a scan shows found / added / skipped counts.
- **IM-4** Given a root with crates, when "Analyze BPM and key" is pressed, then progress shows (count and current title) until a completion message.
- **IM-5** Given crates, then each crate is listed with its track count.

## Settings

- **SE-1** Given Settings, then Appearance offers theme (Ink, Paper, System), covers (black and white, original colors) and the wide-screen player (panel, bottom bar); each choice applies at once and persists.
- **SE-2** Given Tags, when a tag is created, renamed, recoloured or deleted (with confirmation), then the change persists and the library reflects it.
- **SE-3** Given Genres, when a genre or subgenre is created, edited or deleted, then the list updates and persists; a duplicate genre name is refused with a message.
- **SE-4** Given a colour picker, then it offers the palette swatches by name and can be used with the keyboard.

## Accessibility (all views)

- **AX-1** Every icon-only button has an accessible name.
- **AX-2** Every action that appears on hover also appears on keyboard focus.
- **AX-3** Focus is visible on every interactive element.
- **AX-4** No page scrolls horizontally at 1440, 1280, 768 or 375px, except inside the library table's own scroll area.
