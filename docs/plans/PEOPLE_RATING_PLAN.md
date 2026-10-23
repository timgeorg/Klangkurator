# Technical plan — People rating (issue #48)

Spec: `docs/requirements/11_SONG_MODEL.md` (DJ Ratings), `13_LIBRARY_VIEW.md`,
`16_SET_PLANNING.md`, `21_DATA_MODEL_LIBRARY_JSON.md`, `33_TRACK_MAP.md`,
`90_NFRS.md` (NFR-11). Contract: `PEOPLE_RATING_BEHAVIOR_CONTRACT.md`.
Branch: `feature_48_people-rating` from `int`.

## Decisions (Tim, 2026-10-23)

- `people` (0–5, one decimal, 0 = unrated, label "People") replaces
  `danceability` and `social_acceptance`; the definition in `11_SONG_MODEL.md`
  stays as written.
- No compatibility. The old values are dropped, not migrated; Tim re-adds the
  ratings by hand (*"just drop everything, I'll re-add those ratings"*). **No
  cleanup of the live library:** old keys left in an existing `library.json`
  are ignored.

## Verified facts (2026-10-23, `int` @ ab17b60)

- Response-model endpoints fill missing fields from the model default
  (`GET /api/songs`, `response_model=list[Song]`); raw-dict endpoints do not:
  `GET /api/export` (`backend/api/misc.py:78`), `/api/songs/{id}/related` and
  `/transition-suggestions` (`backend/api/songs.py:104-117`).
- The range filter keeps a row whose value is `undefined`
  (`src/components/dj/libraryTable.ts:135-140`: `song.x < min` is false).
- `add_song` stores dicts verbatim (`backend/storage/library_store.py:43-52`)
  and `update_song` merges, so dead keys stay in old rows; they are never read.
- A saved column order with an unknown id resets the whole saved layout
  (`src/hooks/useColumnConfig.ts:73-76`); saved map inputs drop unknown keys and
  default new ones (`src/hooks/useMapConfig.ts:78-83`).
- `src/components/ui/rating.tsx` has no importer; `text-accent` is a hover-fill
  token, not the signal orange (`design-system/tokens/tokens.css:103`).
- `src/lib/trackMap/types.test.ts:12` asserts 11 inputs (becomes 10).
- `ENVELOPE_VERSION` stays 1 (`backend/services/import_merge.py:24,122`).
- `src/services/MockupDataService.ts` and `LocalDataService.ts` have no caller;
  they change only so tsc and the grep stay clean.
- Grids sized for three ratings: `src/components/dj/EditSongDialog.tsx:280`,
  `src/components/map/TrackDetails.tsx:164`.

## Files in scope

- `backend/models/song.py`
- `backend/api/library.py`
- `backend/services/import_merge.py`
- `backend/tests/test_export_import.py`
- `backend/tests/test_decimal_energy.py`
- `backend/tests/test_people_rating.py`
- `backend/tests/00_Index.md`
- `src/lib/storage.ts`
- `src/components/dj/EditSongDialog.tsx`
- `src/components/dj/SongTableRow.tsx`
- `src/components/dj/SongLibrary.tsx`
- `src/components/dj/libraryTable.ts`
- `src/components/dj/InlineCells.tsx`
- `src/hooks/useColumnConfig.ts`
- `src/components/ui/rating.tsx`
- `src/lib/trackMap/types.ts`
- `src/lib/trackMap/features.ts`
- `src/lib/trackMap/similarity.ts`
- `src/lib/trackMap/clusters.ts`
- `src/lib/trackMap/calibrate.ts`
- `src/lib/trackMap/syntheticLibrary.ts`
- `src/lib/trackMap/00_Index.md`
- `src/lib/trackMap/types.test.ts`
- `src/lib/trackMap/similarity.test.ts`
- `src/lib/trackMap/features.test.ts`
- `src/lib/trackMap/clusters.test.ts`
- `src/lib/trackMap/buildModel.test.ts`
- `src/lib/trackMap/syntheticLibrary.test.ts`
- `src/components/map/rail/SimilaritySection.tsx`
- `src/components/map/TrackDetails.tsx`
- `src/services/MockupDataService.ts`
- `src/services/LocalDataService.ts`
- `scripts/make-synthetic-library.ts`
- `PRODUCT.md`

The numbered specs, `90_NFRS.md`, `Requirements.md` (frozen) and the TM-M4
note are already merged with this plan.

## Steps

1. **Model:** `SongBase.people: float = 0` replaces both fields;
   `SongUpdate.people: float | None = None`.
2. **Scan default:** `"people": 0` replaces the two defaults
   (`backend/api/library.py` ~97-99). If #46 lands first, the line has moved
   into the scan job's per-file import; change it there.
3. **Import merge:** `people` replaces both names in `CONFLICT_FIELDS`, `_empty`
   (0 = empty) and `_values_differ` (numeric).
4. **Frontend type:** `people?: number` (optional, like `rank`), and every read
   is `song.people ?? 0`: table cell, inline cell, edit-dialog init, sort
   accessor, range filter, track-map features.
5. **Column:** one `people` column labelled "People", where Dance and Social
   were; both old ids go. The rank-migration anchor list becomes
   `['people', 'energy']`. Filter key `people` (range 0–5) and a sort accessor.
6. **Edit dialog:** one People field (step 0.1), and the grid sized for two
   ratings.
7. **Cells:** one People cell in `SongTableRow.tsx` (~199-215) and
   `InlineCells.tsx` (~525).
8. **`rating.tsx`:** delete the `danceability` and `social` variant entries. Add
   no new variant, because the component has no importer.
9. **Track map:** in the `MapInput` union, list and defaults, `people` (on,
   weight 1) replaces both. Update feature extraction, the similarity case and
   the cluster summary mean. Show "People" in the TrackDetails row (grid
   ~164) and the SimilaritySection label. Calibrate counts one rating less, and
   the synthetic library draws one rating less per track. Tests: input count
   10, fixtures with `people`.
10. **Mock data:** `MockupDataService`, `LocalDataService` and
    `scripts/make-synthetic-library.ts` switch to `people`.
11. **`PRODUCT.md`:** the terminology reads "energy / people (0–5)".
12. **Indexes:** fix `src/lib/trackMap/00_Index.md:12`, and add the new test to
    `backend/tests/00_Index.md`.

## Tests

- `test_people_rating.py`, with a row seeded with the old keys (pattern
  `backend/tests/test_decimal_energy.py:57-67`):
  - `GET /api/songs` shows that row with `people: 0` and neither old key.
  - `PUT {"people": 3.5}` persists 3.5.
  - `PUT {"danceability": 4}` leaves the ratings unchanged.
  - A scan of a temporary folder writes `people: 0` and neither old key.
  - A rated row exports `people`.
  - Import preview raises a conflict on `people` the way it does on `energy`
    (0 counts as empty).
- vitest: `types.test.ts` expects 10 inputs; the similarity, features and
  clusters fixtures use `people`.

## Gates (repo `AGENTS.md`)

`npx tsc --noEmit -p tsconfig.app.json` (no new errors; the test files and
`scripts/` are outside that config, so they rely on vitest and the grep) ·
`python -m pytest backend/tests` · `npx eslint <changed files>` ·
`npx vite build` · `npx vitest run` · live check of the table (People column,
inline edit, filter, sort), the edit dialog and the map (rail and details), in
both themes at 1440, 1280, 768 and 375 px, against the sandbox · impeccable audit
of the changed views ·
`grep -rniE "danceab|social_accept" backend src scripts PRODUCT.md` → only
`backend/tests/test_people_rating.py`, which seeds the old keys on purpose.

## Merge order

#46 rewrites the same scan code (`backend/api/library.py`) and #49 shares
`SongLibrary.tsx` and `libraryTable.ts`. The second branch to land rebases on
`int` and resolves conflicts there; the hunks don't overlap in meaning.

## PR

Into `int`, titled for #48. No `Closes` keyword.
