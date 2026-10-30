# Constraints And Invariants

Status: Active
Last Updated: 2026-10-31
Source: Requirements.md section 2.4

## Invariant Table

| ID | Constraint | Enforcement Points |
|---|---|---|
| INV-1 | Song IDs are UUIDs assigned once on first creation and never regenerated | The backend store mints them (`library_store._new_id`); import gives added tracks fresh ids; the UI never re-assigns |
| INV-2 | Tag IDs are UUIDs assigned once on first creation | Tag creation flow, no regeneration on edit |
| INV-3 | *Retired 2026-10-23 (#57).* It guarded the mock data layer's sample seeding, which was removed; nothing seeds sample data | — |
| INV-4 | *Retired 2026-10-23 (#57).* It bound the mock layer's `clearData()`, which was removed; the app has no clear-all operation | — |
| INV-5 | Re-scanning a root folder never overwrites existing song data (notes, tags, ratings) | FileLoader import flow — check by file_path or artist+title |
| INV-6 | Deleting a song cascades to its relationships and playlist/block/set references (placeholder, not deletion) | Storage layer delete cascade |
| INV-7 | Sets reference songs/blocks by ID only — never embed full song data | SetItem schema enforcement |
| INV-8 | No "Reset to Defaults" button for genres/subgenres | Settings page — button must not exist |
| INV-9 | Range filters must use empty defaults (no auto-applied 0–200 that hides everything) | Filter popover component |
| INV-10 | No cloud, no login, no Supabase — all data local | Architecture constraint, no network calls in data layer |
| INV-11 | An import never overwrites a matched track's `file_path` (paths are machine-truth; a moved file keeps its local path) | Import merge, `import_merge.apply_import` (issue #10) |
| INV-12 | An import never writes a foreign song id — matched tracks keep the local id, added tracks get fresh uuids (INV-1 holds across machines) | Import merge, `import_merge.apply_import` (issue #10) |
| INV-13 | Analysis never overwrites a human-set BPM/key silently. The library-wide job only fills **missing** values (INV-5); the per-track re-analyze is the one explicit override, it is user-initiated, and it shows before → after. A BPM hint that the signal cannot honestly satisfy is reported and the stored BPM is left alone | `analyze_all_missing_bpm` skip policy; `POST /api/library/analyze/{song_id}` + the re-analyze popup (issue #6) |
| INV-14 | A track has exactly one primary audio file (`file_path`); every other file of the same recording is a variant, never a second song row. A variant carries no BPM, key, ratings, notes, tags or relationships | `audio_variants` on the song model; the scan attaches a re-found file instead of adding a row ([[18_AUDIO_VARIANTS]]) |
| INV-15 | Removing a variant detaches it from the track only. It never deletes the audio file from disk | The variant removal endpoint and its confirmation copy ([[18_AUDIO_VARIANTS]]) — built 2026-10-31, `DELETE /api/songs/{id}/variants/{variant_id}` and the Files section |
| INV-16 | A derived fact is never stored. The model computes `missing` on a variant and `primary_missing` on a song from the file system on every read. So a moved file never leaves a stale flag in `library.json` or in an export | `AudioVariant` and `Song` model validators. `library_store._clean_variants` strips the key on every write |
| INV-17 | Playback uses the primary. A variant plays only when the primary's file is not on this machine. That case is a repair, and the UI names the file it played | `audio.choose_playable`, `X-Klangkurator-Source`, `NowPlaying`'s played-file line (issue #65) |
