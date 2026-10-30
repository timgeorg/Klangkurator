# Technical plan — lazy library rows: draw 50, add 50 while scrolling (issue #63)

Spec: `docs/requirements/13_LIBRARY_VIEW.md` REQ-13-LR. Contract:
`LAZY_ROWS_BEHAVIOR_CONTRACT.md`.
Branch: `feature_63_library-lazy-rows` from `origin/main`, PR into `int`.

## Verified facts (2026-10-30, `main` @ 5ca2fc1, re-checked at `076f2f5`)

- The table renders every matching row in one pass: `rows.map((song, index) => …)`
  (`src/components/dj/SongLibrary.tsx:608`). There is no windowing dependency in
  `package.json`.
- The scroll container is `div.absolute.inset-0.overflow-auto` with
  `ref={tableScrollRef}` (`SongLibrary.tsx:561-563`). It is not the document, so an
  `IntersectionObserver` with a default viewport root would use the wrong box.
- `viewKey = JSON.stringify([searchQuery, filters, sort])` (`SongLibrary.tsx:125`).
  It is recomputed on every render, so it cannot be a `useEffect` dependency by
  identity; the hook compares its value.
- Inline edits do not move `viewKey`: `patchSong` (`:210-218`) and
  `handleTagsChange` (`:196-204`) touch `songs` only. The existing `frozen`
  mechanism (`:126-136`, `:324-330`) keeps row order stable across edits.
- The `#` column prints `String(index + 1).padStart(2, "0")` (`SongTableRow.tsx:75`),
  where `index` is the map callback's argument (`SongLibrary.tsx:609-611`). A slice
  taken from the front of `rows` therefore keeps the numbering correct; a window
  with a non-zero start would not.
- `aria-rowcount={rows.length}` sits on the `role="table"` element
  (`SongLibrary.tsx:598`). Rows carry no `aria-rowindex` (`SongTableRow.tsx:273-282`).
- `vitest` runs `environment: "node"` with `include: ["src/**/*.test.{ts,tsx}"]`
  (`vite.config.ts:24-25`). Only pure functions are testable without a DOM.
- The sandbox library holds 1,907 songs (measured 2026-10-30 from
  `~/.klangkurator/library.json`).
- 18 columns exist and all are visible by default (`useColumnConfig.ts:19-37`,
  `:51-54`).

## Decisions

1. **The rendered set is a prefix, never a window.** `rows.slice(0, count)` keeps the
   map index equal to the absolute row position, so the `#` column and
   `aria-rowindex` need no offset arithmetic.
2. **The step is a pure function** in the same module as the hook, so vitest covers
   the growth rule in a node environment. The observer wiring is covered by the live
   check.
3. **The observer root is the table's scroll container**, with a `rootMargin` of one
   container height. This makes "one screen ahead" mean one screen of the table.
4. **The reset key is `viewKey`.** It already means "a different list", and it is
   stable across inline edits, which is exactly the behaviour AC-11 and AC-12 ask
   for.
5. **No new dependency.** `IntersectionObserver` is a browser API; the app already
   targets it.

## The hook

```ts
export const REVEAL_PAGE = 50;

export function nextRevealedCount(count: number, total: number, page = REVEAL_PAGE): number
export function useRevealedRows(total: number, resetKey: string): {
  count: number;
  sentinelRef: (node: HTMLDivElement | null) => void;
}
```

`nextRevealedCount` clamps to `total` and never exceeds it. `useRevealedRows` returns
`min(page, total)` on a new `resetKey`, then grows by `page` per intersection while
it is below `total`.

## Data flow

Unchanged except at the render map:

- `songs` → `filterSongs` + sort → `filteredSongs` (`:306-323`) → `rows` (`:324-330`)
  — full list, as today.
- `rows.length` → `useRevealedRows(rows.length, viewKey)` → `count`.
- `rows.slice(0, count)` → the render map only.
- The header count (`:418-423`), `aria-rowcount` (`:598`), `rowsRef` (`:330`) and
  `playRun` (`:257`) keep reading the full `rows`.

## Gotchas

- The scroll reset must happen after the count resets and after React commits the
  new rows, or the browser clamps `scrollTop` against the old height. An effect keyed
  on `viewKey` runs after commit and is enough.
- The sentinel must sit outside `role="rowgroup"`; a non-row child of a rowgroup is
  invalid HTML and a screen reader may announce it as a row.
- `viewKey` is a new string object each render. The hook must compare the string
  value, not the reference, or it resets on every render.
- The existing focus handler writes `scrollTop` (`:565-584`). The sentinel observes,
  it does not scroll, so the two do not fight.

## Files

- `src/hooks/useRevealedRows.ts` — `nextRevealedCount`, `useRevealedRows`, `REVEAL_PAGE`.
- `src/hooks/useRevealedRows.test.ts` — the growth rule and its boundaries.
- `src/components/dj/SongLibrary.tsx` — the hook, the slice, the sentinel, the scroll
  reset.
- `src/components/dj/SongTableRow.tsx` — `aria-rowindex`.
- `src/components/dj/00_Index.md`, `src/hooks/00_Index.md` — the index lines.
- `docs/plans/00_Index.md` — the two new entries.
- `docs/requirements/13_LIBRARY_VIEW.md` — REQ-13-LR.
- `docs/requirements/90_NFRS.md` — a measurable NFR-3.
- `docs/requirements/99_CHANGELOG.md` — the dated entry.

## Verification

The gates in `AGENTS.md`, the before/after numbers in the issue, and the live check
at 1440, 1280, 768 and 375 px in both themes.
