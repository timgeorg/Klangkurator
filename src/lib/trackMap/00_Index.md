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
