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