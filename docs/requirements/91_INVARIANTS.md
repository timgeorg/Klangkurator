# Constraints And Invariants

Status: Active
Last Updated: 2026-08-09
Source: Requirements.md section 2.4

## Invariant Table

| ID | Constraint | Enforcement Points |
|---|---|---|
| INV-1 | Song IDs are UUIDs assigned once on first creation and never regenerated | MockupDataService upsert, LocalDataService create, UI never re-assigns |
| INV-2 | Tag IDs are UUIDs assigned once on first creation | Tag creation flow, no regeneration on edit |
| INV-3 | Mockup initialization is idempotent — upsert by natural key (artist + title), never wipe | MockupDataService.initializeData() |
| INV-4 | `clearData()` must clear all dependent stores (songs, tags, relationships, playlists, blocks, sets) | DataService.clearData() |
| INV-5 | Re-scanning a root folder never overwrites existing song data (notes, tags, ratings) | FileLoader import flow — check by file_path or artist+title |
| INV-6 | Deleting a song cascades to its relationships and playlist/block/set references (placeholder, not deletion) | Storage layer delete cascade |
| INV-7 | Sets reference songs/blocks by ID only — never embed full song data | SetItem schema enforcement |
| INV-8 | No "Reset to Defaults" button for genres/subgenres | Settings page — button must not exist |
| INV-9 | Range filters must use empty defaults (no auto-applied 0–200 that hides everything) | Filter popover component |
| INV-10 | No cloud, no login, no Supabase — all data local | Architecture constraint, no network calls in data layer |
| INV-11 | An import never overwrites a matched track's `file_path` (paths are machine-truth; a moved file keeps its local path) | Import merge, `import_merge.apply_import` (issue #10) |
| INV-12 | An import never writes a foreign song id — matched tracks keep the local id, added tracks get fresh uuids (INV-1 holds across machines) | Import merge, `import_merge.apply_import` (issue #10) |
| INV-13 | Analysis never overwrites a human-set BPM/key silently. The library-wide job only fills **missing** values (INV-5); the per-track re-analyze is the one explicit override, it is user-initiated, and it shows before → after. A BPM hint that the signal cannot honestly satisfy is reported and the stored BPM is left alone | `analyze_all_missing_bpm` skip policy; `POST /api/library/analyze/{song_id}` + the re-analyze popup (issue #6) |
