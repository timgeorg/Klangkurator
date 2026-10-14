# Technical plan — export/import (issue #10)

Repo worktree `/tmp/kk-issue10`, branch `feature_10_export-import` off
`origin/main` 16df7e5 (post-#13 and post-#14). Contract:
`EXPORT_IMPORT_BEHAVIOR_CONTRACT.md`.

## Decisions (Tim's + autonomous, stated for the PR)

| Decision | Value | Source |
|---|---|---|
| Export scope | whole store (NFR-2 literal) | autonomous — "save them" case included; tags-only would need a second file shape |
| Envelope | `{format, version: 1, exported_at, data}` | issue: no schema version exists anywhere |
| Identity | path → artist+title+duration ±2 s → artist+title | issue's composite-key analysis |
| Merge | fill-empty + conflict popup, per-conflict yes/no + apply-to-all | **Tim** (verbatim: "Popup overwrite yes/no. Extra checkbox if all conflicts should be handled with that option.") |
| Default resolution | local wins (overwrite is opt-in per row) | **Tim**'s popup wording implies opt-in overwrite; fail-safe |
| Tag identity | name | autonomous |
| Foreign uuids | never written; matched keep local id; added get fresh ids | INV-1 + collision hazard |
| blocks/sets/playlists/relationships | import when local empty, else skip+report | autonomous (merge for these not built) |
| Old `POST /api/import` | endpoint path reused, wholesale-replace behavior replaced by merge | playbook "delete the old path" |
| UI | Settings → Backup & Export | 17_SETTINGS.md already documents it |

## Backend

1. **`backend/services/import_merge.py` (new)** — pure planning + application:
   `plan_import(envelope, library, blocks, sets)` (read-only: `_Index` match in
   MC-1 order, `_song_conflicts` per MC-3, tag plan TC-1, other-stores OC-1),
   `apply_import(envelope, resolutions, …)` (fill-empty always, overwrites only
   where resolved `True`, `add_song` mints fresh ids on the new main, tags by
   name, joins never duplicated, other stores wholesale-into-empty with song-id
   remap incl. nested BlockSong rows and set item ref_ids).
2. **`backend/api/misc.py`** — `GET /api/export` (verbatim store dump into the
   envelope, `_config` excluded), `POST /api/import/preview` (plan without
   `_plan` internals), `POST /api/import` (merge; the old wholesale-replace
   body is gone, a legacy-shaped body is a 422).
3. **`backend/tests/conftest.py`** — autouse fixture wipes the singleton
   stores between tests (issue #10 tests build independent fixtures).

## Frontend

4. **`src/pages/Settings.tsx`** — `PageSection id="data"` "Backup & Export":
   Export button (raw `fetch(API_BASE + '/export')` → blob → `a.download` —
   `api.get` JSON-parses and cannot blob), Import file-picker → parse →
   `POST /import/preview` → `ImportMergeDialog`; errors toast inline (UC-2).
5. **`src/components/dj/ImportMergeDialog.tsx` (new)** — summary header;
   per-conflict rows (track, field, local → imported, overwrite switch,
   default off) + "Apply to all conflicts" checkbox (Tim's decision); Confirm
   posts `resolutions`; toast recap; the "no conflicts" path says merge is
   silent and asks to confirm.
6. **`src/lib/storage.ts`** — `exportData` removed from the interface and both
   impls (one export path: the raw-fetch download); `importData(envelope,
   resolutions?)` posts to the merge endpoint; local-impl fallback merges the
   envelope keys.
7. **`src/lib/api.ts`** — `API_BASE` exported (Settings needs the absolute
   base for the raw fetch).
8. **`src/components/dj/SongLibrary.tsx`** — listens for
   `klangkurator:library-changed` and reloads the whole library after an
   import.

## Requirements docs (spec-first, same change)

- `92_PLANNED_FEATURES.md` **PF-83** row; `90_NFRS.md` NFR-2 "→ built in
  Settings (PF-83); import merges, never replaces"; `17_SETTINGS.md` Backup &
  Export section rewritten to what ships; `91_INVARIANTS.md` INV-11 (import
  never overwrites `file_path`) + INV-12 (never writes a foreign song id);
  `99_CHANGELOG.md` entry; plan + contract indexed in `docs/plans/00_Index.md`;
  test file indexed in `backend/tests/00_Index.md`.

## Tests

`backend/tests/test_export_import.py` — 17 tests covering: envelope shape +
`_config` exclusion (EC-1); foreign format/version rejection on both endpoints
(EC-2); fill-empty without clobber + path preservation (MC-2/MC-3); match
precedence ①②③ + unknown-added (MC-1); conflict payload shape; resolution
true/false semantics (MC-4); fresh uuids for added tracks; the uuid-collision
hazard (foreign id == local victim's id → victim untouched, no duplicates);
tags by name + color kept + joins not duplicated (TC-1/TC-2); blocks into
empty store with remap, skipped when occupied (OC-1); the footgun regression
(legacy body → 422, library intact); summary counts.

## Gates

pytest all green · tsc (changed files clean; MockupDataService baseline
untouched) · eslint clean on touched files (2 pre-existing `any` in storage.ts
are baseline) · `npx vite build`.

## Live verification (sandbox, HOME-isolated)

Backend :8001 (92-song copy) + :8002 (empty "other machine"), vite :8082:
- export → 196 KB envelope, correct counts (92/65/239), `_config` absent
- scenario A (moved files): rewrite every path prefix → preview matches 92,
  adds 0 — no duplicates from a moved library
- scenario B (restore): empty machine + import → 92/65/239 restored, all ids
  fresh, joins resolve, no dangling rows
- scenario C (conflicts): preview reports exactly the injected conflicts;
  default import keeps every local value; overwrite resolutions apply exactly;
  re-import of equal values reports 0 conflicts (idempotent)
- UI: foreign file → toast reject + no dialog; broken JSON → toast; conflict
  envelope → dialog with per-row switches + apply-all checkbox; flipping one
  row only applies exactly that overwrite (backend verified); Export button
  downloads a valid envelope to `~/Downloads`; no body h-scroll at
  1440/1280/768/375; both themes

## Ship

`feature_10_export-import` → `main`, `Closes #10`, PR body states the
autonomous decisions and Tim's popup wording verbatim.