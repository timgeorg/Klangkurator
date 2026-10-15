---
tags:
  - plan
  - track-map
status: draft
created: 2026-10-15
source: session
---
# Technical plan — track map (issue #8)

The requirements are [33_TRACK_MAP.md](../requirements/33_TRACK_MAP.md)
(PF-81). This plan is what implementers build from: the decisions with their
sources, the types fixed between phases, the exact similarity, cluster and
transition rules, and the phases, each one PR into `int`.

Phase 0 (branch `docs_8_canvas-spec`) is the spec, this plan and the behavior
contract. Every later phase gets its own branch `feature_8_<phase-slug>` off
`int`. PR bodies say `Refs #8`, never `Closes #8`: the issue stays open until
the last phase is released to `main`, and is then closed by hand.

## Decisions

### Recorded in issue #8

| Decision | When |
|---|---|
| One canvas holds computed similarity, authored relationships and transitions | 2026-10-14 |
| Similarity is the map's own symmetric, user-weighted metadata composite, not PF-42 or PF-52 | 2026-10-14 |
| Whole-track `waveform_peaks` rejected; audio similarity is phrase-level, under PF-52 | 2026-10-14 |
| Fullscreen view on its own route, the alternative library view | round two |
| Renderer: `react-force-graph-2d` + `d3-force`, replacing `SongRelationshipGraph` | round two |
| Computed client-side; every change re-solves; no stored matrix | round two |
| The dialog stays, as a small instance of the same canvas; continuing into the map carries its core as editable filters, anchored on the core | round two |
| Inputs, weights and modes in a side rail; weights persist like other saved UI state | round two |
| Graph keyboard navigation deferred; arrow keys to the nearest node when it comes | round two |
| Transitions: one edge kind from many sources, deduplicated, with provenance | round two |
| Clusters past a node threshold; thresholds tested, not guessed; group-by fallbacks | round two |

### Tim's answers of 2026-10-14 late (chat, verbatim)

These are not in the issue yet; the phase 0 PR body carries them too.

| # | Question | Answer |
|---|---|---|
| 1 | Does PF-42 still block the map? | "no , no blocker anymore" |
| 2 | Screen space at 1280 px (sidebar + rail + 320 px player panel) | "playerat the bottom minimal layout, sidebar can be collapsed, canvas filters and tools can also be collapsed. Else, it is accepted, that space gets small." |
| 3 | Which dimension clusters? | "ah yes, many CAN cluster, but have different prioroty. genre, bpm ranges, subgenres, energy rating can cluster for now. Priority depending on how many nodes exist and how many clusters that would create. Different algorithms and parameters need to be tested, but this is the mechanism I want." |
| 4 | Tags and subgenres are multi-valued | "Tags can be filters then and not create clusters, only filter." |
| 6 | Dialog click (re-centre) vs map click (select) | "no, behavior should be similar"; then chose: click selects and shows details in both, re-centring becomes a panel action |
| 7 | The force re-layout outlasts the 150–220 ms motion rule | "yes" (one named exception, starting from the current positions, a jump under reduced motion) |
| 8 | vitest as a dev-only dependency | "okay" |
| 9 | BPM band width | "BPM width in bins of 10" |
| 10 | Camelot key distance, BPM ratio with half/double folding, 0 = unrated excluded, tags by overlap, missing values skipped per pair | "yes, key least important, more is bpm, tags, relationships :)" |
| 11 | Is A→B a different transition from B→A? | "yes, transition dedup!" |
| 12 | Phones | "yes, no phone view for now. KMaybe a cloud version of this tool will follow later, where you can also browse everything from your phone, but not in the scope for now." |
| — | Play on a map node | chose "Run of one" |
| — | Subgenre clusters | chose "First subgenre" (tracks without one fall back to the main genre) |
| — | Phase 0 | chose "write it now" |

### Tim's answers to the open questions (2026-10-15, verbatim)

| # | Question (as asked, with its default) | Answer | How the plan reads it |
|---|---|---|---|
| 1 | Do search and filters carry across the Table \| Map switch? Default: no, each view keeps its own | "yes!" | Both ways: one shared search and filter state for the session |
| 2 | May a partial map reach `main`? Default: no; the route exists from phase 3 for testing, the entry points turn on in phase 7 | "true." | Read as agreeing with the default: no partial map on `main`, entry points in phase 7. Correct this if "true" meant the opposite |
| 3 | A large library with no genre, BPM, subgenre or energy cannot cluster. Default: the first tracks with a notice; alternative: the crate as a fifth dimension | "fine. Create also a viable fallback." | The notice stays as the last resort, after two fallback dimensions: crate, then the artist's first letter *(proposed)* |

Everything marked *(proposed)* below is Sterling's starting value, to confirm
in review or to measure in phase 6.

## Verified facts (2026-10-15, on `int` 288b8d4, rechecked in the plan review)

1. The relationship graph is a hand-rolled 2D canvas,
   `src/components/dj/SongRelationshipGraph.tsx`, opened in
   `SongRelationshipsDialog.tsx` (whose list view re-centres on a row click,
   `:273-274`). Its line styles live in `src/lib/relationshipStyle.ts`; the
   spec is `14_RELATIONSHIPS.md` › Graph View.
2. No graph or layout library is installed; Recharts is charting only.
3. Smartimize's pattern (`/home/tim/Vault/Repositories/Smartimize/smartimize-app-ui`):
   - `react-force-graph-2d` ^1.29.1, `d3-force` ^3.0.0 and
     `@types/d3-force` ^3.0.10 (`package.json:46,50,59`)
   - the layout runs headless in
     `src/components/knowledge-graph/graph/layout.ts` (`layoutGraph`, `:35`):
     link, many-body, centre, radial and collide forces, positions seeded on
     a golden-angle spiral, anchors for "group by"
   - the renderer stays cold and only draws:
     `cooldownTicks={1} warmupTicks={0} d3AlphaDecay={1}
     d3VelocityDecay={1} enableNodeDrag={false}` and `autoPauseRedraw={false}`
     (`src/components/knowledge-graph/canvas/KnowledgeGraphView.tsx:646-652`),
     nodes pinned with `fx`/`fy`
     (`:137-144`), `zoomToFit` after the first paint (`:611`, `:661`), custom
     `nodeCanvasObject` / `linkCanvasObject` (`:249`, `:313`)
4. Data comes through `src/lib/storage.ts`: `getSongs()`, `getTags()`,
   `getSongTags()` (joins), `getSongRelationships()`, `getBlocks()`,
   `getSets()`. Field names stay as the storage types have them.
   `danceability`, `energy` and `social_acceptance` are 0–5 with one decimal;
   0 means unrated. `bpm` and `musical_key` can be missing or 0. Keys may be
   short (`Am`, `C#`), long or Camelot (`11_SONG_MODEL.md:27`;
   `isMinorKey` in `src/lib/trackFormat.ts:63`, comment at `:59-62`, already
   reads all three).
   The table's genre is `trackGenre()` (`mainGenre`, else `genres[0]`, else
   `genre`); a genre's user colour comes from `getMainGenreColor(name)`
   (`src/lib/genreData.ts:80-115`, by exact name).
5. Transitions live in three places: relationships of type `transition`
   (`notes`), `BlockSong.transition_notes` (on the earlier track) and
   `SetItem.transition_notes` (on the earlier item). The shipped set editor
   reads the flat `items`, not `phases`. `tracksOf` and `blockTracks` in
   `src/components/sets/setModel.ts` drop missing tracks, so they cannot be
   used where a gap must break a chain.
6. The library's filter state is `FilterState`
   (`src/components/dj/libraryTable.ts:11`); the filtering itself is inline
   in `SongLibrary.tsx` (`filteredSongs`). Column filters are
   `ui/column-filter.tsx`.
7. Saved UI state: `useColumnConfig` (`src/hooks/useColumnConfig.ts`, which
   validates what it reads) and `klangkurator.*.v1` local-storage keys.
8. Design-system canvas rules (`design-system/README.md`): tokens read at
   runtime, `devicePixelRatio`, text after `document.fonts.ready`, redraw on
   theme or cover-mode change, `--data-1…5` series colours, users' own genre
   and tag colours, orange only for "this one". Motion is 150–220 ms
   ease-out, for state only, nothing on page load, off under reduced motion
   (`DESIGN.md:245`, `:398`; README `:71`).
9. The player panel is 320 px (`design-system/tokens/tokens.css:68`,
   `src/index.css:50-57`). The panel or bar choice is made twice, in
   `DJLayout.tsx` (`data-player`, `:32`) and `NowPlaying.tsx` (`mode`,
   `:52`); the dock buttons are at `NowPlaying.tsx:230` and `:308`; the dock
   preference is saved by `setDock`. `play(song)` is a run of one; the
   library's row control toggles pause on the current track
   (`SongLibrary.tsx:233`).
10. The app's mobile breakpoint is 768 px (`src/hooks/use-mobile.tsx:3`).
11. No frontend test runner exists. Vite ^5.4, React ^18.3, TypeScript ^5.8.
    vitest 5 needs Vite ≥ 6 (an `npm install` resolution error); vitest
    ^3.2 resolves.
12. `PRODUCT.md` › Evidence on Hand: the real 92 tracks have BPM, key, year,
    duration and covers, but no ratings, tags, relationships, blocks or sets
    yet. `mainGenre` and subgenres are curated by hand; the scanner fills
    `genre` only from a file tag (`backend/scanner/metadata.py:49`). Until Tim
    adds more, similarity on the real library rests on BPM and key, plus
    genre where a file tag gave one.

## Modules and files

| File | Role | Phase |
|---|---|---|
| `src/lib/trackMap/types.ts` | Shared types and `DEFAULT_INPUTS` (below) | 1a |
| `src/lib/trackMap/features.ts` | Song + tags → `TrackFeatures`: key parsing (all notations), `trackGenre`, numbers ≤ 0 → missing | 1b |
| `src/lib/trackMap/similarity.ts` | Per-input similarity, composite, overlap rule, nearest tracks | 1b |
| `src/lib/trackMap/connections.ts` | Who is connected to whom (relationships + transitions), undirected | 1b |
| `src/lib/trackMap/transitions.ts` | Transition facts with gaps, dedup per direction, sources | 1b |
| `src/lib/trackMap/clusters.ts` | `groupKey`, dimension choice, cluster features, node building | 1b (`groupKey`), 6 |
| `src/lib/trackMap/buildModel.ts` | Shown tracks + inputs → `MapModel` | 1b (tracks), 6 (clusters) |
| `src/lib/trackMap/syntheticLibrary.ts` | Seeded generator of N fake tracks, with the phase 6 fixture flags | 1b, 6 |
| `src/lib/trackMap/measure-track-map.ts` | Phase 6 scale harness: re-solve at 500 / 1,000 / 5,000 (dev-only) | 6 |
| `src/components/map/rail/ClustersSection.tsx` | The Clusters section: dimension, reason, list with counts | 6 |
| `src/lib/trackMap/layout.ts` | `solveLayout`: headless d3-force, seeded, warm start | 2 |
| `src/components/map/TrackMapCanvas.tsx` | The cold renderer, used by the dialog and the page | 2 |
| `src/components/map/TrackDetails.tsx` | Selected-track details, compact (dialog) and full (map rail) | 2, 3 |
| `src/components/dj/SongRelationshipsDialog.tsx` | Graph tab on `TrackMapCanvas`; Open in map | 2, 4b |
| `src/components/dj/SongRelationshipGraph.tsx` | Deleted | 2 |
| `src/pages/TrackMap.tsx` | The `/map` page | 3 |
| `src/components/map/rail/*.tsx` | One file per map rail section | 3–6 |
| `src/hooks/useMapConfig.ts` | Saved inputs, layers, collapse states (`klangkurator.map.v1`), validated on read | 4a |
| `src/components/dj/libraryTable.ts` | Gains `filterSongs(songs, songTags, filters, searchQuery)`, extracted from `SongLibrary.tsx` and shared | 4a |
| `src/App.tsx` | The route | 3 |
| `src/components/layout/DJLayout.tsx`, `src/components/dj/NowPlaying.tsx` | Route-derived bar on `/map`, without `setDock`; dock buttons hidden there | 3 |
| `src/components/layout/DJSidebar.tsx` | Library item active on `/map` | 3 |
| `src/lib/LibraryFilterContext.tsx` *(proposed name)* | Search and filters shared by the table and the map for the session, provided above the routes | 4a |
| `src/components/dj/SongLibrary.tsx` | Reads search and filters from the shared context; Table \| Map switch | 4a (context), 7 (switch) |
| `src/pages/SongDetailPage.tsx` | Show on map | 7 |
| `package.json`, lockfile, `vite.config.ts` (`test`), tsconfig for tests, eslint | Dependencies and test set-up | 1a |
| `scripts/make-synthetic-library.ts` | Sandbox `library.json` for a TM-C fixture; reuses `syntheticLibrary.ts` | 6 |
| `00_Index.md` in `src/lib/trackMap/`, `src/components/map/`, `rail/`, `scripts/`; `src/components/dj/00_Index.md` | Folder indexes | as each folder appears; 2 drops the old graph |

## Types fixed up front

Phase 1a merges these first, so phases 1b and 2 can then run side by side:

```ts
// src/lib/trackMap/types.ts
export type MapInput =
  | "bpm" | "tags" | "relationships" | "genre" | "subgenre" | "key"
  | "energy" | "danceability" | "social_acceptance" | "year" | "duration";

export interface InputSetting { enabled: boolean; weight: number } // weight 0.5–3, step 0.5 (proposed); only `enabled` turns an input off
export type MapInputs = Record<MapInput, InputSetting>;
export const DEFAULT_INPUTS: MapInputs; // the spec's default table (proposed)

export interface CamelotKey { n: number; mode: "A" | "B" } // 1–12, A = minor

export interface TrackFeatures {
  id: string;
  bpm?: number;               // missing when absent, ≤ 0 or not finite
  key?: CamelotKey;
  genre?: string;             // trackGenre(), trimmed, lowercased for comparing
  genreLabel?: string;        // display case, for labels and colour
  subgenres: string[];        // lowercased; [0] is the cluster key
  tagIds: string[];
  energy?: number;            // missing when 0 (unrated)
  danceability?: number;
  social_acceptance?: number;
  year?: number;
  duration?: number;          // seconds
}

export type ClusterDimension =
  | "genre" | "bpmRange" | "subgenre" | "energy"   // Tim's four, in priority order
  | "crate" | "artistInitial";                     // fallbacks (answer 3)
export interface ClusterFilter { dimension: ClusterDimension; value: string } // matched by groupKey

export interface TransitionSource {
  kind: "relationship" | "block" | "set";
  id: string;
  name?: string;              // block or set name
  notes: string[];            // unique, in order of appearance
}

export interface MapNode {
  id: string;                 // song id, or a cluster id (opaque)
  kind: "track" | "cluster";
  label: string;
  coverUrl?: string;          // track only
  genreLabel?: string;        // for the user's genre colour
  clusterDimension?: ClusterDimension;
  clusterValue?: string;
  count?: number;             // cluster only
}

export interface MapLink { source: string; target: string; s: number } // undirected, source < target

export interface MapEdge {
  source: string;
  target: string;
  kind: "relationship" | "transition" | "nearest";
  relationshipType?: string;  // relationship: one of the seven non-transition types
  sources?: TransitionSource[]; // transition only
}

export interface MapModel {
  nodes: MapNode[];
  links: MapLink[];           // what the layout uses
  edges: MapEdge[];           // what the renderer may draw
  clusterDimension: ClusterDimension | null;
  unlinkedCount: number;
}

export type Positions = Map<string, { x: number; y: number }>;

export interface TrackMapCanvasProps {
  nodes: MapNode[];
  edges: MapEdge[];           // already filtered by the active layers
  positions: Positions;
  selectedId: string | null;
  playingId: string | null;
  label: string;              // the canvas's accessible name
  onSelect(id: string | null): void;
  onDisplayedPositions?(p: Positions): void; // mid-animation positions, for warm starts
}

export interface TrackMapCanvasHandle {
  zoomIn(): void; zoomOut(): void; fit(): void; reset(): void;
  centreOn(id: string): void;
  zoomLevel(): number;
}
```

## Algorithm contract

Nearest tracks are a top-K selection and the cluster choice is a threshold
rule, so this is the playbook's mandatory algorithm contract: every rule, its
boundaries, and worked examples that phase 1b turns into vitest tests.

### Normalisation

- Numbers (`bpm`, `year`, `duration`): missing when absent, ≤ 0 or not
  finite. Ratings: missing when 0
- Key: case-insensitive; `♯`/`♭` and `#`/`b`; short (`Am`, `F#m`, `Bb`),
  long (`A minor`, `C# major`) or Camelot (`8A`); anything else is missing
- Genre: `trackGenre()`, compared trimmed and lowercased; the display case is
  kept for labels and the user's colour
- Sets (`tagIds`, `subgenres`): an empty set is missing

### Per-input similarity

Each input gives `s ∈ [0, 1]` for a pair, or **skip** when either track lacks
the value.

| Input | Rule |
|---|---|
| BPM | `x = |log2(a/b)| mod 1`, `d = min(x, 1 − x)` (octaves apart after folding half/double time), `s = max(0, 1 − d / 0.2)` *(proposed scale 0.2)* |
| Key | Camelot steps = circular number distance (`min(|n1−n2|, 12−|n1−n2|)`) + 1 if the letters differ; `s = max(0, 1 − steps / 4)` *(proposed)* |
| Genre | 1 if equal, else 0 *(proposed)* |
| Subgenre | Jaccard of the two sets *(proposed)* |
| Tags | Jaccard of the two tag-id sets *(proposed measure)* |
| Energy, danceability, social acceptance (three inputs) | `s = 1 − |a − b| / 5` |
| Year | `s = max(0, 1 − |a − b| / 10)` *(proposed)* |
| Duration | `s = max(0, 1 − |a − b| / 180)`, seconds *(proposed)* |
| Relationships | `R(t)` = tracks connected to `t` (below). `s = 1` if `B ∈ R(A)`; else `0.5 × Jaccard(R(A), R(B))` if both are non-empty; else skip *(proposed)* |

`R(t)`, connections, is undirected for every source: a relationship of any of
the eight types in either direction, and every transition fact (below) in
either direction. Two remixes of the same original share `R = {X}` and score
0.5: partly alike, below a direct connection.

Camelot numbers (enharmonics share a code):

| Code | Minor (A) | Major (B) |
|---|---|---|
| 1 | G#m / Abm | B |
| 2 | D#m / Ebm | F# / Gb |
| 3 | A#m / Bbm | C# / Db |
| 4 | Fm | G# / Ab |
| 5 | Cm | D# / Eb |
| 6 | Gm | A# / Bb |
| 7 | Dm | F |
| 8 | Am | C |
| 9 | Em | G |
| 10 | Bm | D |
| 11 | F#m / Gbm | A |
| 12 | C#m / Dbm | E |

Examples: 8A–8A → 1; 8A–9A → 0.75; 8A–8B → 0.75; 8A–9B → 0.5; 8A–2A → 0.
BPM: 128–130 → 0.888; 87–174 → 1; 120–128 → 0.534; 128–140 → 0.354.

### Composite

- `E` = the enabled inputs; `C(A,B)` = the inputs in `E` that are not skipped
  for the pair
- Missing values are **skipped** (Tim, answer 10):
  `S(A,B) = Σ_{i∈C} w_i·s_i / Σ_{i∈C} w_i`
- *(proposed)* Minimum overlap: the pair is compared only when
  `|C| ≥ min(2, |E|)`; otherwise it has no similarity and can never be linked
- `S` is symmetric. It is rounded to 9 decimals before any comparison
- An enabled input weighs at least 0.5, so a compared pair never divides
  by 0

### Nearest tracks

- `candidates(A)` = every shown track `B ≠ A` with `S(A,B)` defined and `> 0`
- `nearest(A)` = the first `k` of `candidates(A)` by `S` descending, then
  song id ascending. *(proposed)* `k = 8`. Fewer than `k` candidates: all of
  them. None: `A` is unlinked
- Layout links: the undirected union. `{A,B}` is linked when `B ∈ nearest(A)`
  or `A ∈ nearest(B)`, with `s = S(A,B)`
- The details panel's nearest tracks list is `nearest(A)` itself, each entry
  with `S` as a whole percentage *(proposed)*

**Worked example 1** (only BPM on, so `min(2, |E|) = 1`; `k = 1`): A 128,
B 130, C 174, D 87. `S(A,B) = 0.888`; `S(C,D) = 1` (87 and 174 fold
together); A–C, A–D, B–C and B–D are 0. `nearest(A) = {B}`,
`nearest(B) = {A}`, `nearest(C) = {D}`, `nearest(D) = {C}`. Links: A–B
(0.888) and C–D (1). Nothing crosses between the pairs: a similarity of 0
is never a candidate.

**Worked example 2** (BPM 3, genre 2 and tags 3 on, the rest off, so at
least 2 inputs must compare; `k = 1`): E = {128 BPM, Techno, no tags},
F = {128, Techno, {dark}}, G = {no BPM, House, {dark}}.

- E–F: BPM 1 and genre 1 compare; tags skip. `S = (3 + 2) / 5 = 1.0`
- E–G: only genre compares (one input): not compared
- F–G: genre 0 and tags 1 compare. `S = (0 + 3) / 5 = 0.6`
- `nearest(E) = {F}`, `nearest(F) = {E}` (1.0 beats 0.6),
  `nearest(G) = {F}`. Links: E–F (1.0) and F–G (0.6)

**Worked example 3** (ties; only BPM on): X 120, Y 125, Z 115.2.
125/120 and 120/115.2 are the same ratio, so `S(X,Y) = S(X,Z) = 0.706` after
rounding. With `k = 1`, `nearest(X) = {Y}` (the id breaks the tie); with
`k = 2`, `nearest(X) = {Y, Z}`.

**Worked example 4** (fewer than `k`): three tracks, every pair compared with
`S > 0`, `k = 8`:
each track's nearest list holds the other two.

**Worked example 5** (a zero): a track with `bpm` 0 has no BPM. Its pairs
skip BPM and are compared on their other inputs; nothing becomes `NaN`.

### Clusters

The rule *(phase 6 fixed the numbers; the harness and the measurements are in
[Phase 6 — the scale measurement](#phase-6--the-scale-measurement) below)*:

- `N` = the shown tracks (after filters, the core and cluster filters);
  `T` = node threshold, **fixed 500**
- `N ≤ T`: tracks, no clusters. `N > T`: clusters
- Group keys (`groupKey(track, dimension)`):
  - genre: the lowercased genre, labelled in its first-seen case, or
    "No genre"
  - BPM range: `lo = floor(bpm / 10) × 10`, the bin `[lo, lo + 10)`,
    labelled "120–130"; or "No BPM"
  - subgenre: the first-listed subgenre (lowercased), else the genre key,
    else "No genre"; labels in their first-seen case
  - energy: "Unrated" for 0, "Below 1" under 1, else `floor(energy)` 1–5
  - crate (fallback): the track's `root_folder`, or "No crate"
  - artist initial (fallback): the first letter of the artist, uppercased,
    A–Z; anything else (digits, symbols, an empty artist) is "#"
- Choice: try genre, BPM range, subgenre and energy in that order. For each,
  count the groups `c`. Take the first with `C_MIN ≤ c ≤ C_MAX` (**fixed 4
  and 60**). A dimension with `c ≤ 1` is never taken. If none fits, take the
  one nearest the band by `|ln(c / C_MIN)|` below it or `|ln(c / C_MAX)|`
  above it, ties by order
- Fallback (Tim, answer 3): if none of the four has `c ≥ 2`, try crate,
  then artist initial (fixed), and cluster by the first with `c ≥ 2`
  (the band rule does not apply here: any split helps). If both have
  `c ≤ 1` too, show the first `T` tracks by title, with a notice that the
  rest need filtering
- Choosing a cluster and the choice running again (below) go through the
  fallbacks as well, so a crate cluster that is still too big splits by
  artist initial
- Choosing a cluster adds a `ClusterFilter`. It keeps exactly the tracks
  whose `groupKey` for that dimension equals the value, so the reveal shows
  the cluster's members and no one else. If still `N > T`, the choice runs
  again over the remaining dimensions. Each `ClusterFilter` shows as a
  removable chip; removing it runs the choice again, which brings the
  clusters back
- Cluster similarity, for the layout over clusters: cluster features are the
  median BPM, the most common genre, the subgenres and tags that at least
  25 % of the members carry, the mean of the rated values, the most common
  key, and the union of the members' connections (a cluster is never
  directly connected, so only the shared-connections half of the
  relationships rule applies). They go through the same rules, with
  `k = min(8, c − 1)`

**Worked examples:**
- `N = 500` gives tracks; `N = 501` gives clusters
- `N = 1,200` with 9 genres: genre
- 2 genres and BPMs from 90 to 180: genre fails (`c = 2`), BPM range gives
  `c = 10`: BPM range
- Band edges: `c = 3` fails, 4 passes, 60 passes, 61 fails
- Fallbacks: 1,200 tracks without genre, BPM, subgenre or energy, in 12
  crates: crate. The same in one crate: artist initial. One crate and one
  artist: the notice
- Nothing fits: genre `c = 2` (distance 0.693), BPM range `c = 3` (0.288),
  subgenre `c = 75` (0.223), energy `c = 1` (never taken): subgenre

### Transitions

- Facts, each `(from, to, source, note?)`:
  - every relationship of type `transition`: `source_song_id →
    target_song_id`, its `notes`
  - every pair of consecutive tracks in a block (by `position`), with the
    earlier entry's `transition_notes`
  - every pair of consecutive tracks in a set's flat `items` (by
    `position`), blocks expanded in place. Inside a block the note is the
    block entry's; at an item boundary it is the earlier `SetItem`'s
    `transition_notes`. `phases` are not read
- A gap breaks the chain: a missing song, a missing block, or a missing song
  inside a block ends one run and starts the next; its neighbours never pair
  up. A pair whose `from` equals its `to` is skipped
- Dedup by `from→to`: one edge per direction. Its sources: one per
  `(kind, id)`, notes merged (unique, in order of appearance), ordered
  relationship, block, set, then by name and id

**Worked examples:**
- A relationship T1→T2 ("echo out"); block B = [T1, T2], with "filter swap"
  on T1; set S = [S1, block B, S2]. Facts: T1→T2 from the relationship, the
  block and the set; S1→T1 and T2→S2 from the set. Edges: **T1→T2** with
  sources relationship, block B ("filter swap") and set S ("filter swap");
  **S1→T1** and **T2→S2** with set S
- Set [S1 (note "drop on the 1"), block B]: S1→T1 carries "drop on the 1"
- Set [S1, (deleted track), S2]: no S1→S2

### Layout

- `solveLayout(nodes, links, seeds)` returns `Positions`. Nodes are sorted by
  id before solving, so the same input gives the same output
- Forces *(proposed; phase 2 tunes them on the real library)*: link distance
  `30 + 120 × (1 − s)` and strength `s`; many-body charge −120 with
  `distanceMax` 600; a weak centre (0.05); collide by node radius + 2
- Seeds: the positions on screen (mid-animation positions count). A new node
  starts at the mean of its linked neighbours' seeds, else on a golden-angle
  spiral over the new nodes in id order
- `simulation.stop()`, then 300 synchronous ticks *(proposed)*. d3-force v3
  draws its jiggle from a fixed-seed generator, so the result is deterministic
- Unlinked nodes feel only charge and centre, so they settle at the edge

## Data flow trace

```
storage.getSongs()             Song[]       → features.ts  → TrackFeatures
storage.getSongTags()          SongTag[]    → tagIds per song
storage.getTags()              Tag[]        → names and colours for filters and details
storage.getSongRelationships() ┐
storage.getBlocks()            ├→ transitions.ts → transition edges + facts
storage.getSets() (items)      ┘→ connections.ts → R(t)
filterSongs(search + filters from LibraryFilterContext) + core + ClusterFilters → shown ids → N
N ≤ T: similarity.ts → nearest → links      N > T: clusters.ts → cluster nodes + links
buildModel → MapModel → layout.ts solveLayout(seeds) → Positions → TrackMapCanvas (cold, pinned)
```

- IDs are song ids throughout; cluster nodes carry `clusterDimension` and
  `clusterValue`, so no id is ever parsed
- A missing field becomes `undefined` and is skipped; nothing becomes `NaN`
- The map never writes to the backend. After the Edit dialog saves, the page
  reloads its songs (the dialog's `onSaved`) and re-solves
- `/map?core=<id>`: the core is that song and its relationship partners,
  recomputed on arrival, so a reload keeps it; removing the core chip
  removes `core` from the URL

## Hook ordering (PM-8)

`src/pages/TrackMap.tsx`, consumers after their dependencies:

1. Data state (songs, tags, songTags, relationships, blocks, sets, status), a
   load effect and a `reload` callback
2. `features = useMemo([songs, songTags])`
3. `connections`, `transitions = useMemo([relationships, blocks, sets, songs])`
4. `config = useMapConfig()`
5. Search and filters from the shared `LibraryFilterContext`; core and
   cluster filters: page state
6. `shownIds = useMemo([songs, songTags, filters, searchQuery, core, clusterFilters])`
7. `model = useMemo([shownIds, songs, features, config.inputs, connections, transitions])`
   (`songs` gives the node labels and covers).
   Layers and collapse states are not dependencies, so toggling a layer never
   re-solves
8. `seedsRef` (the canvas reports displayed positions into it), then
   `positions`: state, set by a solve effect keyed on `model`
9. Selection state and its URL effect, then the callbacks that read it
10. `visibleEdges = useMemo([model.edges, config.layers, selectedId])` for the
    renderer

`TrackMapCanvas`: props, then refs (graph, displayed positions, animation),
then the animation effect keyed on `positions`, then the theme observer, then
the draw callbacks, which read the refs above them.

Weights commit on release (the slider's `onValueCommit`); switching an input
on or off commits at once.

## Interaction semantics (PM-7)

| Element | Action | Result | Carried |
|---|---|---|---|
| Track node | click | Selects it and shows its details; clicking it again keeps it selected | song id |
| Empty canvas | click | Clears the selection | — |
| Esc | key | Clears the selection *(proposed)* | — |
| Track node | hover | Highlights it and its edges in the foreground colour; the rest dims | — |
| Cluster node, or a Clusters list entry | choose | Adds a `ClusterFilter`; the map re-solves | dimension, value |
| Nearest, transitions or partners list entry | click | Selects that track and pans to it *(proposed)* | song id |
| Details: Play | click | `play(song)`: a run of one. On the playing track: pause and resume *(proposed)* | song |
| Details: Properties | click | Opens the Edit dialog; on save the map reloads and re-solves | song |
| Details: Song page | click | `/song/:id` | song id |
| Details: Show its relationships | click | Dialog: re-centres, with back history. Map: the core becomes that track and its partners, replacing any core *(proposed)* | song id |
| Dialog: Open in map | click | `/map?core=<id>` | song id |
| Map rail: input switch | change | Recompute and re-solve; the nodes move in one 400 ms animation *(proposed)*, or jump under reduced motion | — |
| Map rail: weight | release | As above | — |
| Map rail: layer switch | change | Shows or hides that edge kind; no re-solve | — |
| Map rail: filters, core chip | change | The shown set changes; re-solve, animated like above | filter state |
| Map rail, sections | collapse | The map takes the freed width; collapse states persist | — |
| Toolbar | click | Zoom in, zoom out, fit, reset; the zoom level shows as text *(proposed)* | — |
| Selecting a track | — | Replaces `?focus=` in the URL *(proposed)* | song id |
| `/map?focus=<id>` | load | Selects and centres that track; an unknown id shows a notice | song id |

## Phases

Each phase is one PR into `int` (`Refs #8`), with its clauses in
[TRACK_MAP_BEHAVIOR_CONTRACT.md](TRACK_MAP_BEHAVIOR_CONTRACT.md), the repo's
gates, and its doc updates: resolved *(proposed)* flags, `Last Updated`, the
changelog.

| # | Builds | Done when | Needs |
|---|---|---|---|
| 1a | `types.ts` with `DEFAULT_INPUTS`; dependencies `react-force-graph-2d` ^1.29.1, `d3-force` ^3.0.0, `@types/d3-force` ^3.0.10, dev `vitest` ^3.2; `npm test`; vitest config; test files kept out of `tsconfig.app.json`; folder indexes | All gates and one vitest smoke test pass. Merged before 1b and 2 start | 0 |
| 1b | `features`, `similarity`, `connections`, `transitions`, `groupKey`, `buildModel` (track mode), `syntheticLibrary` | Every worked example and edge case above passes as a vitest test; nearest tracks for 500 synthetic tracks in under 1 s | 1a |
| 2 | **Spike first:** a pinned, cold `react-force-graph-2d` with a 400 ms position animation: smooth, idle CPU near zero, and rendering in the PyWebView window. Then `layout.ts` with vitest (the same input gives the same positions; linked pairs end closer than unlinked pairs; a re-solve with nothing changed barely moves; unlinked nodes at the edge); `TrackMapCanvas`; `TrackDetails` (compact); the dialog on the new canvas (pre-selected song, partners list, Show its relationships with history, no Open in map yet); `SongRelationshipGraph.tsx` deleted (if the spike fails, stop and ask Tim, and keep it); `14_RELATIONSHIPS.md` › Graph View rewritten; bundle size recorded here | Contract TM-D1–D5 | 1a (types), parallel to 1b |
| 3 | Route `/map` (no visible entry yet, answer 2); bar on `/map` from the route, without `setDock`; app sidebar Library item active; the page at default inputs; the map rail with the selected track (full details, nearest, transitions, actions); toolbar with the zoom level; `?focus`; Play and its toggle; Esc; loading, error, empty and below-768 states; the unlinked count in a status line at the top of the map rail; until phase 6, `N > T` shows the first `T` tracks with a notice. Calibration: record the spread of `S` and a screenshot on the real 92 tracks here | Contract TM-M, TM-S | 1b, 2 |
| 4a | The shared `LibraryFilterContext` (the table moves its search and filters into it); `useMapConfig`, including the `layers` slice (all on) that phase 5 uses; the Similarity section (switch and weight 0.5–3, step 0.5, per input; Reset); `filterSongs` shared with the library; the Filters section on `ui/column-filter.tsx`; the all-off and no-match (Clear filters) states; collapsing the rail and its sections | Contract TM-R1, TM-R3–TM-R11 | 3 |
| 4b | The `?core=` hand-off and the core chip (the dialog's Open in map button comes in phase 7); Show its relationships on the map; the 400 ms re-layout animation and reduced motion; the motion exception written into `DESIGN.md` and `design-system/README.md` | Contract TM-R2, TM-H1–TM-H3 | 4a |
| 5 | The Layers section; relationship edges (seven types, side by side when a pair has several); the transition layer with labels on selection; the nearest layer; the legend (computed and authored) | Contract TM-L | 4a (parallel to 4b: separate section files) |
| 6 | `clusters.ts`: the choice rule, `ClusterFilter`, cluster features, cluster nodes, the Clusters section, the fallbacks (crate, artist initial) and the last-resort notice (answer 3); `scripts/make-synthetic-library.ts` (run with `npx vite-node`) writing a sandbox `library.json`; measurements at 500, 1,000 and 5,000 tracks in Chromium and in the PyWebView window; `T`, `C_MIN`, `C_MAX` and the TM-C8 limits fixed here and in NFR-12; a web worker only if the numbers need one | Contract TM-C | 4b, 5 |
| 7 | Entry points on (Table \| Map switch, Open in map, Show on map); no partial map reaches `main` before this (answer 2); `33_TRACK_MAP.md` to Active, remaining flags resolved; `PRODUCT.md`, `DESIGN.md`, `README.md`; impeccable audit; 1440, 1280, 768 and 375 px in both themes (375: the notice and the dialog); the whole contract; `int` → `main`; close #8 by hand | Contract TM-E and all clauses | all |

### Phase 3 calibration — the spread of `S` on the real 92 tracks

The plan asks for this measurement in phase 3, on a **sandbox copy** of the
library (never the real one, AGENTS.md):

```sh
mkdir -p /tmp/kk-sandbox && cp -r ~/.klangkurator /tmp/kk-sandbox/.klangkurator
npx vite-node src/lib/trackMap/calibrate.ts -- /tmp/kk-sandbox/.klangkurator/library.json
# and a screenshot of /map:
HOME=/tmp/kk-sandbox python -m uvicorn backend.main:app --port 8001
KLANGKURATOR_API=http://127.0.0.1:8001 npx vite --port 8081   # then open /map
```

**Measured 2026-10-15** on a fresh sandbox copy of the real library
(`/tmp/kk-sandbox-clean`, 92 tracks, 4186 pairs — no fixtures present):

| Figure | min | median | max |
|---|---|---|---|
| Pairwise `S` (all 4186 compared pairs) | 0 | **0.4808** | 1 |
| Each track's nearest-neighbour `S` | **0.4413** | **0.9773** | 1 |
| Pairs compared / not compared | 4186 / **0** | | |
| Tracks with no nearest track (unlinked) | **0** | | |

Coverage at the default inputs: BPM 92, key 92, **genre 75**, subgenre 4,
**tags 66**, ratings 1. Two readings matter. First, fact 12 was narrower than
the library: `trackGenre()`'s fallback over the deprecated `genres`/`genre`
fields finds a genre on 75 of 92, and 66 carry phase/vibe tags — so the map has
more to work with than the plan assumed, and it does not collapse to a
BPM/key-only map. Second, **every pair compares and nothing is unlinked** —
which also means the min overlap rule (`min(2,|E|)`) rarely bites here.
Nearest-neighbour `S` sits high (median 0.977): on a library of one crate of
similar techno, most tracks have a near-twin, which is the honest result, not a
defect. The layout will read as tight neighbourhoods of near-identical tracks
with the outliers spread — checked visually below.

`/map` screenshot (1440 px, sandbox): the page renders "Map of 92 tracks", the
toolbar shows its zoom level ("143%"), the status line reads "92 tracks on the
map, 0 unlinked", and `/map?focus=<id>` selects and centres the track with its
full details in the rail (TM-M2, TM-M3, TM-M9). No console errors.

Read it against fact 12: the real tracks carry BPM, key, year, duration and
covers, and no ratings, tags, relationships, blocks or sets. So at the default
inputs a pair compares on the inputs both tracks carry — **BPM and key plus
genre where a file tag gave one**, and nothing else, because relationships and
tags skip for every pair and the ratings are unrated. The pairwise spread will
therefore sit high and narrow, and the layout reads as a BPM/key
neighbourhood map rather than a genre map until Tim adds ratings, tags and
relationships — which is the phase 6 question, and the phase 7 check of the
whole contract. The measurement itself reads only the library JSON, so it
needs no backend; the screenshot is the dispatcher's, at 1440 px in both
themes.

## Tests and gates

- The repo's gates (`AGENTS.md`): `tsc`, `eslint` on changed files, `pytest`,
  `vite build`, and the live check of every changed view in both themes at
  1440, 1280, 768 and 375 px. At 375 the map shows its notice; the dialog
  works in full
- From phase 1a: `npm test` (vitest) for `src/lib/trackMap/`
- Sandboxes as in `AGENTS.md`. Fixtures for the contract are set through the
  backend API on a sandbox copy (`PUT /api/songs/<id>`, tags, relationships,
  blocks, sets). The large libraries of phase 6 come from
  `scripts/make-synthetic-library.ts`, written into a sandbox HOME, never the
  real library

### Phase 6 — the scale measurement

`T`, `C_MIN` and `C_MAX` are **fixed** here (they are phase 1b's starting
values, and the choice tests assert them):

| Constant | Value | Why |
|---|---|---|
| `T` (node threshold) | **500** | `N ≤ T` solves the O(N²) similarity: 500 tracks are 124,750 pairs, comfortably inside the re-solve budget (phase 1b's own test asserts 500 tracks in under 1 s). Above it the map clusters, so the worst case stays at `T`, and the cost above it is O(N) to group plus O(c²) over `c ≤ C_MAX` clusters — the plan's "main-thread cost is bounded by T" |
| `C_MIN` | **4** | Below four groups a split is barely a map; the nearest-band rule covers the gap |
| `C_MAX` | **60** | Above sixty the cluster map itself becomes the hairball; the nearest-band rule pulls it back |

The TM-C8 limits are **fixed at the starting values**: the 95th-percentile pan
frame **≤ 33 ms** (about two frames at 60 Hz, the app's motion rule's own
grain) and a re-solve **≤ 3 s**. `src/lib/trackMap/measure-track-map.ts`
measures the re-solve (model + layout, the CPU-bound half of a change) at 500,
1,000 and 5,000 tracks:

```sh
npx vite-node src/lib/trackMap/measure-track-map.ts
```

The pan-frame figure is a renderer measurement and belongs to Chromium, on a
sandbox library at each size:

```sh
mkdir -p /tmp/kk-sandbox && npx vite-node scripts/make-synthetic-library.ts -- --count 5000 --out /tmp/kk-sandbox/.klangkurator/library.json
HOME=/tmp/kk-sandbox python -m uvicorn backend.main:app --port 8001
KLANGKURATOR_API=http://127.0.0.1:8001 npx vite --port 8081   # then open /map and record a 3 s pan
```

**A web worker is not needed.** The re-solve is bounded by `T` (above), so the
one synchronous cost a change can pay is the O(T²) similarity at exactly 500
tracks, which phase 1b's perf test already holds under its own budget; the
clustered path is O(N) + O(c²). A worker would add a message-passing hop and a
second copy of the model for a cost that is already inside the frame budget's
own order — and the canvas's animation is fed from the solved positions, so a
worker would only move the same work off-thread without changing what the user
sees. This is confirmed or overturned by the numbers below.

**Measured 2026-10-15** (headless Chromium, sandbox synthetic libraries,
`--genres 9`, seed 41, default inputs; re-solve = `buildModel` + `solveLayout`
from no seeds):

| Tracks | Nodes | Dimension | Links | Re-solve median | Re-solve p95 | 95th-pct pan frame |
|---|---|---|---|---|---|---|
| 500 | 500 | tracks | 2,474 | **1,341 ms** | 1,405 ms | **16.7 ms** (p50 16.7, max 20.2) |
| 1,000 | 9 | genre | 36 | **12.7 ms** | 16.9 ms | — (clustered; the same 9 nodes) |
| 5,000 | 9 | genre | 36 | **21.8 ms** | 24.6 ms | **16.9 ms** (p50 16.7, max 20.2) |

Both limits hold with a wide margin: the worst re-solve (500 tracks in track
mode, the O(T²) case) is **1.34 s against the 3 s limit**, and the clustered
sizes are ~13–25 ms; the 95th-percentile pan frame at 5,000 tracks is
**16.9 ms against the 33 ms limit**, i.e. a steady ~60 fps with 9 cluster
nodes. The pan is measured over a 3 s synthetic drag on the canvas
(headless Chromium 156, 1440×900, `--genres 9`, seed 41). The 1,000 and 5,000
rows both resolve to 9 genre clusters, so their pan cost is the same
cluster map — the number that matters at scale. **No web worker**, as argued
above: the measured budget never needs one. `T`/`C_MIN`/`C_MAX` stand.

## Risks and spikes

- **The cold renderer and the animation** are checked at the start of phase
  2, before the renderer's shape is fixed. Smartimize redraws continuously
  (`autoPauseRedraw={false}`); that idle cost matters at 5,000 tracks and in
  WebKitGTK. **PASSED 2026-10-15** on both platforms (harness in `spike/`,
  development-only, untracked): Chromium drew 25 frames in 400 ms (mean
  16.2 ms, ~60 fps) and **0 canvas paints in 2000 ms idle**; the real
  PyWebView window (WebKitGTK, 1280×800) painted the canvas and recorded
  **0 paints in 3000 ms idle**. Keep `autoPauseRedraw` pinned on — it is
  what delivers the zero-idle figure.
- **The PyWebView window** (WebKitGTK) draws canvas more slowly than
  Chromium. The phase 2 spike runs there first, because phase 2 deletes the
  old graph; a failure there would break the dialog until reverted.
  **Cleared 2026-10-15** — the window renders the pinned canvas; deletion
  may proceed. (Note for the record: this sandbox needs
  `GSETTINGS_SCHEMA_DIR=/usr/share/glib-2.0/schemas`, a non-snap
  `XDG_DATA_DIRS`, and `PYTHONPATH=/usr/lib/python3/dist-packages` to open
  the WebKitGTK window from inside the VS Code snap.)
- **Main-thread cost** is bounded by `T`: nearest tracks only for `N ≤ T`,
  clusters above it. Phase 6 measures, and adds a worker only if needed.
  **Fixed 2026-10-15**: `T` 500, `C_MIN` 4, `C_MAX` 60, the TM-C8 limits at
  33 ms (95th-pct pan frame) and 3 s (re-solve), **no worker** — the re-solve
  is O(T²) at worst and O(N) + O(c²) with `c ≤ C_MAX` above it. The numbers
  land in [Phase 6 — the scale measurement](#phase-6--the-scale-measurement)
- **Bundle size** of the new dependencies: recorded in phase 2.
  **Baseline 2026-10-15**: the built main chunk was **607,016 bytes**
  (`dist/assets/index-Dw8AkhD1.js`) before the renderer's modules entered the
  graph; `react-force-graph-2d` and `d3-force` were already installed and in
  `package.json`. **Measured in phase 2, 2026-10-15**: 804,406 bytes
  (`dist/assets/index-S3bFwpjw.js`), **+197,390 bytes (+32%)** with
  `TrackMapCanvas`, `TrackDetails` and `layout.ts` in the graph. The map is
  only ever opened deliberately (the dialog and, from phase 3, `/map`), so
  phase 7 should lazy-load the map route (`React.lazy`) to keep this off the
  library's first paint — carry it as a phase 7 checklist item, not a blocker.
- **Similarity on the real library** rests on BPM, key, genre and subgenre
  until Tim adds genres, tags and ratings (fact 12); the phase 3 calibration shows
  whether the layout reads well on that

## Follow-ups after #8

Journeys, the auto-advance walk and an axis mode. Planned only once #8 ships
(Tim, 2026-10-14). Notes in the vault, `02_Projects/DJ-App/Canvas-Follow-Ups.md`.
