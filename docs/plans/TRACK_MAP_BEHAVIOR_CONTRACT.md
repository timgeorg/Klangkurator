---
tags:
  - plan
  - track-map
  - contract
status: draft
created: 2026-10-15
source: session
---
# Behavior contract — track map (issue #8)

Written **before** implementation (Feature-Development-Playbook, task-type
cross-reference: user-facing behavior change → behavior contract, judged
source-blind by the Validator against a sandbox copy of the library). The
requirements are [33_TRACK_MAP.md](../requirements/33_TRACK_MAP.md); the
phases are in [TRACK_MAP_PLAN.md](TRACK_MAP_PLAN.md). Each phase's PR is
validated against its own group of clauses; phase 7 is validated against the
whole contract, TM-D, TM-M, TM-S, TM-R, TM-H, TM-L, TM-C and TM-E alike.
Numbers marked *(proposed)* in the spec (weights, 400 ms, thresholds) are
settled now — every one shipped as proposed, and phase 6's measurements fixed
the cluster thresholds at their starting values — so they are checked as the
spec and the plan read today.

## How to observe

- **What the canvas shows:** its accessible name ("Map of 92 tracks", "Map
  of 1,200 tracks in 9 genre clusters", "Relationships of <title>: 4
  tracks"). The number of tracks comes from `GET /api/songs`
- **Selecting without hunting for a dot:** on the map, load
  `/map?focus=<song id>`, which selects and centres the track, so a click at
  the canvas centre hits it. In the dialog or on the map, choose an entry in
  a details list (partners, nearest tracks, transitions). Song ids by title
  come from `GET /api/songs`
- **Similarity:** the selected track's nearest tracks list, with each
  entry's percentage
- **Transitions:** the selected track's transitions list, with sources and
  notes
- **Clusters:** the map rail's Clusters section (dimension, reason, list with
  counts)
- **Zoom:** the toolbar's zoom level text
- **Movement:** screenshots of the canvas 100 ms apart differ while nodes
  move; a screenshot 1.5 s after a change is stable. Compare screenshots with
  the pointer outside the canvas, at the same viewport size and pixel ratio
- **Theme:** the app sidebar's theme button, or, when a dialog covers it,
  toggling the `dark` class on `<html>` from the page
- **Playback:** the player's cover link ("Open <title>"), the `<audio>`
  element's `src` and `paused`
- **Fixtures:** set through the backend API on a sandbox copy
  (`PUT /api/songs/<id>` for BPM, key, genre, subgenres and ratings; the tag,
  relationship, block and set endpoints for the rest). Fixture values are
  unique names (genre "Fixture M4", tag "fixture-m4") so the real tracks
  never tie with them. The real 92 tracks have no tags, ratings,
  relationships, blocks or sets, so every clause that needs them creates
  them. The large libraries come from the plan's synthetic-library script,
  written into a sandbox HOME by the dispatcher before the validator starts

## Dialog (phase 2)

### TM-D1 — only the song and its partners
**Given** a song with three relationship partners (two by relationship
types, one by a `transition` relationship)
**when** its relationships dialog shows the graph
**then** the canvas's name says "Relationships of <title>: 4 tracks", the
song is selected, and its details list the three partners.

### TM-D2 — choosing a partner selects it
**Given** that dialog
**when** the user chooses a partner in the details list (or clicks its node)
**then** that track's details and actions show, and the canvas's name still
names the first song.

### TM-D3 — Show its relationships re-centres
**Given** a partner is selected in the dialog
**when** the user presses Show its relationships
**then** the canvas's name now names that track with its own partner count,
and Back returns to the first song.

### TM-D4 — legend
**Given** the dialog's graph
**then** a legend lists the relationship types on screen, each with its line
style.

### TM-D5 — theme
**Given** the dialog's graph is open
**when** the theme switches between ink and paper
**then** the canvas redraws in the new theme, with no colour left over from
the old one.

## Map (phase 3)

### TM-M1 — the route
**Given** the sandbox library
**when** the user opens `/map`
**then** the map shows, and the app sidebar's Library item is active.

### TM-M2 — every track
**Given** a library below the cluster threshold
**then** the canvas's name says "Map of N tracks", with N from
`GET /api/songs`.

### TM-M3 — focus and details
**Given** `/map?focus=<id>`
**then** that track is selected, a click at the canvas centre keeps it
selected, and the map rail shows its title, artist, BPM, key, genre,
ratings, tags, nearest tracks and transitions.

### TM-M4 — nearest tracks follow similarity
**Given** tracks X and Y set to the same values in all nine default inputs
(BPM 128, key 8A, genre "Fixture M4", subgenre "fixture-m4-sub", tag
"fixture-m4", energy, danceability and social acceptance 3) and related to
each other, and a track Z that differs in all nine
**when** X is selected at the default inputs
**then** Y is the first entry of X's nearest tracks, at 100 %, and Z is not
before it.

### TM-M5 — Play is a run of one
**Given** a selected track
**when** the user presses Play in its details
**then** it plays, the player shows no Previous or Next control, and Play on
the same track pauses it.

### TM-M6 — Properties and Song page
**Given** a selected track
**then** Properties opens its Edit dialog; saving a new BPM there shows the
new BPM in the details. Song page opens `/song/<id>`.

### TM-M7 — clearing
**Given** a selected track
**when** the user clicks empty canvas, or presses Esc
**then** the selection clears and the details close.

### TM-M8 — the player sits at the bottom
**Given** the player is docked as the right-hand panel at 1440 px
**when** the user opens `/map` and plays a track
**then** the player shows as the bottom bar without its dock buttons, and it
is the panel again after leaving `/map`.

### TM-M9 — toolbar
**Given** the map
**then** Zoom in, Zoom out, Fit and Reset are named buttons reachable by Tab,
and each changes the zoom level text as named.

### TM-M10 — the same map twice
**Given** the same library and settings
**when** `/map` loads twice, with a reload in between
**then** the two canvases are identical 1.5 s after each load.

### TM-M11 — unlinked tracks
**Given** a track that shares at most one input with every other track
**then** it is in no nearest list, and the status line at the top of the map
rail counts it as unlinked.

### TM-M12 — orange means this one
**Given** a selected track that is also playing
**then** its node carries the orange cut and the focus ring, and no other
node, edge or hover state is orange.

### TM-M13 — states
**Given** a backend that does not answer
**then** the map offers Try again. **Given** an empty sandbox library
**then** the map shows the library's empty state with a link to Import.

### TM-M14 — unknown focus
**Given** `/map?focus=<an id that does not exist>`
**then** a short notice says so, and nothing is selected.

## Similarity (phase 3)

Each clause uses fixture tracks that carry only the values it lists, with a
genre and a tag no real track has, at the default inputs.

### TM-S1 — half and double time
**Given** A at 87 BPM, B at 174 and C at 120, all with the fixture genre and
tag
**then** B is A's first nearest track, at 100 %, and C comes after it.

### TM-S2 — Camelot distance
**Given** A in 8A, B in 9A and C in 2A, all at 128 BPM with the fixture
genre and tag
**then** B comes before C in A's nearest tracks.

### TM-S3 — unrated is not compared
**Given** A with energy 3 and B with energy 0 (unrated), both at 128 BPM
with the fixture genre and tag
**then** B shows at 100 % in A's nearest tracks.

### TM-S4 — missing is skipped
**Given** A and B at 128 BPM with the fixture genre, A with no tags and B
with the fixture tag
**then** B shows at 100 % in A's nearest tracks.

### TM-S5 — one shared input is not enough
**Given** A and B with a BPM and nothing else (no key, genre, subgenre, tags
or ratings)
**then** B is not in A's nearest tracks.

## Rail (phase 4a)

### TM-R1 — inputs change the similarity
**Given** X {128 BPM, 8A, genre "Fixture R1a"}, Y1 {128, 8A, "Fixture R1b"}
and Y2 {150, 8A, "Fixture R1a"}, all three with the tag "fixture-r1"
**then** with BPM on, Y1 comes before Y2 in X's nearest tracks, and with BPM
switched off, Y2 comes before Y1, and the nodes move.

### TM-R3 — settings persist
**Given** changed inputs, weights and collapsed sections
**when** the user reloads `/map`
**then** all of them are as they were, and the filters are cleared.

### TM-R4 — reset
**Given** changed weights
**when** the user presses Reset to defaults
**then** the inputs and weights match the spec's default table.

### TM-R5 — every input off
**Given** the map
**when** the user switches every input off
**then** the map says "Pick at least one input", and no nearest tracks show.

### TM-R6 — filters
**Given** the map
**when** the user filters by a genre, a BPM range or a tag
**then** the canvas's name counts only the matching tracks.

### TM-R7 — nothing matches
**Given** filters that match no track
**then** the map says no track matches and offers Clear filters.

### TM-R8 — collapsing
**Given** the map at 1280 px
**when** the user collapses the map rail and the app sidebar
**then** the canvas grows into the freed space, and nothing overflows
sideways.

### TM-R9 — keyboard on the controls
**Given** the map rail and the toolbar
**then** every control is reachable by Tab, has an accessible name, and shows
a visible focus ring in both themes.

### TM-R10 — sections collapse
**Given** the map rail
**when** the user collapses one section
**then** only that section closes, and its header stays reachable.

### TM-R11 — filters are shared with the table
**Given** a search and a genre filter set on the map
**when** the user goes to the library through the app sidebar
**then** the table shows the same search and filter; clearing them there and
coming back to `/map` (the browser's Back) shows the whole library again.

## Hand-off and motion (phase 4b)

### TM-H1 — the core
**Given** a song with three relationship partners
**when** `/map?core=<its id>` loads
**then** the map shows those four tracks, the map rail shows the core as a
removable chip, and the state survives a reload.

### TM-H2 — removing the core
**Given** the core chip
**when** the user removes it
**then** the canvas's name counts the whole library, and the URL no longer
carries `core`.

### TM-H3 — Show its relationships on the map
**Given** a selected track with two partners and an existing core
**when** the user presses Show its relationships
**then** the core chip now names that track, and the map shows it with its
two partners.

### TM-R2 — one animation, or none
**Given** the map
**when** the user changes a weight
**then** the nodes are visibly moving within the first 400 ms and at rest
1.5 s after the change. **Given** reduced motion **then** screenshots 100 ms and
1.5 s after the change are identical. (The exact duration is a Tester check.)

## Layers (phase 5)

### TM-L1 — relationship edges
**Given** tracks connected by several of the seven non-transition types
**then** the legend lists each type on screen with its line style.

### TM-L2 — one transition edge, many sources
**Given** a relationship T1→T2 with the note "echo out", a block [T1, T2]
with the note "filter swap" on T1, and a set [S1, that block, S2]
**when** T1 is selected
**then** its transitions list shows T1→T2 once, with three sources (the
relationship, the block, the set) and both notes, and S1→T1 once, from the
set.

### TM-L3 — direction counts
**Given** transitions A→B and B→A from different sources
**then** they show as two separate transitions.

### TM-L4 — layers don't move nodes
**Given** the map with a focused track
**when** the user switches the relationships or transitions layer off and on
**then** a click at the canvas centre still selects the focused track.

### TM-L5 — computed against authored
**Given** a selected track with nearest tracks and relationships
**then** the legend names both kinds of edge, drawn differently.

### TM-L6 — a gap breaks the chain
**Given** a set [S1, a deleted track, S2]
**when** S1 is selected
**then** its transitions list has no S1→S2.

### TM-L7 — layers persist
**Given** a layer switched off
**when** the user reloads `/map`
**then** it is still off.

## Clusters (phase 6)

Each clause names the synthetic library the dispatcher prepares
(`scripts/make-synthetic-library.ts`, flags as the script defines them).

### TM-C1 — clusters past the threshold
**Given** 1,200 tracks in 9 genres
**then** the canvas's name says "Map of 1,200 tracks in 9 genre clusters",
and the Clusters section names the dimension and why.

### TM-C2 — BPM ranges next
**Given** 1,200 tracks in 2 genres with BPMs from 90 to 180
**then** the map clusters by BPM range, with groups labelled like "120–130".

### TM-C3 — opening a cluster
**Given** clusters on screen
**when** the user chooses one in the Clusters list
**then** the map shows exactly that cluster's tracks (its count in the
canvas's name), or clusters them again by the next dimension if they are
still too many. **When** the user removes that cluster's chip **then** the
clusters are back.

### TM-C4 — subgenre clusters
**Given** 1,200 tracks in 2 genres, all between 120 and 129 BPM, with 8
subgenres, and some tracks without a subgenre
**then** the map clusters by subgenre, and a track without one sits in its
main genre's cluster.

### TM-C5 — tags never cluster
**Given** any library
**then** the Clusters section never names tags as the dimension.

### TM-C6 — energy last
**Given** 1,200 tracks in 1 genre, all between 120 and 129 BPM, no
subgenres, energy spread from unrated to 5
**then** the map clusters by energy.

### TM-C7 — crate fallback
**Given** 1,200 tracks with no genre, BPM, subgenre or energy, spread over
12 crates
**then** the map clusters by crate.

### TM-C8 — scale
**Given** 5,000 tracks
**then** during a 3 s pan the 95th-percentile frame stays at or under the
limit phase 6 fixes (start: 33 ms), and a re-solve finishes within its fixed
limit (start: 3 s).

### TM-C9 — artist fallback
**Given** 1,200 tracks with no genre, BPM, subgenre or energy, in one crate,
with artists across the alphabet
**then** the map clusters by the artist's first letter, and choosing "A"
shows only tracks whose artist starts with A.

### TM-C10 — last resort
**Given** 1,200 tracks with no genre, BPM, subgenre or energy, in one crate,
all by one artist
**then** the map shows the first tracks by title, with a notice that the
rest need filtering.

## Entry points (phase 7)

### TM-E1 — Table | Map
**Given** the library table
**when** the user switches to Map
**then** `/map` opens with the app sidebar's Library item still active, and
switching back returns to the table. **Given** a search and a genre filter in
the table **when** the user switches to Map **then** the map counts only the
matching tracks and shows the same filters.

### TM-E2 — Show on map
**Given** a song page
**when** the user presses Show on map
**then** `/map` opens with that song selected.

### TM-E3 — Open in map
**Given** a song's relationships dialog
**when** the user presses Open in map
**then** the map opens with that song's core, as in TM-H1.

### TM-E4 — narrow screens
**Given** a 375 px wide window
**then** the library has no Table | Map switch, `/map` shows a notice with a
link to the table, and the relationships dialog's graph still works.

Phase 7 is the last phase: it is judged against every clause above, not only
TM-E1–TM-E4. The map is reachable only through the entry points this phase
adds — the Table | Map switch, Show on map on the song page and Open in map in
the dialog — so the whole contract is checked here on the sandbox library, in
both themes at 1440, 1280, 768 and 375 px.

## Nodes, labels and focus (issues #31–#37)

Follow-ups of #8, judged the same way (source-blind, on a sandbox copy).

### TM-N1 — big nodes with artwork (#31)
**Given** a track with artwork and a genre
**when** the map is at the fit zoom
**then** the node draws as a filled disc in its genre colour at about twice the
earlier size. **When** the camera zooms in past the artwork zoom **then** the
cover draws in the node's centre, in the app's cover mode, with the genre as the
outer ring.

### TM-N2 — no artwork far out (#31)
**Given** the 5,000-track library at the fit zoom
**then** no artwork is requested and every node is a full genre-colour disc.

### TM-L8 — every label, in full (#37)
**Given** a track whose title is longer than a node's width
**then** its label draws in full, wrapped onto several lines, with no ellipsis —
and the same holds for every other track at the same time: no label is hidden
because a neighbour took its place.

### TM-L9 — labels never overlap (#37)
**Given** the map at any zoom
**then** no two labels overlap, because the layout reserved each one's room.
**When** the user zooms in **then** the labels stay inside a readable band (they
do not grow without bound).

### TM-I8 — double-click plays (#32)
**Given** a track on the map
**when** the user double-clicks it
**then** it plays as a run of one (no previous or next). **Given** the same
track is already playing **when** it is double-clicked **then** it pauses or
resumes, like the details' Play.

### TM-I9 — a single click is not delayed (#32)
**Given** a track on the map
**when** the user clicks it once
**then** it is selected at once — the selection does not wait for a possible
second click.

### TM-I10 — Focus (#33)
**Given** a selected track
**when** the user presses Focus **then** the camera centres on it and the other
nodes are re-arranged around it by similarity (the tracks closest to it sit
closest). **Then** pressing Fit or Reset leaves that arrangement. **Given**
nothing is selected **then** Focus is disabled.

### TM-I11 — the playing track on arrival from the table (#34)
**Given** a track playing and a search or filter that keeps it on the map
**when** the user switches Table → Map
**then** that track is selected and centred.
**Given** a search that excludes the playing track
**when** the user switches Table → Map
**then** a short toast says the playing track is not on the map, nothing is
selected, and playback carries on.

### TM-I12 — the hover popover (#35)
**Given** a track on the map
**when** the pointer rests on it
**then** a popover shows at once with its full title and artist, BPM, key,
duration and its tags. **When** the pointer leaves **then** the popover goes.
**Given** a touch viewport **then** no popover appears.

### TM-RL1 — two rails (#36)
**Given** the map
**then** the **left** rail holds the status line, Similarity, Filters, Layers
and Clusters, and the **right** rail holds the selected track. **Given**
nothing is selected **then** the right rail shows the empty state.

### TM-RL2 — both rails collapse and persist (#36)
**Given** the map
**when** the user collapses the left rail, then the right one
**then** each collapses independently, the canvas takes the freed width, a named
control reopens each, and both states are still collapsed after a reload.
