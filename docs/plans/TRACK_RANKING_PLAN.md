---
source: session
tags:
  - plan
  - library
status: active
created: 2026-10-13
---
# Plan — track ranking: a per-track quality score (issue #4)

Tim's request / issue #4: a per-track ranking — one number that says "this one is
better than that one", sortable and filterable.

Behavior to verify: [[TRACK_RANKING_BEHAVIOR_CONTRACT]].

## Decisions (pull-time brainstorm, resolved 2026-10-13)

Issue #4's five open questions, decided. Every row is veto-able; the ones worth a
second look are marked **(confirm)**.

| # | Question | Decision | Why |
|---|---|---|---|
| 1 | 0–10 or 1–5 stars? half-steps? | **1–5 stars, whole steps** | Distinct in kind from the three 0–5 bars: "stars" read as *how good*, the bars as *what it does*. Integer keeps storage and sorting trivial. |
| 2 | Distinct field, or a rework of a 0–5 rating? | **Distinct, independent field `rank`** | The three ratings say what a track *does*; #7 wants them decimal. Rank says *how good*. Folding them would fight #7. |
| 3 | Column, filter, detail page, player? | **Column (sortable) + `≥ N` filter + detail page. Not the player, not inline editing.** | Player is #5/#7. Inline click-edit is #3's work — the field and column are shaped so it drops in, but this change does not add it. |
| 4 | Does it feed anything? | **No downstream in v1** | "Top N of a crate" falls out of sort + filter for free. Smart crates and suggestions are #8/#9. |
| 5 | One global rank, or per-context? | **One global rank** | Per-context needs a context schema; nothing asks for it yet. |

Field name: **`rank`**, not `rating` — the three existing fields already own
"rating", and `rank` reads correctly ("ranked 1–5") and avoids the collision.

## Scope

In:
- Backend field `rank: int = 0` (`backend/models/song.py`, `SongBase` + `SongUpdate`).
- Frontend `Song.rank?: number` mirror (`src/lib/storage.ts`).
- Table column "Rank" — five stars, sortable, with a `≥ N` range filter.
- Song detail page: show the rank.
- Edit dialog: a Rank slider (the write path on this base).

Out:
- Inline click-to-edit in the table (arrives with #3; the field and column are shaped for it).
- The player (PF-16, issues #5/#7).
- Smart crates, "top N" suggestions, per-context rank (#8, #9).
- Export/import parity (#10) and similarity inputs (#8) — a follow-up line in each, not this change.

## Data flow trace

`rank` is a plain stored attribute. It crosses the same boundary as the three
ratings and rides the same paths; nothing needs ID resolution or a reference
lookup.

1. **Storage** — `library.json`, under each song object. `LibraryStore.add_song`
   spreads `**song_data`, so a new key persists with **no migration**; `update_song`
   merges the patch under the save lock. There is no schema version and none is
   needed (schema-less JSON).
2. **Model** — `SongBase.rank: int = 0` (default 0, like the three ratings) →
   returned by `GET /api/songs` and `GET /api/songs/{id}`, accepted by `POST` and
   `PUT`. `SongUpdate.rank: int | None = None` mirrors it so a `PUT` can set it.
   With `default=0` the field is **not** in `_CLEARABLE` (`songs.py:47`), so an
   explicit null is ignored — correct, because 0 *is* "unranked", exactly as 0 is
   "unrated" for the three bars.
3. **Serialization** — `response_model=Song`; the frontend receives `rank` inside
   the song object. No alias (only `mainGenre` is aliased).
4. **Frontend state** — `Song.rank?: number`; `SongPatch` already allows any field.
   The write queue (`songWriter.ts`) merges `{ rank }` per song like any other patch.
5. **Presentation** — `COLUMN_DEFINITIONS.rank` → `SongTableHeader` sort via
   `SORT_VALUE.rank` → `SongLibrary` filter predicate on `filters.rank.min` →
   `SongTableRow.renderCell('rank')` → a read-only stars cell. The detail page adds
   a Rank row; the Edit dialog adds a Rank slider.

**Missing-field handling.** Songs written before this change have no `rank` key.
Absent is read as 0 (no stars) and sorts last: `song.rank ?? 0` for display, and
`rank: (s) => s.rank || undefined` in `SORT_VALUE` so a falsy 0 takes the existing
"missing sorts last" branch (`SongLibrary.tsx` sort: `missing = v===undefined||v===null||v===""`).
`0 || undefined` is deliberately the idiom here — without it a numeric 0 is not
"missing" and would sort *first*, contradicting TR-4. Same defensive read the
ratings use. No data migration, no backfill.

## Gotchas (found in plan review, 2026-10-13)

- **Sorting 0.** The table's missing-last rule is `undefined | null | ""` only. A
  numeric `rank: 0` is none of those, so the naive `rank: (s) => s.rank` would sort
  unranked tracks *first*. Fixed by `s.rank || undefined` in `SORT_VALUE.rank`. This
  is the one line that makes TR-4 true.
- **Persisted column layout.** The column config persists as one JSON blob
  (`klangkurator.columnConfig.v1`) and `loadPersistedColumnConfig` validates ids but
  does **not** require completeness. A user who has ever resized/reordered columns
  has a saved `order` with no `'rank'`, so the new column would never render for them.
  The `'cover'` column solved this with a migration that inserts the missing id
  (`useColumnConfig.ts` — "Migration: persisted orders from before PF-14 …").
  `rank` needs the same insert (after `'social'`, or first if absent).

## Interaction and presentation semantics

- **Column "Rank"** — five stars. Filled stars use the info/accent token (a filled
  star reads as "this one is good"); empty stars are the muted/hairline token, like
  the three bars. Rank 0 shows five empty stars, never a dash — the stars are the
  affordance.
- **Sort** — Rank joins the sortable headers; lowest first on the first click
  (matching the numeric columns), descending on the second, off on the third.
  Missing/0 sort last in both directions. `aria-sort` on the header.
- **Filter** — `≥ N`: a range whose `min` is the chosen star count (1–5); empty
  means "any" (unranked tracks show). No `max` in the UI.
- **Read-only on this base** — the table cell shows the stars and does not edit;
  editing is the Edit dialog's Rank slider. When #3 lands, the cell gains the
  click/keyboard/touch behavior the bars already have (IE-19…IE-21).
- **Detail page** — a "Rank" row in the spec list: `N/5`, or "Unranked".

## Files

| File | Change |
|---|---|
| `backend/models/song.py` | `rank: int = 0` in `SongBase`; `rank: int \| None = None` in `SongUpdate` |
| `src/lib/storage.ts` | `rank?: number` in `Song` |
| `src/hooks/useColumnConfig.ts` | `rank` in `COLUMN_DEFINITIONS` + `DEFAULT_COLUMN_ORDER` (after `social`); **plus** a persisted-layout migration inserting `'rank'` when absent (the `'cover'` precedent) |
| `src/components/dj/SongTableRow.tsx` | `case 'rank'` → a stars cell |
| `src/components/dj/SongLibrary.tsx` | `rank: {}` in `INITIAL_FILTERS`; `rank: (s) => s.rank \|\| undefined` in `SORT_VALUE`; the filter predicate |
| `src/components/dj/libraryTable.ts` | `rank` in `FilterState` + `FILTER_CONFIG` (range 1–5) |
| `src/components/dj/EditSongDialog.tsx` | a Rank slider (0–5): `RATINGS`, form state, save |
| `src/pages/SongDetailPage.tsx` | a Rank row |
| `docs/requirements/11_SONG_MODEL.md` | the field |
| `docs/requirements/13_LIBRARY_VIEW.md` | the column, its sort and filter |
| `docs/requirements/92_PLANNED_FEATURES.md` | new `PF-77` row |
| `docs/requirements/99_CHANGELOG.md` | a dated entry |
| `docs/plans/00_Index.md` | the two new files |

## Verification

- `npx tsc --noEmit -p tsconfig.app.json` — no new errors.
- `python -m pytest backend/tests` — passes; a new test covers rank persistence and that a 0 (unranked) round-trips.
- `npx eslint <changed files>` — no new problems.
- `npx vite build` — passes.
- Live check both themes (ink/paper) at 1440/1280/768/375, against a sandbox — the
  column renders, sorts and filters; the dialog saves; the detail page shows.
- A user with a **saved column layout** (a pre-existing
  `klangkurator.columnConfig.v1` with no `rank`) still sees the Rank column after
  the change — the migration inserts it.
- Behavior contract [[TRACK_RANKING_BEHAVIOR_CONTRACT]], clause by clause
  (source-blind validator).
