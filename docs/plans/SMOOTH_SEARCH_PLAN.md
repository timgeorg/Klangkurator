# Technical plan — instant library search (issue #68)

Spec: `docs/requirements/13_LIBRARY_VIEW.md` REQ-13-ST. Contract:
`SMOOTH_SEARCH_BEHAVIOR_CONTRACT.md`. Depends on #63
(`LAZY_ROWS_PLAN.md`).
Branch: `feature_68_smooth-search`, stacked on `feature_63_library-lazy-rows`.

## Verified facts (2026-10-30, `main` @ 5ca2fc1)

- The matching is cheap: `filterSongs` (`src/components/dj/libraryTable.ts:107-117`)
  is a lowercase substring test over title, artist, genres and key. Timed alone on
  1,907 tracks, one keystroke takes about 1 ms.
- The cost is the table. The query lives in the shared context
  (`src/lib/LibraryFilterContext.tsx:44`), the field is bound to it
  (`SongLibrary.tsx:476-477`), so every keystroke re-filters and synchronously
  rebuilds every matching row before the next character can paint. "t" matches
  1,696 rows, "te" 667, "tec" 323.
- React 18.3 with `createRoot` (`src/main.tsx:8`), so `useDeferredValue` is
  available and drops a stale low-priority render when a new key arrives.
- The header count is `rows.length` plus `isFiltering`, and the empty state narrates
  the field's text (`SongLibrary.tsx:443-449`, `:666-667`). If only the rows are
  deferred, those three surfaces disagree with the table mid-transition.
- The map filters the same **live** query (`src/pages/TrackMap.tsx:186`, `:205-208`).

## Decisions

1. **The deferral stays in `SongLibrary`, never in `LibraryFilterContext`.** The
   map's field (`rail/FiltersSection.tsx`) and the library's field read the same
   context string. Deferring the context value would make both fields lag and drop
   characters, which breaks AC-3.
2. **Everything that describes the table reads the deferred value:** `filterSongs`,
   `viewKey`, the header count and the empty-state text. The field alone is live.
   That keeps the count, `aria-rowcount` and the empty state in agreement with the
   rows, which is the only self-consistent reading of AC-5.
3. **No debounce and no `startTransition` wrapper.** `useDeferredValue` gives the
   interruptible low-priority render without a timer, as the issue asks.

## Data flow

- `searchQuery` (live, context) → the field's `value`, and → `useDeferredValue`.
- `deferredQuery` → `filterSongs` → `filteredSongs` → `rows` → `viewKey` and the
  `meta` line.
- The map keeps reading `searchQuery`; at rest the two values are equal, so the
  map and the table agree (AC-7), and the map is only briefly ahead mid-transition.

## Gotchas

- `viewKey` must use `deferredQuery`, or the reveal count in #63 resets on the
  keystroke while the rows still show the previous query.
- `isFiltering` from the context is live. The header must use a local
  `tableIsFiltering` built from `deferredQuery`, or "1 of 1,907" appears during a
  transition.
- Clearing must not depend on a timer: `clearAll` sets the query to `""`, the
  field empties at once, and the table follows one transition later.

## Files

- `src/components/dj/SongLibrary.tsx` — the deferred query and the surfaces above.
- `docs/plans/SMOOTH_SEARCH_BEHAVIOR_CONTRACT.md`, `docs/plans/00_Index.md`.
- `docs/requirements/13_LIBRARY_VIEW.md` — REQ-13-ST.
- `docs/requirements/99_CHANGELOG.md` — the dated entry.

## Verification

The gates in `AGENTS.md`, and the typing numbers before and after on a production
build with all tracks selected.
