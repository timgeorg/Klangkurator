---
source: auto
tags:
  - index
---
# Index — src/lib/trackMap

- [[types.ts]] — Shared track-map types and `DEFAULT_INPUTS` (phase 1a): the map inputs and their weights, track features, clusters, transitions, and the model, canvas props and handle the later phases build on.
- [[types.test.ts]] — Vitest smoke test that `DEFAULT_INPUTS` carries a setting for every map input and matches the spec's default table.
- [[features.ts]] — Song + tag ids → `TrackFeatures` (phase 1b): key parsing for the short, long and Camelot notations, `trackGenre`, and the missing-value rules (numbers ≤ 0 or not finite, ratings 0, empty sets).
- [[features.test.ts]] — Vitest coverage of the key parser (every notation, enharmonics, case, `♯`/`♭`) and the normalisation boundaries.
- [[similarity.ts]] — The per-input similarity table (BPM with half/double folding, Camelot steps, genre, Jaccard subgenre and tags, the three ratings, year, duration, relationships), the weighted composite with the minimum-overlap rule, and `nearest` top-k.
- [[similarity.test.ts]] — Vitest coverage of every worked similarity example (1–5), the composite, the ordering and overlap boundaries, and `nearest` over 500 synthetic tracks in under 1 s.
- [[connections.ts]] — `R(t)`, the undirected connections: any of the eight relationship types either direction, plus every transition fact either direction.
- [[connections.test.ts]] — Vitest coverage of the undirected connections, the self-connection and empty-id cases, and the transition facts feeding in.
- [[transitions.ts]] — Transition facts with gap handling, dedup per `from → to` direction, merged notes and ordered sources (relationship, block, set, then by name and id); `phases` are never read.
- [[transitions.test.ts]] — Vitest coverage of the three fact sources, the worked examples (including gaps and the three-source dedup), dedup per direction and source ordering.
- [[clusters.ts]] — `groupKey` for all six dimensions and the dimension choice (`C_MIN`/`C_MAX`, the nearest band, the crate and artist-initial fallbacks); node building is phase 6.
- [[clusters.test.ts]] — Vitest coverage of every group key and its labels, the band edges (3, 4, 60, 61), the nearest-band examples and the whole fallback chain to the last resort.
- [[buildModel.ts]] — Shown tracks + inputs → `MapModel` in track mode: nodes, the undirected union of the nearest sets as links, the relationship and transition edges, and `unlinkedCount`.
- [[buildModel.test.ts]] — Vitest coverage of the model's nodes, links (worked examples 1 and 2), edge kinds and filtering to the shown tracks.
- [[syntheticLibrary.ts]] — A seeded, deterministic generator of N fake tracks carrying the fields the features read, for the large-library tests.
- [[syntheticLibrary.test.ts]] — Vitest coverage of the generator's determinism, its field shapes and its use in the 500-track perf check.
- [[layout.ts]] — `solveLayout`: the headless d3-force layout (nodes sorted by id, link distance `30 + 120 × (1 − s)` at strength `s`, charge −120 with `distanceMax` 600, weak centre, collide by radius + 2, 300 synchronous ticks) with seeded warm starts and the golden-angle spiral for new nodes.
- [[layout.test.ts]] — Vitest coverage of the layout contract: the same input gives the same positions, linked pairs end closer than unlinked ones, a re-solve with nothing changed barely moves, and unlinked nodes settle at the edge.
- [[calibrate.ts]] — The phase 3 calibration measurement, development-only and imported by nothing: it reads a library JSON (a sandbox copy, never the real library) and prints the spread of `S` at the default inputs — pairwise min/median/max, each track's nearest-neighbour score, the compared and skipped pair counts, the unlinked count and the field coverage. Run with `npx vite-node src/lib/trackMap/calibrate.ts -- <library.json>`; the numbers go into `docs/plans/TRACK_MAP_PLAN.md` › Phase 3 calibration.
- [[layerEdges.ts]] — What the renderer may draw under the active layers (phase 5): `visibleEdges(edges, layers, selectedId)` narrows the model's edges by the rail's three switches, with the computed nearest layer following the selection; `offsetEdges` gives each edge the side-by-side place it draws at, so several relationship types on one pair (or A→B beside B→A) never overlap; `onScreenEdgeKinds` reads the kinds drawn, which the rail's legend names; `transitionNotes` merges an edge's notes across its sources, once each, for the selected track's edge labels.
- [[layerEdges.test.ts]] — Vitest coverage of the layer filtering (each switch, the nearest layer's dependence on the selection, the model's order kept), the side-by-side placement (two and three types on one pair, both directions of a transition, a nearest edge left on the line, determinism), `transitionNotes` and `onScreenEdgeKinds`.
- [[core.ts]] — The core (phase 4b): `coreMemberIds(coreId, relationships)`, the songs a core is made of — the core itself and every track it has a relationship with, of any of the eight types, either direction. Pure, so the map recomputes the members from the loaded relationships on every arrival and a reload of `?core=<id>` keeps the core.
- [[core.test.ts]] — Vitest coverage of the core's membership: both directions, any of the eight types, a repeated pair counted once, an empty id never a member, and an unrelated relationship ignored.
- [[positionsAnimation.ts]] — The re-layout animation's pure arithmetic (phase 4b): `POSITION_ANIMATION_MS` (400), `easeOutCubic`, `animationProgress` and `interpolatePositions`, so the canvas samples a tested timing each frame instead of rolling its own.
- [[positionsAnimation.test.ts]] — Vitest coverage of the animation timing: the ease-out's ends and clamping, progress over the 400 ms (and instantly finished for a zero duration, the reduced-motion path), and interpolation from the positions on screen to the solved ones.
