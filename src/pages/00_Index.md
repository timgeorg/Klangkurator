---
source: auto
tags:
  - index
---
# Index — src/pages

- [[Index.tsx]] — The Library route; renders SongLibrary (the track table with crate tabs, search, filters, sorting and column layout).
- [[TrackMap.tsx]] — The `/map` route (plan phase 3), lazy-loaded since phase 7 so the renderer leaves the library's first paint: the whole library on the cold canvas, the map rail (status line with the shown and unlinked counts, the section-collapse scaffolding, the selected track's full details) and the toolbar (Zoom in, Zoom out, Fit, Reset and the zoom level as text), with the Table | Map switch in its header. Reads `?focus=<id>` to select and centre a track, clears the selection on empty canvas or Esc, and carries the loading, backend-error, empty-library and below-768 states; above the node threshold it shows the first 500 tracks by title with a notice. Phase 4a brings the shared search and filters, the saved inputs, the rail sections and their collapse; phase 4b brings the core (`?core=<id>`, its chip, Show its relationships) and the canvas's 400 ms re-layout; phase 5 draws the edges through the tested `visibleEdges` (`lib/trackMap/layerEdges.ts`) under the rail's layer switches — which never re-solve the layout — and hands the same list to the rail's Layers legend; phase 6 clusters past `T` and shows the Clusters section; phase 7 adds the Table | Map switch in the header (TM-E1, TM-E4).
- [[LoadFiles.tsx]] — The Import page: first-run start screen, choosing and scanning the music folder, re-scan results, BPM/key analysis progress, crates and the typed-path fallback.
- [[SongDetailPage.tsx]] — Song metadata and editing page; displays full track details, cover art, waveform, tags, relationships, notes, and edit forms; since phase 7 it carries **Show on map** (`/map?focus=<id>`, TM-E2).
- [[Sets.tsx]] — The Sets page: sets as a contents page, blocks as cover strips, the set and block editors and the delete confirmation.
- [[Settings.tsx]] — Settings: Appearance (theme, cover style, player position), tags with their track counts, and the genre and subgenre lists.
- [[NotFound.tsx]] — 404 page; shown when a route is not recognized.
