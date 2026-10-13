# Behavior contract — decimal energy (issue #7)

Written **before** implementation (Feature-Development-Playbook, task-type
cross-reference: user-facing behavior change → behavior contract, judged
source-blind by the Validator).

## Fields in scope

`energy`, `danceability`, `social_acceptance` — one decimal (step 0.1), 0–5.
`rank` is **out of scope**: stays whole 1–5 stars.

## Clauses (given / when / then)

### BC-1 — dialog entry
**Given** the Edit dialog is open on a song with energy `3`
**when** the user drags the Energy slider one fine step
**then** the value reads `3.1`, the label shows `3.1/5`, and saving persists `3.1`.

### BC-2 — exact decimal round-trips
**Given** a song stored with energy `3.8`
**when** the library table loads it from the backend
**then** the value arrives as `3.8` (no 422/500, no silent rounding).

### BC-3 — meter display floors (the decision)
**Given** a song stored with energy `3.8`
**when** the table's five-bar meter renders it
**then** exactly **3** bars are filled (floor, never round-to-4), and the
tooltip reads `Energy 3.8/5`.

**Given** energy `3.0`
**then** 3 bars fill (3.0 and 3 behave identically in display).
**Given** energy `0.4`
**then** 0 bars fill.

### BC-4 — decimal-safe ordering
**Given** songs with energy `3`, `3.8`, `4`, and one unrated `0`
**when** sorting by Energy ascending
**then** order is `0(last), 3, 3.8, 4`. Descending: `4, 3.8, 3`, unrated last.

Wait — sort asc puts `0` first by value. Sorting by a 0–5 field where 0 means
"unrated": on `origin/main` today, unrated (0) sorts FIRST ascending already
(`energy: (s) => s.energy` — no `|| undefined`). That is the shipped pre-existing
behavior for these three fields (issue #4 introduced `rank`'s
`|| undefined` pattern only for rank). This feature does **not** change
sort semantics of the 3 ratings. Corrected clause:

**Given** songs with energy `3`, `3.8`, `4`, `0`
**when** sorting by Energy ascending
**then** order is `0, 3, 3.8, 4` (0 sorts first — unchanged from today).

### BC-5 — range filter accepts decimals
**Given** songs with energy `3`, `3.8`
**when** the user filters Energy ≥ `3.5`
**then** only the `3.8` song remains, and the filter chip reads `≥ 3.5`.

### BC-6 — rank untouched
**Given** a song with rank `4` and energy `3.8`
**when** saved from the Edit dialog
**then** rank stays `4` (integer slider) and energy stays `3.8` (decimal slider).

### BC-7 — legacy integer data keeps working
**Given** songs saved before this change (energy `3`, no decimals)
**when** the app loads and edits them
**then** everything works unchanged — integer values are valid decimals
(`3` ≡ `3.0`), the meter shows 3 bars, no migration needed.

### BC-8 — detail page unchanged
**Given** the song detail page (shows Rank only)
**when** opened for a song with energy `3.8`
**then** nothing about energy renders there — no new display to fix,
no regression.

### BC-9 — legacy data with stray decimals in storage
**Given** a `library.json` where a song's energy was hand-edited to `3.8`
while the backend model was still `int` (i.e. the JSON predates the field
type change)
**when** any song is fetched
**then** the list returns normally (no 500) — the widened model accepts it.

## Out of scope

- Inline table editing (issue #3's work — on a different branch; its
  `InlineCells.tsx` must do its own floor on read when that lands).
- The unused `ui/rating.tsx` / `energy-bar.tsx` components (not rendered
  anywhere; not touched).
- The two decimal filter-entry niceties beyond chip display (steps, snapping).