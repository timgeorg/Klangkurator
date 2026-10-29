# Technical plan — crate tabs: collapse and multi-select (issue #49)

Spec: `docs/requirements/13_LIBRARY_VIEW.md` REQ-13-CT. Contract:
`CRATE_TABS_BEHAVIOR_CONTRACT.md`. Branch: `feature_49_crate-tabs` from `int`.

## Verified facts (2026-10-23, `int` @ ab17b60)

- `filters.rootFolder` is `string[]` (`src/components/dj/libraryTable.ts:18`),
  the predicate is `includes` (`:126`), and the Crate column filter is a
  multi-select (`:57`). The map uses the same predicate and filter state
  (TM-R11).
- The tabs force one crate: `activeCrate` exists only for exactly one crate
  (`src/components/dj/SongLibrary.tsx:401`), and a click replaces or clears it
  (`:460`). Tab group `:447-463`; `CrateTab` `:634` is `h-8`; crates sorted by
  collator (`:273-280`).
- `describeFilter` (`SongLibrary.tsx:668-681`) already renders "A, B" / "N
  selected"; it stays unchanged.
- WebKit and Chromium copy Shift onto keyboard-synthesised clicks, so no key
  handler is needed. Space clicks on key-up, so Shift must still be held.
- pywebview runs in private mode (`backend/pywebview_launcher.py:98`;
  `private_mode` defaults to True), so `localStorage` does not survive a
  desktop relaunch. This is accepted as a known limit, the same as for the
  column layout.
- vitest is node-only, with no DOM libraries (`vite.config.ts:21`); nothing
  covers `SongLibrary` or `libraryTable` yet.
- `SongLibrary.tsx` has 46 hook calls and no early return before `:403`.
- Live library: 27 crates (Tim, 2026-10-23).

## Files in scope

- `src/components/dj/SongLibrary.tsx`
- `src/components/dj/libraryTable.ts`
- `src/components/dj/libraryTable.test.ts`
- `src/components/dj/00_Index.md`

## Steps

1. **Pure helpers in `libraryTable.ts`:**
   - `toggleCrate(selection, crate)`: removes the crate when present, appends
     it when absent.
   - `clickCrate(selection, crate)`: `[crate]`, or `[]` when the selection is
     exactly `[crate]`.
   - `visibleCrates(crates, selection, expanded, limit = 10)` →
     `{ shown, hidden }`. Expanded, or `crates.length <= limit`, gives all and
     `hidden: 0`. Otherwise it gives the first `limit`, then the selected crates
     beyond them in tab order, with `hidden` = the rest.
2. **Collapse state:** in `SongLibrary.tsx`,
   `const [cratesExpanded, setCratesExpanded] = useState(readCratesExpanded)`.
   It is a lazy initialiser that reads `localStorage` key
   `klangkurator.crates.expanded` in try/catch, default `false`. The toggle
   handler writes it, also in try/catch.
3. **Clicks:** a crate tab's `onClick` is
   `(e) => updateFilter("rootFolder", e.shiftKey ? toggleCrate(sel, crate) : clickCrate(sel, crate))`.
   `active = sel.includes(crate)`, and "All tracks" always clears.
4. **Render:** call `visibleCrates(...)` in JSX (no new memo). The toggle tab
   comes after the shown crates when there are more than 10 crates and either
   the bar is expanded or `hidden > 0`. It carries `aria-expanded` and reads
   "+N more" or "Show fewer".
5. **Focus:** when the focused tab unmounts (a crate beyond the first 10 is
   deselected while collapsed), move focus to the toggle (ref on the toggle;
   check `document.activeElement` before the filter update).
6. **Polish:** `select-none` on the tab group, and
   `title="Shift+click to add or remove"` on crate tabs.
7. **Touch:** `[@media(pointer:coarse)]:min-h-11` on `CrateTab` and the toggle
   (precedent `src/components/dj/NowPlaying.tsx:375`).
8. **Index:** add the test file to `src/components/dj/00_Index.md`.

## Hook ordering

No new effect or memo. The collapse state is one more `useState` among the
existing state hooks, with a lazy initialiser. `visibleCrates` is a pure call
in JSX, after `crateCounts` (`:273`) and `filters` (from `useLibraryFilters`,
`:83`) are defined.

## Tests (`libraryTable.test.ts`)

- `toggleCrate`: adding a crate, removing one, and removing the last one gives
  `[]`.
- `clickCrate`: clicking a member of a multi-selection gives just that crate;
  clicking the sole selected crate gives `[]`.
- `visibleCrates`:
  - 10 crates: all shown, `hidden: 0`.
  - 11 crates: 10 shown, `hidden: 1`.
  - 27 crates with the 13th selected: 11 shown, `hidden: 16`.
  - Every hidden crate selected: `hidden: 0`.
  - Expanded: all shown.

## Gates (repo `AGENTS.md`)

`npx tsc --noEmit -p tsconfig.app.json` (no new errors) ·
`python -m pytest backend/tests` · `npx eslint <changed files>` ·
`npx vite build` · `npx vitest run`.

Live check in both themes at 1440, 1280, 768 and 375 px against:
- the sandbox copy (27 crates);
- synthetic libraries from `scripts/make-synthetic-library.ts --crates 10` and
  `--crates 11`.

Then the impeccable audit of the tab bar.

## PR

Into `int`, titled for #49. No `Closes` keyword.
