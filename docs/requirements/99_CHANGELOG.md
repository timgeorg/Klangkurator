# Requirements Changelog

Status: Active
Last Updated: 2026-10-15

## 2026-10-15

### Track map phase 5 — layers, edges and the legend (issue #8, PF-81)

The map's edges become switchable, and the map says what it is drawing:

- `src/lib/trackMap/layerEdges.ts` is the phase 5 pure module.
  `visibleEdges(edges, layers, selectedId)` is the plan's PM-8 step 10: the
  model's edges narrowed by the rail's three layer switches, with the computed
  **nearest** layer following the selection (only the selected track's nearest
  edges show, so the map is not a hairball of every link). `offsetEdges` gives
  each edge the side-by-side place it draws at, so a pair carrying several
  relationship types is drawn beside each other rather than on top of each
  other (TM-L1) and A→B sits beside B→A (TM-L3). `onScreenEdgeKinds` reads the
  kinds actually drawn, which the legend names, and `transitionNotes` the
  deduplicated notes a transition edge carries (TM-L2, TM-L6).
- `src/components/map/rail/LayersSection.tsx` is the new rail section: one
  switch per layer — **Relationships** (with its seven non-transition types
  listed beneath it, each in its own line style), **Transitions** and
  **Nearest** — writing the `layers` slice of `useMapConfig`, so a layer
  switched off is still off after a reload (TM-L7). Below them sits the legend,
  in two groups: **Computed** (Nearest track, Transition) and **Authored** (the
  relationship types on screen, each in its own line style, in
  `relationshipStyle`'s order). The legend names only what is drawn, so a
  switched-off layer or a type the library holds no edge for stays out of it
  (TM-L1, TM-L5). Nothing in the layers is a dependency of the model, so a
  switch redraws and never re-solves — no node moves (TM-L4).
- `src/components/map/TrackMapCanvas.tsx` draws every edge through its
  side-by-side place as a shallow bend whose ends stay on their nodes, so two
  edges on one pair never overlap, and the arrowhead follows the bend's own
  end; it draws the edge's notes as a label at the edge's middle while a track
  is selected (TM-L2). A transition's notes are already merged across its
  sources by phase 1b, so the same note written on a block and on the set that
  contains it draws once.
- `src/pages/TrackMap.tsx` step 10 now calls the tested `visibleEdges` instead
  of its inline filter, and hands that same list to the rail, so the legend
  names what the canvas is drawing.
- Tests: `layerEdges.test.ts` covers the layer filtering (each switch, the
  nearest layer's dependence on the selection, the model's order kept) and the
  side-by-side placement (two and three types on one pair, both directions of a
  transition, a nearest edge left on the line, and determinism), plus
  `transitionNotes` and `onScreenEdgeKinds`.

### Track map phase 4b — the core hand-off and the re-layout motion (issue #8, PF-81)

The map gains its hand-off from a track's relationships and its one animation:

- `src/lib/trackMap/core.ts` resolves a core: `coreMemberIds(coreId,
  relationships)` is the core song and every track it has a relationship with,
  of any of the eight types, in either direction — the dialog's own partner
  list (`14_RELATIONSHIPS.md`), not the wider `R(t)` of `connections.ts`, which
  also counts transitions found in a block's or a set's running order. Pure, so
  the members are recomputed from the loaded relationships on every arrival.
- `/map?core=<id>` (`src/pages/TrackMap.tsx`) anchors the map on that song and
  its partners. The URL carries only the id, so a reload keeps the core; the
  core narrows the shown set **alongside** the shared filters, and the rail's
  Filters section shows it as a removable chip naming the track
  (`rail/FiltersSection.tsx`). Removing the chip drops the core, and with it
  `core` from the URL, and the canvas counts the whole library again
  (TM-H1, TM-H2). An unknown `?core=` id is dropped from the URL rather than
  left to shadow the whole library on every reload.
- **Show its relationships** on the map (`TrackDetails` → the rail) makes that
  track the core, replacing any existing one, and selects and centres it, in
  place of phase 3's stand-in (TM-H3). The dialog's own Show its relationships
  still re-centres with back history, and its **Open in map** button is still
  phase 7.
- The 400 ms re-layout: `src/lib/trackMap/positionsAnimation.ts` holds the
  timing as pure, tested functions — `POSITION_ANIMATION_MS` (400),
  `easeOutCubic`, `animationProgress` and `interpolatePositions` — and
  `TrackMapCanvas.tsx` samples them once per frame, in place of the inline
  arithmetic it carried since phase 2. A change of a similarity weight has
  animated since phase 2; phase 4b also animates a change of the **shown set**
  (a filter, the core) rather than jumping it, so the map visibly rearranges.
  The first layout still appears in place, nothing animates on load, and a
  re-solve that lands where the nodes already are does not animate at all.
  Under `prefers-reduced-motion: reduce` the nodes jump, so screenshots 100 ms
  and 1.5 s after a change are identical (TM-R2). The warm start is unchanged:
  the canvas reports the positions on screen into the page's `seedsRef`, so a
  re-solve barely moves; a node new to the shown set appears at its new place
  rather than flying in from the origin.
- The motion exception is written down where the rule lives: `DESIGN.md` gains
  a **Motion** section naming the 400 ms canvas re-layout as the one exception
  to the 150–220 ms rule, with its duration, where it applies (the track map's
  canvas, camera moves staying at 220 ms) and its reduced-motion behaviour, and
  `design-system/README.md` records the same rule beside the canvas guidance.
- Tests: `core.test.ts` covers the core's membership (both directions, all
  eight types, a repeated pair counted once, an empty id never a member) and
  `positionsAnimation.test.ts` the animation timing (the ease-out's ends and
  clamping, progress over the 400 ms and the instantly-finished zero duration,
  interpolation and a new node starting at its new place).

### Track map phase 4a — shared filters, map config and the rail sections (issue #8, PF-81)

The map's controls land, and the library's search and filters become one shared
state:

- `src/lib/LibraryFilterContext.tsx` holds the session's one search and one set
  of column filters, provided in `src/App.tsx` **above** the routes, so they
  survive navigating between the table and the map and the browser's Back.
  `SongLibrary.tsx` now reads them instead of its own `useState`, and the map
  reads and writes the same values, so clearing in either place clears for both
  (TM-R11). Session-only, like the table's own state: nothing is stored
  (REQ-33-PS).
- `src/components/dj/libraryTable.ts` gains
  `filterSongs(songs, songTags, filters, searchQuery)`, extracted unchanged from
  `SongLibrary.tsx`'s inline predicate, so the table and the map share one
  implementation and the table's rows do not change. It also exports
  `INITIAL_FILTERS` and the `SongTagsById` shape; sorting stays with the table.
- `src/hooks/useMapConfig.ts` saves the similarity inputs and their weights, the
  `layers` slice (relationships, transitions and nearest, all on — phase 5
  switches them) and the collapse states of the rail and of each section, under
  `klangkurator.map.v1`. Everything is validated on read: a stored value that
  does not fit (an unknown input, a weight off the 0.5–3 grid, a non-boolean
  section state) is replaced by the default (REQ-33-PS). Nothing here is a
  dependency of the model, so switching a layer or collapsing a section never
  re-solves the layout.
- `rail/SimilaritySection.tsx` is the inputs: one row per input with a switch
  and a weight 0.5–3 in steps of 0.5 (proposed), and **Reset to defaults**. A
  switch commits at once; a weight commits on release (`onValueCommit`), so one
  drag is one change and one re-solve (TM-R1, TM-R4).
- `rail/FiltersSection.tsx` is the same search and the same filters as the
  table, built on `ui/column-filter.tsx` over `FILTER_CONFIG`, so both views
  offer the same set (TM-R6). The core-chip slot (phase 4b) and the
  cluster-filter slot (phase 6) are marked and render nothing.
- The `/map` rail (`rail/MapRail.tsx`) gains both sections and collapses as a
  whole and per section; `RailSection.tsx` now takes its open state from
  `useMapConfig`, so section collapse persists (TM-R3, TM-R10). The rail's
  status line reports **Pick at least one input** with every input off, and no
  nearest tracks show (TM-R5), and **No track matches** with Clear filters when
  the shared filters exclude everything (TM-R7). Collapsed, the rail leaves a
  narrow strip with its own expand control and the canvas takes the freed width;
  the rail never scrolls sideways (TM-R8). Every control is Tab-reachable, named
  and shows focus through the tokens (TM-R9).

### Track map phase 3 — the /map route, the rail and the states (issue #8, PF-81)

The map becomes a view of its own, reachable at `/map` for testing (answer 2:
no entry point before phase 7):

- `src/pages/TrackMap.tsx` is the page. Its hooks follow the plan's PM-8
  order: the library state and its load effect with a `reload` callback (songs,
  tags, song_tags, relationships, blocks, sets), `features`, `connections` and
  `transitions`, the inputs, the filters, the shown set, the model, the seeds
  and the solved positions, the selection with its URL effect, then the visible
  edges. The inputs are a local `useState` at `DEFAULT_INPUTS` and the layers a
  local constant, both marked for phase 4a's `useMapConfig`; the filter step is
  a marked wiring point with nothing read yet, so the map shows the whole
  library at the default inputs. The layout is solved with `solveLayout` from
  the positions on screen (warm start), so a re-solve keeps the map's shape and
  a fresh load of the same library is the same map.
- The toolbar is named buttons — **Zoom in**, **Zoom out**, **Fit**, **Reset** —
  each changing the zoom level shown as text beside them (TM-M9). Selecting a
  track replaces `?focus=` in the URL; `/map?focus=<id>` selects and centres
  that track, and an unknown id shows a short notice with nothing selected
  (TM-M14). Clicking empty canvas or pressing Esc clears the selection (TM-M7);
  clicking a node selects it; hovering still highlights its edges.
- `src/components/map/rail/RailSection.tsx` is the collapsible-section
  scaffolding: a named, Tab-reachable header that stays reachable while the
  body is closed. `rail/SelectedTrackSection.tsx` is the selected track: the
  full `TrackDetails` — BPM, key, genre, ratings and tags, the nearest tracks
  with their percentages, the relationship partners, the transitions in and out
  — and the actions Play (a run of one; the playing track pauses and resumes),
  Properties (the Edit dialog; saving reloads and re-solves), Song page and
  Show its relationships (which selects the track and shows its partners as the
  nearest/partners lists — the core hand-off is phase 4b). The status line at
  the top of the rail counts the tracks on the map and the unlinked ones
  (TM-M11).
- States (TM-M13): a skeleton while loading, the backend error with **Try
  again**, the empty library with a link to **Import**, and a short notice below
  768 px, where the map has no room. Above the plan's node threshold `T = 500`
  the map shows the first `T` tracks by title with a notice, the stopgap until
  phase 6 clusters large libraries.
- The route is in `src/App.tsx` above the catch-all; `src/lib/mapRoute.ts`
  exposes the route test both the shell and the player read.
- `DJLayout.tsx` derives the player's mode from the route, so on `/map` it is
  the bottom bar and `NowPlaying.tsx` hides its dock buttons there — the saved
  dock preference is never touched and is unchanged after leaving the map
  (TM-M8). The app sidebar's Library item stays active on `/map` (TM-M1).
- Similarity wiring (TM-S1–S5): the page passes `features`, the connections and
  `DEFAULT_INPUTS` into `buildModel`, so the phase 1b rules hold at the default
  inputs — half and double time fold, the Camelot wheel orders the keys, an
  unrated rating and a missing value are skipped per pair, and a pair that
  shares one input only is never linked.
- The phase 3 calibration (the spread of `S` on the real 92 tracks and a
  screenshot of `/map`) is measured on a sandbox copy with
  `npx vite-node src/lib/trackMap/calibrate.ts -- <a sandbox library.json>`
  (development-only; nothing imports it); the numbers belong in
  `docs/plans/TRACK_MAP_PLAN.md` (see its phase 3 row) and are pending that run.

### Track map phase 2 — layout, canvas and the dialog on it (issue #8, PF-81)

The map's layout and renderer land, and the relationships dialog's graph moves
onto them:

- `src/lib/trackMap/layout.ts` solves the layout headless with d3-force:
  nodes sorted by id before solving (so the same input gives the same output),
  link distance `30 + 120 × (1 − s)` at strength `s`, a many-body charge of
  −120 with `distanceMax` 600, a weak centre (0.05) and collide by node radius
  + 2, then `simulation.stop()` and 300 synchronous ticks. A new node starts at
  the mean of its linked neighbours' seeds, else on a golden-angle spiral over
  the new nodes in id order; a re-solve starts from the positions on screen, so
  the map keeps its shape. Unlinked nodes settle at the edge.
- `src/components/map/TrackMapCanvas.tsx` is the cold renderer the dialog and
  the map share: positions are pinned with `fx`/`fy`, so it never simulates, and
  `autoPauseRedraw` keeps it at zero paints while idle (the phase 2 spike
  measured 0 in 2 s idle in Chromium and 3 s in the PyWebView window). It draws
  genre-coloured discs, one line style per relationship type, the orange cut and
  the focus ring on the playing and selected tracks, and dims the rest on hover.
  It reads the design tokens at runtime, scales the backing store by
  `devicePixelRatio`, draws text after `document.fonts.ready` and redraws on a
  theme or cover-mode change; a changed node set appears in place and a change
  of positions moves in one 400 ms ease-out animation (a jump under reduced
  motion). `TrackMapCanvasHandle` exposes zoom in / out, fit, reset, centre-on
  and the zoom level; graph-node arrow-key travel stays deferred.
- `src/components/map/TrackDetails.tsx` is the selected track's details,
  compact in the dialog and full in the map rail: cover, title, artist, BPM,
  key, genre, ratings and tags; the nearest tracks with each similarity as a
  whole percentage; the transitions in and out; and the actions Play (a run of
  one), Properties, Song page and Show its relationships.
- The relationships dialog's graph is now the same canvas: its song at the
  origin with its partners around it, the song selected on open, a partner list
  that selects, **Show its relationships** re-centring with back history, and a
  legend of the relationship types on screen. **Open in map** comes in phase 7.
- `src/components/dj/SongRelationshipGraph.tsx` is deleted; the dialog was its
  only importer.
- `14_RELATIONSHIPS.md` › Graph View describes the canvas-backed dialog. The
  built bundle grows by the renderer's modules; the delta is recorded in
  `docs/plans/TRACK_MAP_PLAN.md` › Risks and spikes (baseline 607,016 bytes,
  `dist/assets/index-Dw8AkhD1.js`).

### Track map phase 1b — similarity model and tests (issue #8, PF-81)

The map's computation lands as pure modules under `src/lib/trackMap/`:

- `features.ts` reads a song and its tag ids into `TrackFeatures`. Key parsing
  accepts the short ("Am", "F#m", "Bb"), long ("A minor", "C# major") and
  Camelot ("8A") notations, case-insensitively, with `♯`/`♭` and `#`/`b`
  alike; enharmonics share a Camelot code. Numbers ≤ 0 or not finite are
  missing, ratings of 0 are unrated, empty sets are missing, and the genre
  comes from `trackGenre()` (lowercased for comparing, its display case kept
  as `genreLabel`).
- `similarity.ts` holds the per-input table — BPM by tempo ratio with half and
  double time folded, key by Camelot steps, genre 1/0, subgenre and tags by
  Jaccard, the three ratings by their difference, year, duration, and
  relationships through `R(t)` — the weighted composite (missing values
  skipped, the minimum-overlap rule, symmetric, rounded to 9 decimals) and
  `nearest` (top-k, `S` descending then id ascending, `S > 0` only).
- `connections.ts` builds `R(t)`: any of the eight relationship types either
  direction, plus every transition fact either direction.
- `transitions.ts` gathers the transition facts — `transition` relationships,
  consecutive tracks in a block, and consecutive tracks in a set's flat
  `items` with blocks expanded in place (`phases` never read) — with a gap
  breaking a run, dedup per `from → to` direction, merged notes and sources
  ordered relationship, block, set, then by name and id.
- `clusters.ts` gives `groupKey` for all six dimensions and the dimension
  choice (try genre, BPM range, subgenre, energy; `C_MIN` 4, `C_MAX` 60; a
  dimension with one group is never taken; the nearest band when none fits;
  crate then artist initial as fallbacks). Node building is phase 6.
- `buildModel.ts` assembles the track-mode `MapModel`: nodes, the undirected
  union of the nearest sets as links, the relationship and transition edges,
  and `unlinkedCount`.
- `syntheticLibrary.ts` is the seeded generator the 500-track perf test uses.

Every worked example and boundary in the plan's algorithm contract has a
vitest test, including the 500-track nearest run in under 1 s.

### Track map phase 1a — shared types and test setup (issue #8, PF-81)

`src/lib/trackMap/types.ts` fixes the module's shared types and
`DEFAULT_INPUTS` (the spec's default weights) so the build phases can run
side by side. The graph dependencies (`react-force-graph-2d`, `d3-force`,
`@types/d3-force`) and vitest are installed; `npm test` runs the
`src/lib/trackMap/` suite, and test files stay out of `tsconfig.app.json`.

### Track map spec, draft (new 33; 13, 14, 31, 32, 90, 92; issue #8, PF-81)

A new spec for the track map: every track on one fullscreen map, placed by a
symmetric, user-weighted metadata similarity. BPM, tags and relationships
weigh most and key least; keys compare on the Camelot wheel, BPMs by ratio
with half and double time folded; unrated ratings and missing values are
skipped per pair. Past a node threshold the map collapses into clusters by
genre, BPM range (10 BPM), subgenre or energy; tags only filter.
Relationships and transitions are layers, and transitions from
relationships, sets and blocks merge into one edge per direction with their
sources. The relationships dialog becomes a small instance of the same
canvas, where a click selects. Search and filters carry across the
Table | Map switch, both ways. A library without that metadata falls back to
clusters by crate, then by the artist's first letter. PF-42 no longer
blocks the map. Starting
values are marked proposed for Tim's review. The plan and the behavior
contract are in `docs/plans/TRACK_MAP_*`.

## 2026-10-14

### The player steps through a run (01, 13, 15, 16, 92, 93; issue #5, PF-80)

The preview player gets previous and next. They step through the run Play
was pressed in: the library table's rows as shown, a set's running order
(blocks expanded in place) or a block's tracks, and the next track starts
when one ends. The ends stop, never wrap. The run is fixed when Play is
pressed, so a new sort or an edit applies from the next Play. Sets and
blocks get Play on their cards (from the first track) and on each editor
row that has something to play (from that track). A track that fails to load
is skipped with a message, onward in the direction the run was going. From
768 to 1279 px the player bar's volume is the mute button alone, so the
waveform keeps its width. P7, OOS-4 and `PRODUCT.md` stop saying
"never a player": playing tracks to hear how they fit together is
curation; decks, mixing and crossfading stay out.

### Per-track re-analyze with an optional BPM range (10, 11, 90, 91; issue #6, PF-79)

A track's detail page gains a `Re-analyze` action: a popup that re-runs BPM and
key detection on **one** track and takes an optional BPM range as a hint. This
is the repair path for a wrong BPM — the library-wide "Analyze BPM and key" job
only fills *missing* values, so a wrong number was previously unfixable except
by typing.

- New `REQ-10-RA` in `10_LIBRARY_AND_FILE_LOADING.md`: the detail-page popup,
  the override of the "only fill missing" rule for that track, BPM+key in one
  run, and the one-analysis-at-a-time rule enforced in both directions.
- New `INV-13`: analysis never overwrites a human-set BPM/key silently — the
  batch job fills only missing values, the per-track run is the explicit
  override and shows before → after.
- The range is a **hint, not a filter**: it biases the tempo estimate with a
  bounded log-normal prior. Measured on synthetic click tracks, filtering
  candidates instead would answer `215.3` for a true-128 track asked for
  `200–220`, with no way to detect the mismatch; the prior steered a mis-read
  `117.5` to `172.3` for a true-174 track asked for `165–185`.
- Since it is a bias and not a guarantee, a result outside a given range is
  reported (`bpm_fit: false`) and the stored BPM is left unchanged.
- New PF-79 in `92_PLANNED_FEATURES.md`; the endpoint takes an optional body
  (`bpm_min`/`bpm_max`) and returns `applied` plus `bpm_fit`.

### Corrected: OOS-5 was false and duplicated

`93_OUT_OF_SCOPE.md` carried two rows with the same ID `OOS-5`. The second —
"Waveform analysis / beat detection", claiming BPM is "entered manually or
extracted from file metadata, not computed from audio" — has been false since
librosa shipped. It is renumbered to `OOS-12` and corrected: BPM **is** computed
from the audio; what stays out of scope is beat-grid/waveform analysis.

## 2026-10-13

### Library export / import: versioned envelope, merge with conflict popup (17, 20, 90, 91; issue #10, NFR-2)

The whole store — songs (+ all user metadata), tags, song_tags, relationships,
playlists, playlist_songs, blocks, sets — exports as one versioned JSON
envelope (`klangkurator-library-<date>.json`; `_config` stays machine-local).
The import **merges, it never replaces**: tracks match by file_path, then
artist+title+duration within ±2 s, then artist+title; empty local fields fill
silently; differing values surface as conflicts, resolved per field (overwrite
yes/no, default local wins) with an apply-to-all checkbox. Matched tracks keep
their local id and path; added tracks get fresh ids (a foreign uuid is never
written). Tags match by name; joins never duplicate. Relationships/playlists/
blocks/sets import wholesale only into an empty store, else they are skipped
and reported. This ends the old `POST /api/import`, which wholesale-replaced
the target library — using it with partial data destroyed data. Also corrects
`17_SETTINGS.md`, which documented a Backup section that did not exist.

### Inline editing in the library table (12, 13, 90; issue #3)

Every value the user owns now edits in the table, where notes and tags
already did (NFR-11 widened).

- **Genre, Key**: a click opens a list with search and the current value
  checked; "No genre" / "No key" clears it.
- **Subgenres**: a checklist of the genre's subgenres, with Create.
- **Energy, Dance, Social, Rank**: a click on a bar (or star) sets that whole
  value, a click on the current one clears it; the arrow keys work as on a
  slider and keep a decimal from the dialog; touch opens a picker of 44px
  targets.
- **Artist, Album, BPM**: edited in place; BPM takes "127,5" too.
- **Lyrics**: a click opens the lyrics editor.
- Changes save at once, one request at a time. A failed save says so and
  reloads the table. An edit never moves its row until the sort, the search or
  a filter changes.
- Notes keep their behavior on the shared editor.
- Backend: saves run one at a time. Before, two at once (an edit during the
  analysis, or two requests) could rename the shared temporary file from
  under each other and fail. A regression test covers it.
- Backend: batch analysis no longer overwrites a BPM or key set by hand
  while it runs (regression test).

### Decimal ratings: one decimal on energy / danceability / social acceptance (11, 13; issue #7)

The three 0–5 ratings (`energy`, `danceability`, `social_acceptance`) take one
decimal (step 0.1) instead of whole numbers only; the backend model widens
from `int` to `float`, so fractional values round-trip through the API (with
`int`, a stored 3.8 would have been a 422 on write and a 500 on every read).
The Edit dialog's rating sliders step 0.1 (Rank stays a whole-number slider),
the persisted value is snapped to one decimal to avoid float drift, and the
table's five-bar meter stays — decimals floor on display (a stored 3.8 shows
3 bars) while the tooltip keeps the exact value. Sort and range filters are
numeric and already decimal-safe. Rank is untouched: whole 1–5 stars.

### Track rank: a per-track 1–5 star score (11, 13; issue #4)

A fourth, independent per-song field `rank` (1–5 whole stars, `0` = unranked).
It says *how good* a track is, distinct from the three 0–5 ratings that say
what it *does*. It gets a sortable "Rank" column of five stars, a `≥ N` range
filter, a read-only display on the song detail page, and a slider in the Edit
dialog. It is not inline-editable in the table (that is issue #3) and not shown
in the player. Songs written before this change have no `rank` key and read as
unranked; a saved column layout is migrated to include the new column.

## 2026-10-08

### Editorial redesign and design system (02, 10, 13, 14, 15, 16, 17; issue #1)

The stock dark "Lexicon-style" skin is replaced by an editorial design
system built from the user's moodboard ("editorial magazine look with shapes,
layouts and textures, no roughness"). Source of truth: `design-system/`;
product record: `PRODUCT.md`; built world: `DESIGN.md`.

- **Themes**: ink (dark, default) and paper (light); the rail stays ink.
- **Orange means "this one"**: current track, selection, focus, primary
  action, the mark. Genre/tag colours move to a print-ink palette without it.
- **Signature**: the orange cut on the current track's cover, in the table,
  the player and the song detail page.
- **Player (PF-16)**: same single-track preview, now a right-hand panel on
  screens ≥ 1280px (bottom bar below, or when docked); the waveform is the
  scrubber.
- **Navigation**: the rail lists Library, Sets, Import, Settings; the five
  links to unbuilt pages are gone; the active link is marked again.
- **Library (13)**: crate tabs, active-filter chips, a no-match state that
  keeps the header, working sort on the sortable columns, play/edit on
  keyboard focus, the real crate name in the Crate column, three requests
  instead of one per track on load.
- **Song detail and relationships (14)**: an editorial detail page (serif
  title, spec sheet, notes as liner notes); the relationships dialog opens
  from it directly and no longer crashes when re-centring on a related song;
  the graph follows the theme, draws black-and-white cover nodes and gives
  each relationship type its own line; BPM keeps its decimal on save.
- **Sets and blocks (15, 16)**: the Sets page reads like a contents page
  (cover mosaic in the set's colour, serif name, totals, numbered running
  order). Set items now resolve by `ref_id` (before, every item showed
  "Unknown"); alternatives are saved as `{ref_id, label}` (before, saving a
  set with an alternative failed); suggestions from saved `transition`
  relationships load again. Tracks and blocks are added from a searchable
  picker; deleted tracks and blocks keep their slot, marked, until removed;
  deleting a block says how many sets use it; a description can be cleared.
- **Import (10)**: the page is called Import; without a root folder it opens
  on "Start with your music folder." and the three steps. A folder picked in
  the desktop dialog is now saved as the root (it was only scanned). The
  browser folder dialog opens folders on click or Enter, shows `~/…` paths
  and keyboard focus follows. Errors show the backend's reason.
- **Library details (13)**: the Notes cell edits the mixing note only (other
  notes show as a hint and are never copied into it); the tag picker puts
  existing matches before Create and creates on Enter; crowded tag cells
  clip; the last, width-filling Notes column has no dead resize handle.
- **Validator round 4 (11, 13)**: the phone menu sheet is named and Tab
  reaches every destination (rail tooltips are portaled and only rendered
  when the rail is collapsed); walking the table backwards keeps focus below
  the sticky header; toast close buttons are named; the Edit dialog writes
  keys in the analyser's notation ("Cm", shown as "Cm · C minor"), so edited
  and analysed keys filter alike; highlighted list options take the Signal
  Wash, orange text and the rail's half-disc marker; the picker says when a block is already in the running order; the
  table's right edge covers slivers up to 120px and adds nothing when the
  table already ends on a whole column; the more-columns button only shows
  where it has room, never over a column's header or filter button, and
  snaps each press so it stays available; a header control near the edge
  opens on the first mouse click (the keyboard focus scroll no longer runs
  for mouse focus).
- **Validator round 3 (13, 16)**: dialogs return focus to their opener;
  track lists in Sets keep versions; long unbroken names wrap (no sideways
  scrolling at 375px); the Edit dialog keeps typed edits across a nested
  lyrics or relationship save; a hand-resized Tags column survives reloads;
  tag cells show whole chips plus "+N"; a "more columns" button and focus
  that stays clear of the table's right edge; phases are counted where they
  cannot be shown.
- **Editing (11, 21)**: Cancel in the Edit track and Lyrics dialogs discards
  the edits (reopening showed them before); emptying a field clears it — the
  dialog sends `null` and the backend now applies an explicit `null` to
  optional fields. Regression tests in `backend/tests/`.
- **Settings (17)**: an Appearance section (theme, cover style, player dock);
  tags show their track counts; genre edits no longer change the built-in
  defaults in memory; edit and delete are visible without hovering.

## 2026-09-24 (v2)

### Audio analysis progress (10)

Analysis of BPM/key can take minutes for a full crate. Added REQ-10-AP:
the "Analyze BPM/Key" job must show live progress (`Analyzing (3/47)…`,
current track, progress bar) via a polled `GET /api/library/analyze-status`
endpoint. Single background job; completion summary unchanged.

### Backlog additions (92)

Six features requested by Tim, recorded in `92_PLANNED_FEATURES.md`
(PF-12 … PF-17): duration display format, real waveform preview, album
cover column, column drag-and-drop reorder, media player, song detail view.

- **Duration format revision** — PF-12's plain seconds replaced by mm:ss
  (minutes unpadded) after user feedback; all duration paths unified.

## 2026-09-24

### Root folder is the unit of import (10, 02, 93)

Closed the gap between the requirement and the running app, found while
using the app for the first time with a real backend:

- **Loose file import is out** — "load audio files by themselves" was a
  Phase-1 leftover (File API `<input type=file>` in `fileLoader.ts`) and
  contradicted the crate concept. Explicitly added as OOS-11.
- **Native OS folder picker mandatory** — manual path typing demoted to a
  collapsed "Advanced" fallback; `<input webkitdirectory>` / File System
  Access API dropped as a primary flow
- **Root folder selection auto-scans** — picking a folder sets the root
  and immediately imports; no separate "Save" + "Scan" sequence
- **Subfolder-less root is valid** — audio files directly in the root
  import with the root's own name as the crate
- **Backend folder browsing** — `GET /api/library/browse` lists
  directories under the user's home for the browser-mode picker
- **Library empty → Load Files** — the Library view redirects to the
  import page when it has zero songs to show

## 2026-08-09

### Initial split from monolithic Requirements.md

Split the root-level `Requirements.md` into a numbered requirements folder
following the Smartimize `docs/requirements/` pattern:

- `00_INDEX.md` — requirements index
- `01_VISION_AND_PRINCIPLES.md` — vision, principles, target user
- `02_SYSTEM_CONTEXT.md` — runtime architecture, data services, design system
- `10_LIBRARY_AND_FILE_LOADING.md` — root folder selection, crate mapping, file scanning
- `11_SONG_MODEL.md` — full song entity including new phase_tags and vibe_tags
- `12_TAGS_AND_GENRES.md` — tags and genre hierarchy
- `13_LIBRARY_VIEW.md` — table layout, columns, filtering
- `14_RELATIONSHIPS.md` — knowledge graph and relationship types
- `15_BLOCKS.md` — reusable mini-mixes
- `16_SET_PLANNING.md` — **NEW** — phase-based set planning workflow
- `17_SETTINGS.md` — tags/genres/backup/preferences
- `20_DATA_MODEL_OVERVIEW.md` — entity relationships
- `21_DATA_MODEL_LIBRARY_JSON.md` — library.json schema
- `22_DATA_MODEL_BLOCKS_AND_SETS_JSON.md` — blocks.json and sets.json schemas
- `90_NFRS.md` — non-functional requirements
- `91_INVARIANTS.md` — constraints and data integrity
- `92_PLANNED_FEATURES.md` — future work
- `93_OUT_OF_SCOPE.md` — explicit non-goals

### New: Set Planning domain (16)

Added the set planning workflow based on the 2026-08-08 session where Tim
planned a 2-hour sunset set with Sterling. Key additions:

- **Set entity** with phases, target duration, crate selection
- **Phase-based set building** (Kanban-style board: pool → phase columns)
- **Phase tags and vibe tags** on songs (opening, building, sunset, peak, closing; dark, uplifting, tearjerker, banger)
- **Automated set checks**: artist clustering, genre ping-pong, energy dips, tempo jumps
- **Arc review**: energy curve, genre flow, artist clustering visualization
- **Set export** as markdown (matching the existing `09-08-2026_Welzheimer-Str-Sunset.md` format)

### New: Root folder / crate concept (10)

Formalized the "select a root folder, subfolders become crates" workflow
that Tim described. Crates are the unit of selection for set planning —
you pick which crates to draw from, then filter within that pool.

## 2026-08-09 (v2 — Rekordbox + transitions + AI)

### Refined: Vision and positioning

Klangkurator does **not** replace Rekordbox. Rekordbox stays the core of
playing (cue points, USB export, CDJ/XDJ performance). Klangkurator is the
curation and set planning layer above it. Updated `01_VISION_AND_PRINCIPLES.md`
with 3 new principles (P7–P9):

- P7: Rekordbox is the playback engine, not the competitor
- P8: Transitions are first-class entities
- P9: AI augments curation, doesn't replace it

### New: Rekordbox Integration domain (30)

Added `30_REKORDBOX_INTEGRATION.md` — read/write cue points, export sets as
Rekordbox playlists, USB export, bidirectional sync. Planned features PF-30
through PF-34.

### New: Transition Mining domain (31)

Added `31_TRANSITION_MINING.md` — mine transitions from existing sets, suggest
transitions based on history, score transition compatibility, transition
library view, import transitions from Rekordbox mix history. Planned features
PF-40 through PF-44.

### New: AI Curation domain (32)

Added `32_AI_CURATION.md` — AI set planning (the Sterling session workflow),
AI transition suggestions, spectral clustering, micro-structure suggestions,
vibe analysis, energy arc optimization. All running locally via Ollama /
llama-cpp-python. Planned features PF-50 through PF-56.

### Updated: Out of scope

Added OOS-9: no cloud-based AI processing — all AI runs locally.
Clarified OOS-5: Klangkurator does not replace Rekordbox.

### Refined: Architecture — FastAPI over PyWebView JS bridge

Updated `02_SYSTEM_CONTEXT.md` and `ROAD_TO_MVP.md` to clarify the architecture
decision: FastAPI on localhost (not Smartimize's `window.pywebview.api` JS bridge).

Rationale: FastAPI enables a future browser/mobile companion version without
rewriting the frontend. The same React app talks to `fetch('/api/...')` whether
it's in PyWebView, a browser, or on a phone pointed at a home server.

PyWebView's native file dialog is still used for folder selection when available
(hybrid approach). Browser File System Access API is the fallback.

### New: Browser / Mobile Companion roadmap

Added Phase 3 (future) to `02_SYSTEM_CONTEXT.md`: browser/mobile companion with
read-only library access + set planning. No audio files on device — metadata and
notes only. FastAPI makes this a deployment change, not a rewrite.

Added PF-60 through PF-63 to `92_PLANNED_FEATURES.md`.
Added OOS-10: no mobile audio playback (metadata + notes + set planning only).