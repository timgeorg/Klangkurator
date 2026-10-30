# Requirements Changelog

Status: Active
Last Updated: 2026-10-31

## 2026-10-31

### Audio variants built: one track, several files (issue #65)

Tim: *"66 ist falsch. Vor allem, wenn es bei dem .wav der selben Version keine
Probleme gab. Wir müssen irgendwas neues noch einbauen, dass es 2 Varianten
(Audio Files) vom gleichen Track geben kann."*

This change builds the mechanism the spec describes. A track keeps one row, and
every other file of the same recording becomes a variant of it.

- **One row, one set entry.** `POST /api/songs/{id}/variants` attaches a file and
  adds no song row. The scan no longer skips a file whose artist and title match
  a stored track without a word. It offers the attach on the Import page, and one
  click applies it. This library holds about 426 files on disk that are not in
  the library. Several of them are second copies. The offer is therefore what
  the later dedupe pass needs.
- **The row shows a count badge.** The Files section lists the primary and every
  variant with format, duration, size and path. *Make primary* swaps the paths
  and keeps BPM, key, ratings, notes and tags. *Detach from track* takes the file
  off the track and leaves it on disk (INV-15).
- **Playback falls back to a variant when the primary's file is gone.** The
  player names the file it used. That is the only case where the primary does not
  play, and INV-17 records it.
- **A half-tempo disagreement shows both numbers, not an average.** The
  re-analyze popup reads `primary 132.0 / variant 66.3` and offers a BPM range
  for the repair. The app picks nothing.
- **Export and import carry the list.** An imported variant keeps its path
  (INV-11). One whose file is not on this machine stays in the list. It shows
  the missing mark, and the import never drops it.
- **New invariants:** INV-16 (a derived fact is never stored) and INV-17
  (playback uses the primary unless its file is gone).
- **`scripts/repair_audio_variants.py` repairs the Levex pair.** That script
  prints a dry run by default and refuses to write without `--apply`. It attaches
  the `.wav` to the `40a2ace1…` row. It drops the emptied `f08a9c70…` row only
  after it confirms that no set, block, playlist or relationship refers to that
  id.

Two places where the built code departs from the written spec, both recorded in
[[18_AUDIO_VARIANTS]]. A variant carries an advisory `bpm_reading`, because the
popup's second number has nowhere else to come from. The duration-based attach
offer also requires a matching title, because a duration alone claimed two
unrelated tracks as one recording.

## 2026-10-30

### A set exports as a Rekordbox playlist (#67)

Tim: *"Ist es theoretisch möglich aus so einem Set eine rekordbox playlist zu
erstellen? Oder wie macht man das normalerweise?"*

Rekordbox imports a playlist from the XML file Pioneer documents, and the app now
writes that file. `GET /api/sets/{id}/export/rekordbox` answers one `NODE` per set,
ordered by the set's own `position`. Each set card carries an export action.

The details that decide whether the import works are the ones the format fixes. A
`Location` is a `file://localhost/` URI, and the writer encodes the space and `#` in
this library's root. `Rating` uses Rekordbox's six values, not a star count. The app
leaves out an attribute it cannot fill, rather than guessing one. A block expands
into its tracks in place, and the set's transition note arrives in `Comments`.

Writing `master.db` stays out of scope. `31a_REKORDBOX_PLAYLIST_EXPORT.md` now reads
"Built", and section 2 of `30_REKORDBOX_INTEGRATION.md` says what the export does.

A measured export of 47 real tracks: 17.5 KB, 11 ms, every `Location` resolves.

### A set can be a pool: the target duration is now removable

Tim: *"Ja, die Länge ist egal. Ein Set ist grade eher mehr ein Pool. Also viel
kann, weniger muss."*

`PUT /api/sets/{id}` dropped every null, so a `target_duration_min` that had been
set could never be taken off again — the pool still claimed a length it did not
have. The endpoint now uses the same rule as a song update: an explicit null
clears an optional field, a field left out is untouched, and a required field
(`name`) ignores a null instead of being blanked. Four tests in
`test_set_update.py`.

The Halloween set therefore carries no target length; its 47 tracks are a pool
along the arc, not a timed plan.

### Rekordbox playlist export specified (proposed)

Tim: *"Ist es theoretisch möglich aus so einem Set eine rekordbox playlist zu
erstellen? Oder wie macht man das normalerweise?"*

- **Yes, through the XML file Pioneer documents** (`XML file format for
  playlists sharing`, version 1.0.0): Rekordbox imports a playlist from it, and it
  is the same file Rekordbox itself exports. New spec
  `31a_REKORDBOX_PLAYLIST_EXPORT.md`, and section 2 of
  `30_REKORDBOX_INTEGRATION.md` points at it.
- **The real constraint is `Location`**: an absolute `file://` URI, so an export
  is bound to the machine and drive that hold the audio (this library lives on
  `/media/tim/Extreme SSD/#MUSIC`, with a space and a `#` to encode).
- **Writing `master.db` is explicitly out of scope** — undocumented schema,
  version-bound, and a bad write corrupts the collection.

### The BPM detector reads the wrong metrical level (issue #66)

Five tracks in the Halloween set were stored at half or two-thirds of their real
tempo: `Bitch Don't Kill My Vibe (Darren After Edit)` at 86.1, `Love The Right Way`
and `Make Believe` at 89.1, `Crazy` and `Pon De Replay` at 63.0 — all really
129.2. Re-analysing with a 125–133 hint returned 129.2 for every one, so the
values are corrected; the fault itself is #66.

- **Root cause:** `analyze_track` calls `librosa.beat.beat_track` with no
  `prior`, and the library-wide job never passes a hint, so nothing steers the
  estimate away from a lower metrical level.
- **Scale:** 271 of the 1,907 tracks sit in a dance crate at 55–100 BPM, which
  is very likely the same fault. The drum & bass crate shows it in the other
  direction: 13 tracks at 86.1 that are really 172.3.
- **Not fixed by a bulk rewrite.** INV-13 stands: the background job only fills
  missing values. The ticket asks for a reviewable repair pass instead.

### Audio variants: one track, several files (proposed, issue #65)

Tim: *"Wir müssen irgendwas neues noch einbauen, dass es 2 Varianten (Audio
Files) vom gleichen Track geben kann. […] Damit werden beide nicht in der
Library gleichzeitig angezeigt."*

- **New requirement `18_AUDIO_VARIANTS.md`.** A track keeps its primary in
  `file_path` and gains `audio_variants` for the other files of the *same*
  recording. One row in the table, one BPM, one set of notes, one set entry.
- **The bug that prompted it:** the same Levex remix was detected at 66.3 BPM
  from the `.mp3` and 132.0 from the `.wav`. The author repaired the `.mp3` by
  hand. The new requirement makes BPM/key a property of the track, analysed once
  from the primary, and makes an octave disagreement a reported case, never a
  silent pick.
- **`INV-14` and `INV-15`** record the two rules that follow: one primary per
  track, and detaching a variant never deletes the file.
- `.wav` files have no embedded artwork and no useful tags, so they are worth
  keeping but are not worth showing as their own rows.

### Add a song to a set from the library and the song page (#64)

Tim: *"I as a user want to be able to add songs to a set from the library and song
view, so I can add a song I'm currently looking at to a set without needing to jump
over to "Sets" first."*

A library row now carries a third icon action beside Play and Edit. The song page
carries an **Add to set** button after Relationships. Both open the same list
of sets, read on open so it is always current. Selecting a set appends the song to
that set's running order. It saves at once with `items` only, so the name, notes
and phases stay as they were. A set that already holds the song, in its flat list
or inside a phase, shows a check mark and cannot be picked.

`addSongToItems` normalises every item to the backend's shape and renumbers the
positions `0..n-1`. A stored set can have gaps. `position: items.length` would then
place the new song before the real end, so the helper counts from the array.

REQ-16-AS is new in `16_SET_PLANNING.md`. The `#` column widened to 84 px to hold
the three actions. A stored narrower width rises to the new minimum on load.

### Typing in the library search stays instant (#68)

Tim: *"Search is also very slow when all tracks are selected. The problem is, that
you cannot type well, because typing is laggy."*

The field was bound to the shared filter query. Every keystroke therefore
re-filtered and rebuilt the matching rows before the next character could show. The field now
stays on the live query and the table follows a deferred copy at low priority,
with no fixed delay. The header count, `aria-rowcount` and the empty-state text
read the same deferred query as the rows, so they always agree with the table. The
deferral stays in the library view. A deferred value in the shared filter context
would drop characters, and the map keeps reading the live string.

Measured on a production build with all tracks selected. The slowest keystroke
went from 1,945 ms to 224 ms. Six characters in a row now stay in order.

REQ-13-ST is new in `13_LIBRARY_VIEW.md`.

### The library table renders 50 rows and adds 50 while scrolling (#63)

Tim: *"I want to see the crates immediately. Tracks can be rendered lazy and more
added only when scrolling."*

The table built every matching row in one React commit. The crate tabs therefore
waited for all 1,907 rows. It now renders the first 50 rows and adds the next 50 when the
sentinel after them comes into view. A new search, filter, crate or sort starts
again at 50 rows and at the top. An inline edit keeps the rows and the scroll
position. The rows stay a prefix of the list, so row numbers stay absolute. The
header count, `aria-rowcount` and the player's run still cover every matching
track, and each rendered row now announces its absolute position.

REQ-13-LR is new in `13_LIBRARY_VIEW.md`. NFR-3 now states a measurable budget
instead of "comfortably".

## 2026-10-29

### Settings and genres into the data folder (#51, PF-89)

Tim: *"I'd also like a file or something that saves all these thigs so they can
be portable as well."*

- **Preferences moved into `~/.klangkurator/settings.json`**, a fourth data file
  beside `library.json`, `blocks.json` and `sets.json` (spec:
  `17_SETTINGS.md`). They used to live only in the browser, so they did not
  travel with the library, vanished when site data was cleared, and the desktop
  window could not keep them. Two endpoints: `GET`/`PUT /api/settings`, the
  latter validating keys and types and refusing a bad write with 422.
- **The genre list moved into `library.json` as `genres`.** Genres are library
  vocabulary like tags, so they belong with the library and inside the backup
  (`12_TAGS_AND_GENRES.md`, `21_DATA_MODEL_LIBRARY_JSON.md`, NFR-2). Importing
  them merges by name; an existing genre keeps its colour.
- **A one-time migration** copies an existing browser's values, genres
  included, before anything renders. A value already in a file wins.
- **An unreadable data file is preserved**, renamed to
  `<name>.corrupt-<timestamp>.json` and logged, instead of being replaced by the
  empty state that followed a read error. This covers every data file.
- **The desktop window keeps its storage** (`private_mode=False` with a storage
  path under the data folder), so it behaves like a browser tab.
- `13_LIBRARY_VIEW.md` REQ-13-CT now stores the crate bar's collapse choice in
  `settings.json` rather than in `localStorage`.

## 2026-10-23

Four specs from Tim's requests — #46, #47, #48, #49 — written before the code,
plan-reviewed, with a technical plan and a behavior contract each in
`docs/plans/`. All three were built the same day (PRs #52–#54), next to the
MCP server (#47, PR #55); the release review's fixes are below (#57).

### MCP server for local agents (#47, PF-85)

Tim: *"Would you need MCP to better interact with Klangkurator? What would MCP
need for that tool?"* A local agent (Claude Desktop, Copilot, Cursor) now has a
spec'd way in: new `34_MCP_SERVER.md` (REQ-34-PR, -TS, -CT, -AX) with a curated
**24-tool** surface over **stdio**, as a thin HTTP client of the running
backend. It holds no state and opens no file under `~/.klangkurator/`, because
`BaseStore._save` writes one shared `.tmp` file — two writers lose data. No
`delete_*` tool: removal stays in the app, where the user sees it. Config
through `KLANGKURATOR_URL`, `KLANGKURATOR_TIMEOUT`, `KLANGKURATOR_READ_ONLY`
and `KLANGKURATOR_ROOTS`; the 10 read tools carry `readOnlyHint`, the 14
others `destructiveHint: false`, all `openWorldHint: false`. Two new
`requirements.txt` entries (`mcp`, `httpx2`), and `backend/` still imports
neither — the app runs with `mcp` absent.

Three backend prerequisites, each useful without MCP: the scan job (#46), the
`slim` listing below, and the widened browse sandbox below.

**Decisions:** `scan_library` has no dry run — an honest preview needs a
backend count-only path, and walking in the server would duplicate the import
rules; the server ships as a top-level `mcp_server/` package in this repo, not
a separate distribution, because the app must run without `mcp`; `update_track`
keeps the existing partial `PUT` (`_CLEARABLE` + `exclude_unset` never blanks a
field) and refuses an empty body, which the backend would accept and write.

### Slim library listing and a browse sandbox that reaches the music (#47)

Two backend changes this spec now requires, both measured on the real library:

- **`GET /api/songs?slim=true`** (REQ-10-SL) returns the same rows without
  `waveform_peaks`. Peaks are 200 floats per track and most (62–71 % across the measurements on record) of the body
  (3,735,141 bytes at 1,907 tracks, 1,187 bytes per track — the issue's 62 %
  was a 499-track sample). The projection runs after validation, so model
  defaults a legacy row lacks are still filled. The app keeps the full rows;
  only an agent asks for slim.
- **`GET /api/library/browse` also allows the configured root** (REQ-10-BW).
  The browser was sandboxed to `$HOME`, so an external-drive library was
  unreachable — `403` on `/media/tim/Extreme SSD/#MUSIC` — while `POST /scan`
  and `PUT /root` took the same path. `parent` is `null` at home and at the
  root; everything else still gets a 403.

### Release review fixes (#57)

A stage-7 review of `int` before the release found, and this change fixes:
- **Import dropped every added track's main genre**: it kept only the model's
  field names, and rows store the alias `mainGenre`.
- **The export carried the retired `danceability`/`social_acceptance`** keys of
  old rows; they are left out (11_SONG_MODEL: never written).
- **MCP ids could leave their route** (`../../<id>` reached
  `DELETE /api/songs/<id>`), and **`export_library` could overwrite any file**,
  also in read-only mode. Ids are checked, and export creates only new `.json`
  files in one folder (34_MCP_SERVER).
- **The Import page could not see a job started elsewhere**, a vanished run
  read as finished, a dead backend froze the bar, and Escape closed the
  progress toast for the whole run (REQ-10-AP).

### Scan and analysis progress (#46, PF-86)

- **Both long jobs run in the background, one at a time.** The folder scan was
  one blocking request with a spinner as its only feedback; it becomes a job
  with `GET /api/library/scan-status` (REQ-10-SP). Scan, library-wide analysis
  and per-track re-analyze now exclude each other in the backend (409).
- **Where progress shows:** on the Import page, and outside it in a closable
  toast (Tim: *"yes, outside, toas with loading bar on library page, if clicked
  away only on the import page"*). Analysis gets **Abort**, which stops after
  the current track (`POST /api/library/analyze-cancel`). A finished scan says
  only "Scan finished" (Tim: *"no, just that it finished, no stats"*).
- **Counters count finished items**, so a job starts at `0 / N` and ends at
  `N / N` (the old analysis counter started at `1 / N`). The never-built
  "elapsed/remaining feel" is dropped from REQ-10-AP.

### People replaces Dance and Social (#48, PF-87)

Tim: *"Dance/Social is too much and add the end means the same."* One 0–5
rating, `people`, replaces `danceability` and `social_acceptance` in the song
model (`11_SONG_MODEL.md`), the JSON example (`21_DATA_MODEL_LIBRARY_JSON.md`),
the library table, filters, sort and keyboard rules (`13_LIBRARY_VIEW.md`), set
planning sort (`16_SET_PLANNING.md`), NFR-11 (`90_NFRS.md`) and the track map,
where it is one input at weight 1 (`33_TRACK_MAP.md`; the TM-M4 contract
clause in `docs/plans/TRACK_MAP_BEHAVIOR_CONTRACT.md` is marked superseded). No
compatibility: the old values are dropped and Tim re-enters them by hand.
`Requirements.md` is frozen as a historical document.

### Crate tabs: collapse and multi-select (#49, PF-88)

New REQ-13-CT in `13_LIBRARY_VIEW.md`. With more than 10 crates, the tab bar
collapses to the first 10 plus every selected crate and a "+N more" toggle.
Shift+click adds a crate to the selection or removes it (A+B+C), using the
Crate filter that was already multi-select underneath. Touch screens get
44 px tabs.

## 2026-10-15

### Track map — the zoom readout and when covers collapse (#31, #33)

Two fixes from using the shipped map:

- **The zoom percentage only moved when a toolbar button was pressed.** The
  canvas reported nothing for a wheel, a pinch or a drag, so the toolbar's
  readout went stale while the map zoomed. The canvas now reports every camera
  change (throttled while moving, exact once it settles) and the readout
  follows.
- **Covers are drawn far longer before they collapse** (Tim: *"album covers can
  be displayed a lot longer, only very late at zoomout they shall be
  collapsed"*). The artwork threshold drops from 1.1 to 0.35, so the covers are
  on at a 92-track map's own fit zoom (~0.42) instead of only very close in; a
  hysteresis band keeps them from flickering around the boundary. The cover
  cache is sized to the map's own track threshold, which it had been smaller
  than — a track-mode map can show up to 500 covers, so the old 400-entry cap
  would have evicted and re-decoded covers every frame.

### Track map — nodes, labels, focus, hover, and the split rail (issues #31–#37)

Seven follow-ups to the track map, all from Tim's 2026-10-15 review of the
shipped canvas:

- **Nodes bigger, with artwork** (#31): a track draws at about twice the size,
  its cover in the centre from a zoom level on and the genre as the outer ring;
  zoomed further out it is the full genre colour, so a large map never draws
  thousands of artworks
- **Every label, in full, at once** (#37): titles wrap instead of being trimmed
  or hidden, draw smaller, and the layout reserves their room through a
  label-aware collision radius — with the link distance above that floor, so
  similarity still reads as distance
- **Double-click plays a track** (#32), a run of one; the first click still
  selects at once
- **A Focus button** (#33) that centres on the selected track and rearranges the
  others around it by similarity, with one code constant choosing both, camera
  only, or re-arrange only
- **Switching from the table focuses the playing track** (#34), with a toast
  when a filter or the core keeps it off the map
- **An instant hover popover** (#35) with the full artist, title, BPM, key,
  duration and tag chips; not on touch
- **Two rails** (#36): similarity, filters, layers and clusters move to the
  left, the selected track stays on the right, and both collapse and persist

### Track map phase 7 — entry points, docs to Active and lazy loading (issue #8, PF-81)

The map becomes reachable, the spec becomes Active, and the renderer leaves the
library's first paint:

- **TM-E1 — the Table | Map switch** (`src/components/layout/LibraryViewSwitch.tsx`),
  a pair of links in the header of both views (the library table and `/map`), in
  the crate-tab pill treatment with the current view in Signal Wash. Both are real
  destinations, so the browser's Back works and the app sidebar's Library item stays
  active on both (TM-M1); the table's search and filters ride the shared
  `LibraryFilterContext` across the switch both ways (TM-R11). Below 768 px the
  switch is left out — the table is the way to browse, and `/map` shows its own
  notice (TM-E4).
- **TM-E2 — Show on map** on the song page (`SongDetailPage.tsx`), a link to
  `/map?focus=<song id>`, which selects and centres that track (TM-M3).
- **TM-E3 — Open in map** on the relationships dialog's graph details: the
  `TrackDetails` action navigates to `/map?core=<the dialog's song id>`, so the map
  opens on that song and its relationship partners as in TM-H1 — the core is
  recomputed from the loaded relationships, shows as a removable chip, and removing
  the chip clears `core` from the URL. The dialog passes the callback only in its
  graph tab, so the action appears exactly where the spec puts it.
- **TM-E4 — narrow screens:** at 375 px the library has no switch, `/map` shows its
  short notice with a link back to the table, and the relationships dialog's graph
  still works (its canvas is unchanged and needs no width-specific path).
- **Lazy loading** (the phase 2 bundle note's phase 7 checklist item): `src/App.tsx`
  now imports `/map` with `React.lazy` under a `Suspense` fallback shaped like the
  map page, and the dialog's graph tab moved into its own
  `src/components/dj/RelationshipGraphTab.tsx`, also lazy-loaded. The renderer's
  modules (`react-force-graph-2d`, `d3-force`, `TrackMapCanvas`, the layout) no
  longer sit in the entry chunk: the build now emits a lazy chunk beside the entry
  chunk. The measured entry- and lazy-chunk sizes come from the gate run and are
  carried in the phase 7 PR body; the plan's bundle note keeps the phase 2
  baseline and the +197,390-byte figure for the comparison.
- **Docs to Active:** `33_TRACK_MAP.md` is now **Active**, and every *(proposed)*
  flag in it and in the plan is resolved — all of them shipped as proposed (the
  route, the entry points, the default weights and their 0.5–3 grid, `k = 8`, the
  minimum-overlap rule, the force constants, the 400 ms re-layout, the interaction
  semantics), and the cluster thresholds were fixed at their starting values by
  phase 6's measurements (`T` 500, `C_MIN` 4, `C_MAX` 60). Two items were **left
  open by decision**: the keyboard navigation of the graph itself stays deferred
  (its scheme is on record, arrow keys to the nearest node), and
  `transition_notes`/alternative transitions/`phase_tags`/`vibe_tags` stay out of
  the MVP (now stated as confirmed rather than proposed). `PRODUCT.md`, `DESIGN.md`,
  `README.md` and `design-system/README.md` name the map and its entry points;
  `13_LIBRARY_VIEW.md` documents the switch and the shared filters;
  `14_RELATIONSHIPS.md` documents Open in map; `92_PLANNED_FEATURES.md` moves PF-81
  to **Built**.
- Tests: this phase adds none — its code is UI wiring (the switch, the two entry
  links, the lazy boundaries) over computation phase 1b already covers. The gate
  results (`tsc`, `eslint` on the changed files, `npm test`, `vite build` and the
  bundle sizes) are recorded in the phase 7 PR body.

### Track map phase 6 — clusters, fallbacks and scale (issue #8, PF-81)

Past the node threshold the map now groups instead of showing every track, and
the fixed numbers behind it are measured:

- `src/lib/trackMap/clusters.ts` gains the phase 6 half. `clusterChoice` returns
  the dimension **and why** (`band`, `nearest`, `fallback`, `lastResort`) for
  the rail's Clusters section, and `buildClusters` builds the cluster nodes and
  links: one node per `groupKey` value, labelled in its display case where there
  is one, carrying its value and count. Cluster **features** are the plan's —
  median BPM, most-common genre and key, the subgenres and tags at least 25 % of
  members carry, the mean of the rated values, and the union of the members'
  connections (so a cluster is never directly connected, and only the
  shared-connections half of the relationships rule applies between clusters).
  Cluster similarity reuses the same rules with `k = min(8, c − 1)`. Every phase
  1b export (`groupKey`, `groupCount`, `chooseClusterDimension`,
  `shouldCluster`, `C_MIN`, `C_MAX`, `DEFAULT_NODE_THRESHOLD`,
  `FALLBACK_DIMENSIONS`) is unchanged, and its tests stay green.
- `src/lib/trackMap/buildModel.ts` gains cluster mode: when `N > T` it returns
  cluster nodes and links instead of tracks, `clusterDimension` and
  `clusterReason` say which dimension and why, and `lastResort` is true when not
  even the crate and the artist could split the tracks — then it shows the first
  `T` by title (phase 3's stopgap becomes this real path, TM-C10). Track mode is
  unchanged, and `linksFromNearest` (new in `similarity.ts`) is the one
  undirected-union build both modes share.
- Cluster filters (`ClusterFilter`): choosing a cluster — in the rail's Clusters
  list or by clicking a cluster node — adds a filter matched by `groupKey` for
  that dimension, keeps **exactly** the members, shows a removable chip in the
  Filters section, and re-runs the choice if still `N > T`; removing the chip
  runs the choice again, which brings the clusters back (TM-C3).
- `src/components/map/rail/ClustersSection.tsx` is the new section: the
  dimension, the reason and the list with counts. Tags are never a dimension, so
  the section can never name them (TM-C5).
- The fallbacks (crate, then the artist's first letter; TM-C7, TM-C9) and the
  last-resort notice (TM-C10) are real paths now, in the cluster module.
- `src/lib/trackMap/syntheticLibrary.ts` gains the fixture flags the contract
  needs (genre/subgenre/crate counts, BPM range, energy spread, artist spread,
  omitted fields); `scripts/make-synthetic-library.ts` (run with `npx vite-node`)
  writes a sandbox `library.json` shaped for one TM-C fixture, **reusing** the
  generator rather than duplicating it. `src/lib/trackMap/measure-track-map.ts`
  measures the re-solve at 500, 1,000 and 5,000 tracks. *(Both scripts live in
  `src/lib/trackMap/` in the phase 6 commit; the dispatcher moves
  `make-synthetic-library.ts` into `scripts/`.)*
- `src/components/map/TrackMapCanvas.tsx` draws a cluster differently: hollow, a
  tinted arc of its genre colour with a hairline outline, sized by count and
  labelled with its value and count, so a group never reads as one track.
- `NFR-12` and the plan fix `T` = 500, `C_MIN` = 4, `C_MAX` = 60 and the TM-C8
  limits (95th-percentile pan frame ≤ 33 ms, re-solve ≤ 3 s); **no web worker**,
  because the re-solve is bounded by `T`.
- Tests: `clusters.test.ts` covers the node level of every contract example —
  the choice at 1,200 in 9 genres → genre; 2 genres + BPM 90–180 → BPM range
  (labelled "120–130"); the band edges 3/4/60/61; a subgenre cluster with a
  track lacking one sitting in its genre cluster; energy last; the crate
  fallback; the artist fallback ("A" keeping only A's); the last resort — over
  the seeded generator. `syntheticLibrary.test.ts` covers the fixture flags.

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