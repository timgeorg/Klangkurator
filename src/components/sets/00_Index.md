---
source: auto
tags:
  - index
---
# Index — src/components/sets

- [[setModel.ts]] — Resolve set items and blocks against the library (by `ref_id`), flatten a set into its tracks, total the time, read alternatives.
- [[SetCard.tsx]] — One set on the Sets page: cover mosaic, serif name, totals, numbered running-order preview.
- [[BlockCard.tsx]] — One block on the Sets page: cover strip, name, track chain, totals, sets that use it.
- [[CoverMosaic.tsx]] — The set/block mosaic (colour tile with a shape, then B&W covers) and the small `EntityTile`.
- [[SetEditor.tsx]] — Dialog to create or edit a set: running order of tracks and blocks, notes, alternatives, suggestions.
- [[BlockEditor.tsx]] — Dialog to create or edit a block: two or more tracks in mixing order with transition notes.
- [[RunningOrder.tsx]] — The editable running order list (move/remove with focus kept) and the transition row between items.
- [[TrackPicker.tsx]] — Searchable popover to add a track or block; caps the list at 50 matches.
