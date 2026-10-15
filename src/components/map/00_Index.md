---
source: auto
tags:
  - index
---
# Index — src/components/map

- [[TrackMapCanvas.tsx]] — The cold canvas renderer (plan phase 2): genre-coloured discs, one line style per relationship type, the orange cut and the focus ring on the playing and selected tracks, hover highlighting its edges and dimming the rest. Positions are pinned, so it never simulates and never redraws while idle; it reads the design tokens at runtime, scales the backing store by devicePixelRatio, draws text after `document.fonts.ready` and redraws on a theme or cover-mode change. `forwardRef` exposes `TrackMapCanvasHandle` (zoom in/out, fit, reset, centre on, zoom level).
- [[TrackDetails.tsx]] — The selected track's details: cover, title, artist, BPM, key, genre, ratings and tags (full variant); the partners and nearest tracks (each with its similarity as a whole percentage); the transitions in and out; and the actions Play (a run of one), Properties, Song page and Show its relationships.

The layout the canvas draws is solved headless in [[../../lib/trackMap/00_Index]] (`layout.ts`); the dialog uses the canvas for its graph tab. See `docs/plans/TRACK_MAP_PLAN.md` for the phases.
