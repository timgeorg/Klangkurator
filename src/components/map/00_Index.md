---
source: auto
tags:
  - index
---
# Index — src/components/map

- [[TrackMapCanvas.tsx]] — The cold canvas renderer (plan phase 2; phase 5 adds the side-by-side edge placement and the transition edge labels): genre-coloured discs, one line style per relationship type, the orange cut and the focus ring on the playing and selected tracks, hover highlighting its edges and dimming the rest. Edges that share a pair are drawn beside each other as a shallow bend whose ends stay on their nodes, so several relationship types — or A→B and B→A — never overlap (TM-L1, TM-L3), and a selected track's transition edges show their deduplicated notes as labels (TM-L2, TM-L6). Positions are pinned, so it never simulates and never redraws while idle; it reads the design tokens at runtime, scales the backing store by devicePixelRatio, draws text after `document.fonts.ready` and redraws on a theme or cover-mode change. `forwardRef` exposes `TrackMapCanvasHandle` (zoom in/out, fit, reset, centre on, zoom level).
- [[TrackDetails.tsx]] — The selected track's details: cover, title, artist, BPM, key, genre, ratings and tags (full variant); the partners and nearest tracks (each with its similarity as a whole percentage); the transitions in and out; and the actions Play (a run of one), Properties, Song page and Show its relationships.
- [[rail/]] — The map rail's sections (phase 3): one collapsible section per file, with the selected track's full details first; phase 4a adds Similarity, Filters and their collapse, phase 4b the core chip and phase 5 the Layers section with its legend. The Clusters section is phase 6.

The layout the canvas draws is solved headless in [[../../lib/trackMap/00_Index]] (`layout.ts`), and what it may draw under the active layers comes from `lib/trackMap/layerEdges.ts` (phase 5); the dialog uses the canvas for its graph tab, and `/map` (phase 3) uses it for the whole library. The canvas's one motion is the 400 ms re-layout (phase 4b), timed by `lib/trackMap/positionsAnimation.ts`. See `docs/plans/TRACK_MAP_PLAN.md` for the phases.
