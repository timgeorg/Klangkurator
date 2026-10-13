# Technical plan — decimal energy (issue #7)

Repo: `dj-crate-explorer`, worktree `/tmp/kk-issue7`, branch
`feature_7_decimal-energy` off `origin/main` (bd30f10).

## Verified facts (2026-10-13, probed on the worktree)

1. **Pydantic enforcement is real and hard.** `backend/models/song.py:23-25`:
   `danceability: int = 0`, `energy: int = 0`, `social_acceptance: int = 0`.
   Probed with pydantic 2.13.4:
   - `SongUpdate(energy=3.8)` → ValidationError `int_from_float` → **PUT is a 422**.
   - `Song(energy=3.8)` via `response_model` on GET → ValidationError → **the whole
     list endpoint 500s** if a fractional value ever reaches `library.json`.
   ⇒ changing the annotations to `float` is required *before* any decimal is
   written, and it also heals legacy JSON.
2. **`SongUpdate` mirrors the same fields** (`song.py:59-61` with `rank` at `:62`)
   — all three must widen there too.
3. **Table meter:** `SongTableRow.tsx:284-296` `RatingMeter` — clamp at `:285`
   `const v = Math.max(0, Math.min(5, value || 0))`, bar fill `:291` `i < v`.
   A float `3.8` passes the clamp untouched → `i < 3.8` is true for i=0..3 →
   **4 bars** (ceil-like). Need explicit `Math.floor`.
   Tooltip/aria already print the raw value — after flooring, `title` must print
   the stored value (`3.8/5`) per BC-3.
4. **`RankStars` (SongTableRow.tsx:299)** uses `Math.round` — correct for rank,
   must NOT change.
5. **Edit dialog:** `EditSongDialog.tsx` `RATINGS` const (`:36-41`) includes
   `rank` → one shared slider (`:286-292`, `step={1}`). A global `step={0.1}`
   would give rank half stars. ⇒ per-field step from the const.
6. **Dialog state:** `FormState.energy/danceability/social_acceptance/rank` are
   `number` (`:59-62`), seeded `song.energy || 0` (`:119-121`) — decimal-safe.
7. **Sort:** `SongLibrary.tsx:40-53` `SORT_VALUE` — raw pass-through, decimal-safe;
   unrated 0 sorts first (unchanged behavior, BC-4-corrected).
8. **Filter:** `libraryTable.ts:59-62` range config min 0 max 5; predicate
   `SongLibrary.tsx:265-270` numeric compare — decimal-safe. Chip formatting
   `:643-647` uses `fmt` — verify it prints decimals cleanly.
9. **Detail page:** `SongDetailPage.tsx:183` shows Rank only — no change.
10. **Storage:** `library_store.py update_song (:53-60)` raw dict update, no
    coercion — writes whatever the route handed it. After the model widens,
    decimals persist verbatim.
11. **`ui/rating.tsx` + `ui/energy-bar.tsx`** unused — untouched.

## Changes (files in order)

### Backend
- `backend/models/song.py` — `SongBase` + `SongUpdate`: `danceability`,
  `energy`, `social_acceptance` → `float` (keep defaults 0). `rank` stays `int`.

### Frontend
- `src/components/dj/SongTableRow.tsx` — `RatingMeter`: `const v = Math.floor(clamp…)`;
  tooltip/aria-label print the stored value (`Energy 3.8/5`) while bars floor.
  Doc comment updated ("floored on read" + why).
- `src/components/dj/EditSongDialog.tsx` — `RATINGS` gains `step` per field
  (`0.1` for the three ratings, `1` for rank); slider uses it; label formats
  decimals (`3.1/5`) via a small formatter (strip trailing `.0`).

### Not changing (deliberate)
- Sort, filter config/predicate/chip: already decimal-safe.
- Detail page: no rating display.
- `storage.ts` types: already `number`.

### Requirements docs (spec-first, same change)
- `docs/requirements/11_SONG_MODEL.md:40-42` — the three fields read
  `| \`danceability\` | number (0–5) | …` etc.; keep `number (0–5)` and add the
  one-decimal precision to the description column.
- `docs/requirements/13_LIBRARY_VIEW.md` — if it names the ratings columns'
  display (verify line refs at edit time).
- `docs/requirements/92_PLANNED_FEATURES.md` — **add PF-78** (plan-review
  verdict: rank took PF-77 at `92_PLANNED_FEATURES.md:197`, so the convention
  is that shipped feature work gets a row; highest present = PF-77).
  ⚠️ Issue #5's body cites "PF-78" as its pull-time hint — a reservation in
  prose only, never a row; note in the PR that #5 re-resolves its number at
  pull time.
- `docs/requirements/99_CHANGELOG.md` — new entry under `## 2026-10-13`
  (heading exists) mirroring the Track rank entry style.

### Tests
- New `backend/tests/test_decimal_energy.py` following `test_rank.py`'s
  `_new_song` pattern:
  - create with `energy=3.8` → reads back 3.8 (BC-2)
  - PUT `energy=3.8` → 200, reads back 3.8 (BC-1 write path)
  - PUT integer `3` → reads back `3` (BC-7)
  - a song seeded with fractional energy in the raw store lists without a 500
    (BC-9) — insert directly via the store to simulate legacy JSON
  - `rank=4` alongside `energy=3.8` round-trips both (BC-6)

## Gates
1. `npx tsc --noEmit -p tsconfig.app.json` — expect only the pre-existing
   MockupDataService errors (none in changed files).
2. `python -m pytest backend/tests` (vault venv) — all green incl. new tests.
3. `npx eslint <changed files>` — zero new findings.
4. `npx vite build` — clean.

## Live verification (sandbox)
Copy real library to `/tmp/kk-sandbox`, backend :8001, vite :8081 with
`KLANGKURATOR_API`. In the browser (shared page):
- open a song in the Edit dialog, slider to an exact decimal, save
- meter shows floored bars, tooltip shows decimal
- sort check (3 / 3.8 / 4 order), filter ≥ 3.5
- rank slider still integer steps
- both themes, 1440/1280/768/375 viewport screenshots

## PR
`feature_7_decimal-energy` → `main`, body references `Closes #7`, contract +
plan files included. PR body via `--body-file` (gh backtick gotcha).