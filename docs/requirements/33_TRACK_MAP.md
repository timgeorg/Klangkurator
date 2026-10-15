# Track Map (Similarity Canvas)

Status: Active
Last Updated: 2026-10-15
Source: issue #8 (brainstorm 2026-10-13, round two 2026-10-14) and Tim's
answers of 2026-10-14 late, quoted verbatim in
[TRACK_MAP_PLAN.md](../plans/TRACK_MAP_PLAN.md) › Decisions

All tracks on one canvas, placed so that similar tracks sit near each other: a
map of the collection by feel, not by folder. The map is the other way to see
the library, beside the table (PF-81).

This spec was drafted with points marked *(proposed)* — Sterling's starting
values to confirm. They are settled now (phase 7, 2026-10-15): the route, the
entry points, the default weights and their 0.5–3 grid, the 8 nearest tracks,
the minimum overlap, the 400 ms re-layout, the cluster fallbacks, the layers,
the dialog's actions and the rail's sections all **shipped as proposed**, and
none was settled differently; the cluster thresholds were fixed at their
starting values by phase 6's measurements. Two things stay open by decision,
and both are marked below: the graph's own keyboard navigation stays deferred,
and a song's `transition_notes` and the phase/vibe tags stay out of the MVP.
Everything else is decided in issue #8, in Tim's late answers of 2026-10-14,
or in his answers to the open questions of 2026-10-15 (all quoted in the
plan).

Two words used throughout: the **app sidebar** is the ink navigation rail on
the left; the **map rail** is the map's own side rail with its controls.

## Scope (REQ-33-SC)

In the MVP:

- The fullscreen map of the whole library, with the map rail for similarity
  inputs, filters, layers, clusters and the selected track's details
- The relationships dialog's graph, rebuilt on the same canvas
- The similarity composite, clusters for large libraries, and the
  relationship and transition layers

Not in the MVP:

- Keyboard navigation of the graph itself. Deferred; the scheme on record is
  arrow keys that jump focus to the nearest node in that direction. The map's
  own controls (map rail, toolbar, panel actions) follow the standing
  keyboard rule from day one
- A phone view (Tim: *"no phone view for now"*); see REQ-33-SV for what
  narrow screens show
- Notes as a similarity input: a later opt-in (`32_AI_CURATION.md`)
- Audio similarity: phrase-level, under PF-52; whole-track `waveform_peaks`
  are rejected as an input
- A song's own `transition_notes`, a set's alternative transitions,
  `phase_tags` and `vibe_tags` as inputs or layers. Confirmed as out of the
  MVP: notes are a later opt-in (`32_AI_CURATION.md`), and the other three
  were never built as inputs or layers
- Cluster naming, add-to-set from the map, and PF-42 compatibility scores.
  PF-42 does not block the map
- The follow-ups planned after #8: Journeys (a chain from one track to
  another), the auto-advance walk across the map, and an axis mode (any two
  properties as X and Y)

## Surface and entry (REQ-33-SV)

- Its own route, `/map`, fullscreen in the main area: the alternative library
  view, not an inset and not a mode of the library page
- Entry points:
  - a **Table | Map** switch in the Library header, in both views; the app
    sidebar's Library item stays active on both
  - **Open in map** in the relationships dialog (REQ-33-DG)
  - **Show on map** on the song page, focusing that song
- `/map?focus=<songId>` selects and centres a song;
  `/map?core=<songId>` starts with that song's core (REQ-33-DG). Both survive
  a reload
- Search and filters carry across the Table | Map switch, both ways: the
  table and the map share one search and one set of filters for the session.
  The core and cluster filters stay on the map
- On the map page the player shows as the bottom bar, the minimal layout,
  without changing the saved dock preference. The app sidebar and the map
  rail both collapse, and so does each section of the map rail. Beyond that,
  a small map area is accepted
- Below 768 px (the app's existing mobile breakpoint) the Table | Map switch
  hides and `/map` shows a short notice with a link to the table. The
  relationships dialog keeps working at every width
- The route is lazy-loaded (`React.lazy` under `Suspense` in `src/App.tsx`),
  and so is the relationships dialog's graph tab, so the map's renderer
  (`react-force-graph-2d`, `d3-force`) never sits in the library's first
  paint; it arrives when the map or the graph tab is opened. The sizes are in
  `TRACK_MAP_PLAN.md` › Risks and spikes › Bundle size

## Similarity (REQ-33-SM)

- The map's own symmetric, user-weighted **metadata composite**, computed in
  the frontend over the fetched library. A change costs no API round trip,
  and no similarity matrix is ever stored. It is neither PF-42 (directional
  transition compatibility) nor PF-52 (phrase-level audio), and it does not
  reuse the transition weights of `31_TRANSITION_MINING.md`
- Inputs, each switched on or off and weighted in the map rail: BPM, tags,
  relationships, genre, subgenre, key, energy, danceability, social
  acceptance; year and duration exist but start off
- Default weights **(shipped as proposed; Tim: key matters least, BPM, tags
  and relationships most)**:

| Input | Default weight |
|---|---|
| BPM | 3 |
| Tags | 3 |
| Relationships | 3 |
| Genre | 2 |
| Subgenre | 2 |
| Energy | 1 |
| Danceability | 1 |
| Social acceptance | 1 |
| Key | 0.5 |
| Year, Duration | 1 each, switched off |

- A switched-on input weighs from 0.5 to 3, in steps of 0.5;
  only its switch turns it off
- How two tracks compare per input (the exact formulas are the plan's
  algorithm contract):
  - **BPM:** by tempo ratio, with half and double time folded together
    (87 ≈ 174)
  - **Key:** by distance on the Camelot wheel
  - **Tags:** by overlap of the two sets
  - **Subgenre** (by overlap too), **genre** (same main genre or not)
  - **Ratings:** by difference on the 0–5 scale; 0 means unrated and is
    never compared
  - **Relationships**: two tracks that are connected count as alike, two
    tracks that share connections count as partly alike.
    Connected means a relationship of any of the eight types, or a
    transition from a set or a block, in either direction
- A value one of the two tracks lacks is **skipped** for that pair: the
  composite is the weighted mean over the inputs both tracks have
- A pair is only compared when at least two enabled inputs are
  available for both tracks (one, if only one input is enabled), so two
  tracks that share nothing but their BPM do not look identical
- Any change of an input or weight recomputes the similarity and re-solves
  the layout

## Layout (REQ-33-LO)

- A force-directed layout (d3-force), computed headless: each track is
  linked to its 8 most similar tracks, and more similar pairs
  pull closer. The renderer only draws positions; it does not simulate
- A fresh load of the same library with the same settings
  gives the same map. A re-solve starts from the current positions, so the map keeps its
  shape
- **(a) A track's label is part of the layout** (issue #37): the collision
  radius covers the node and its label box, so the solve leaves room for every
  title and no two labels overlap
- **(b) Focus is the one exception to the kept shape** (issue #33): while a
  track is focused, the positions are the solve rearranged around it, and the
  next change that re-solves the map replaces that arrangement. Leaving focus
  (Fit, Reset) restores the solve's own shape
- The first layout appears in place; nothing animates on page load. After a
  change, the nodes move to their new places in one animation, the one named
  exception to the 150–220 ms motion rule (400 ms ease-out, in the 300–500 ms
  range the issue noted). Under reduced motion the nodes jump
- The axes carry no meaning; only distance does

## Nodes, edges and colour (REQ-33-NE)

- A node is a track, and it is **big** (issue #31): a disc at about three
  times the earlier radius, in its main genre's user colour as the **outer
  ring**. (A bigger node also lets the whole map fit at a lower zoom, so on
  screen the gain is smaller than the radius ratio; the radius is the
  observable, and the drawn disc is still visibly larger.) From a
  zoom level on (measured on a 5,000-track library, where the fit zoom lands
  near 0.4), the track's **cover** sits in the centre of the ring, drawn in the
  app's cover mode — black and white in editorial, the user's choice in
  Settings for colour — exactly as `CoverArt` draws it in the DOM. Zoomed
  further out the node is the **full genre colour** with no cover, so a large
  map never draws thousands of artworks. A track with no artwork keeps the
  genre fill. Cluster nodes keep their own look
- **Every title draws, in full (issue #37).** No title is trimmed to an
  ellipsis and none is hidden: a long title **wraps** onto as many lines as it
  needs — a word wider than the line is broken rather than dropped — at a
  smaller size than before, and a long title drops a notch smaller again. The
  drawn size is constant on screen (the canvas divides by the zoom) and stays
  inside a readable band, so zooming out never shrinks a label into
  illegibility
- **The layout makes room for the labels, not the renderer.** A track's
  collision radius covers its disc *and* its label box, so however the force
  settles, two labels cannot overlap — that is what lets every label draw at
  once. The link distance is set above that floor, so similarity still
  expresses itself (a linked pair sits closer than an unlinked one)
- Orange means "this one": the playing track carries the orange cut, and the
  selected track carries the focus ring. Hover emphasis uses the foreground
  colour. Orange is never a genre, cluster or hover colour
- Relationship edges keep their line styles (`src/lib/relationshipStyle.ts`).
  Computed similarity is not drawn as edges by default; the
  selected track's nearest tracks show as thin neutral lines. Computed and
  authored edges stay visually distinct, and the legend lists every kind on
  screen
- The canvas follows the design system's canvas rules: tokens read at
  runtime, backing store scaled by `devicePixelRatio`, text drawn after
  `document.fonts.ready`, redraw when the theme or cover mode changes

## Clusters (REQ-33-CL)

- Past a node-count threshold, tracks collapse into one cluster node per
  value of a cluster dimension. The layout then runs over clusters, and
  filtering down reveals the tracks again
- Cluster dimensions, for now: **genre** (main genre), **BPM range** (bins of
  10 BPM, each `[120, 130)` and labelled "120–130"), **subgenre** (a track's
  first-listed subgenre; without one, its main genre) and **energy**
  (by the meter's whole bars: "Below 1", 1 to 5, and "Unrated"
  for 0). Tags never cluster; they only filter
- Choosing the dimension: by priority, depending on how many nodes there are
  and how many clusters a dimension would create. Fixed in phase 6: genre,
  BPM range, subgenre, energy in that order, the first with 4–60 groups, else
  the one nearest that band; `T` = 500, `C_MIN` = 4 and `C_MAX` = 60 are
  measured and recorded in NFR-12 and the plan
- Fallback (Tim: *"Create also a viable fallback"*): when none of the four
  can split the tracks, the map clusters by crate, then by the
  first letter of the artist (A–Z, "#" for anything else), which nearly any
  library can split. Only when even that fails does it show the first tracks
  by title, with a notice that the rest need filtering
- A cluster node is sized by its track count and labelled with its value and
  count. Choosing a cluster narrows the map to exactly its
  members (by the same grouping that made it); if they are still too many,
  the next dimension clusters them. Each chosen cluster shows as a removable
  chip in the Filters section; removing it brings the clusters back
- The map rail's Clusters section names the dimension and why it was chosen,
  and lists the clusters with their counts; choosing one there does the same
  as on the canvas

## Layers (REQ-33-LY)

- Three layers on the map, each switched on or off in the map rail
  (all on by default):
  - **Relationships:** the seven non-transition types, each in its own line
    style
  - **Transitions:** one edge kind with many sources. A `transition`
    relationship, two consecutive tracks in a set's running order (blocks
    expanded in place) and two consecutive tracks in a block are the same
    kind of fact, and each is a valid transition
  - **Nearest:** the selected track's nearest tracks
- Transitions are deduplicated per direction: A→B and B→A are separate
  edges. Each edge keeps its sources (which relationships, sets and blocks)
  and their notes. A gap in a set or block (a deleted track) breaks the
  chain; it never joins its neighbours
- The selected track's transitions list shows every transition in and out,
  with sources and notes; when a track is selected, the notes of
  its transitions also show as edge labels
- The dialog has no layers: it draws all eight relationship
  types

## Interaction (REQ-33-IN)

- The dialog and the map behave alike (Tim: *"behavior should be similar"*):
  - clicking a track selects it and shows its details
  - clicking empty canvas clears the selection
  - hovering a track highlights it and its edges and dims the rest
  - Esc clears the selection
- The map's details, in the map rail: cover, title, artist, BPM, key, genre,
  ratings and tags; the nearest tracks under the current weights, each with
  its similarity as a percentage; the transitions in and out. Each list entry selects that track and
  pans to it. Actions: **Play**, **Properties** (the Edit
  dialog), **Song page**, **Show its relationships**
- **Play** starts a run of one: no previous or next, like the song page.
  On the track that is already playing it pauses and resumes,
  like the library's row control
- **Double-clicking a track plays it** (issue #32), the same run of one as the
  details' Play, so the two can never disagree. The first click still selects
  immediately — a single click is never held back waiting for a second one —
  so a double-click reads as "select, then play". A double-click on a cluster
  node chooses the cluster, like a single click there
- **Focus** (issue #33) centres the camera on the selected track *and*, by
  default, re-arranges the map around it: every other node is pulled towards it
  by its similarity, so the tracks closest to it sit closest to it. One
  constant in the code (`FOCUS_BEHAVIOUR` in `src/pages/TrackMap.tsx`) picks
  both, the camera alone, or the re-arrangement alone. The button sits in the
  toolbar and is disabled with nothing selected; Fit or Reset leaves focus, and
  the next real solve replaces the arrangement (see REQ-33-LO)
- **Hovering a track shows an instant popover** (issue #35) with the full
  title and artist, BPM, key, duration and its tags as chips — everything the
  canvas label cannot show. It is a DOM element, so it stays on-brand and
  readable by assistive tech, and it is placed beside the node, flipped near an
  edge so it never runs off the canvas. It is not wired on touch devices,
  where there is no hover
- **Arriving from the table with a track playing focuses it** (issue #34):
  switching Table → Map selects and centres what you are listening to. Only
  that switch carries the intent (`?from=table`); arriving by the sidebar, or
  going Back, is left alone. When the playing track is not **on the map** —
  a search, a filter or the core excludes it — a short toast says so and
  playback carries on
- Selecting a track replaces `?focus=` in the URL, so a reload
  keeps the selection
- **Show its relationships** on the map: the core becomes that track and its
  relationship partners, replacing any core
- Zoom and pan with the wheel, drag and pinch; the toolbar zooms in and out,
  fits the map and resets the view, and shows the zoom level as
  text
- Nodes cannot be dragged: positions are computed
- After **Properties** saves a change, the map reloads its
  tracks and re-solves

## Relationships dialog (REQ-33-DG)

- The dialog's graph becomes a small instance of the same canvas: only its
  song and that song's relationship partners (all eight types), never the
  whole collection. The list view is unchanged
- The dialog opens with its song selected. Its details are
  compact: title,
  artist, the selected track's relationship partners as a list (each entry
  selects that track), and the actions **Play**, **Song page**, **Show its
  relationships** and **Open in map**. It shows no nearest tracks
- Re-centring, which used to be the click, becomes **Show its
  relationships**, with back-button history as before
- **Open in map** continues into `/map?core=<its song's id>` (phase 7,
  TM-E3), so the map opens on that song and its relationship partners as in
  TM-H1: the map recomputes the core from the loaded relationships, the rail
  shows it as a removable chip, and removing the chip also clears `core` from
  the URL

## Map rail (REQ-33-RL)

- **Two rails** (issue #36). The map's **left** rail holds what the map is
  showing and how it is computed: the status line, **Similarity** (inputs on or
  off and their weights, plus Reset to defaults), **Filters** (the same search
  and filters as the table, plus the core and any cluster filters), **Layers**
  and **Clusters**. The **right** rail holds only the **selected track**, so
  its details are reachable without scrolling; with nothing selected it shows
  the empty state
- Both rails are collapsible as a whole and per section, in Klangkurator's
  design language (the pattern is Smartimize's sidebar), and both collapse
  states persist

## Persistence (REQ-33-PS)

- Inputs, weights, layers and the collapse states persist like the app's
  other saved UI state (column configuration, dock preference), in the
  browser's local storage; the plan pins the key. A stored value that does
  not fit is replaced by the default
- Search and filters are shared with the table and session-only, like the
  library's. The core and cluster filters are session-only and
  stay on the map. Positions are never stored

## Bundle (REQ-33-BU)

- The map's renderer (`react-force-graph-2d`, `d3-force`) and the layout,
  canvas and page it needs are **lazy-loaded**: `/map` is a `React.lazy` route
  under `Suspense` in `src/App.tsx`, and the relationships dialog's graph tab
  is lazy-loaded the same way, so the renderer never sits in the library's
  first paint. It arrives when the map or the graph tab is opened, which are
  the two deliberate ways the canvas is ever shown. Phase 7 measured the
  entry and lazy chunk sizes (`npx vite build`); the plan's bundle note keeps
  the phase 2 baseline for the before/after comparison

## States (REQ-33-ST)

- Loading: a skeleton, as elsewhere in the app; a load failure offers Try
  again
- An empty library: the same empty state as the library, with a
  link to Import
- No track matching the filters, with Clear filters; every input switched off
  ("Pick at least one input")
- `?focus=` with an unknown id: a short notice, nothing selected
- Tracks with no similarity above 0 to any other track have no links; they
  settle at the edge of the map, and a status line at the top
  of the map rail says how many there are

## Accessibility (REQ-33-AX)

- The table stays the accessible view of the same tracks. The canvas's
  accessible name says what it shows and how much ("Map of 92 tracks", "Map
  of 1,200 tracks in 9 genre clusters", "Relationships of <title>: 4
  tracks"), and the selected track's details, its nearest tracks, its
  transitions, its relationship partners and the cluster list are DOM, not
  canvas
- The map rail, the toolbar and the panel actions are keyboard reachable,
  labelled, and show focus, like every other control
- Reduced motion: the re-layout jumps instead of moving
