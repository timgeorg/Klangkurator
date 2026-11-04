---
tags:
  - plan
  - library-gaps
status: draft
created: 2026-11-04
source: session
---
# Technical plan — library gaps (issue #9)

The requirements are [35_LIBRARY_GAPS.md](../requirements/35_LIBRARY_GAPS.md)
(REQ-9-GR, PF-93). This plan fixes the algorithm, the numbers it was settled
on, and the one shape it ships. It is read before the code and it is the
record of what the build deliberately leaves out.

## What is built, and why this shape

One read-only page at `/gaps` with **four independent 1-D marginal
histograms**: BPM, energy, year, playtime. Each lists the bins where the
library is thin while both sides are dense.

The issue permits more: joint 2-D regions, density against the nearest
neighbour, a download handoff. Each is left out for a reason the issue itself
gives.

| Left out | Why |
|---|---|
| Joint 2-D regions | The issue: *"the canvas is already a 2-D projection, so a sparse area on the map is literally a visible white spot"*. #8 shipped, so that is its job (REQ-9-GR VC14). |
| Nearest-neighbour "bridge" detection | Needs a similarity metric and a threshold over it, which is #8's composite. Re-deriving it here would be a second, drifting definition. |
| A usage-weighted histogram | The issue: the intent signal is usage. The store holds no play count and no play history, and the sandbox's only usage is 1 set and 1 block over 49 of 1,907 tracks (2.6 %). Weighting 2.6 % of rows would be invented intent. Recorded as a limit, not faked. |
| A target-setting form | The issue rejects it in as many words: *"No target-setting UI, no 'I want deep 128–136 techno' form."* (REQ-9-GR VC13). |
| A download handoff to Sonotheca | PF-75 owns it. This change is read-only, which is what makes it safe to ship without a queue or a confirmation flow (VC13). |
| Genre-scoped histograms | Tempting for Tim's example (techno only), but it multiplies the surface and the numbers are worse, not better: a 177-track slice drops the dense floor to 5. The unscoped report already exposes the same BPM hole. Named as a follow-up, not built. |

**Why a page and not a section on the map rail.** A rail section would tie the
report to the map's route, its lazy chunk, its `?focus=` state and its
below-768 notice. The report has none of those needs, and the map rail is
already long (status, details, similarity, filters, core, layers, clusters).
A page is also the honest shape for a read-only report that is *not* a view of
the collection: it is a view of its absences.

## Algorithm contract

The traversal is: normalise → bucket → classify each bin → group → filter →
sort. It is pure, so it lives in `src/lib/libraryGaps.ts` with no React and no
`storage` import, and it is tested on synthetic data with known answers.

### Constants

```ts
export const MIN_MEASURED = 50;      // below this a dimension reports "not enough data"
export const DENSE_FLOOR_SHARE = 0.02; // 2 % of the measured tracks
export const DENSE_FLOOR_MIN = 5;    // but never below 5 tracks in a bin
export const THIN_RATIO = 0.1;       // a run is thin at ≤ 10 % of its smaller flank
```

### Dimensions and bin widths

| Dimension | Field | Width | Shown as |
|---|---|---|---|
| BPM | `bpm` | 2 | `128–130` |
| Energy | `energy` | 0.5 | `3.5–4.0` |
| Year | `year` | 1 | `2019–2020` |
| Playtime | `duration` | 120 s | `2:00–4:00` |

### 1. Normalise (the inclusion predicate)

A value is **measured** when it is a finite number greater than 0. That is the
same rule `toFeatures` applies in `src/lib/trackMap/features.ts` (`bpm`, `year`
and `duration` missing when absent, ≤ 0 or not finite; `energy` missing when 0,
because 0 means unrated). The page reads dimensions through `toFeatures`, so
one track and one rule produce the same numbers on the map and here.

An unmeasured value is **left out of its dimension** and never becomes a 0 bin.
That matters: an unrated energy of 0 is not "the library holds no 0–0.5 energy
tracks", and treating it as one would invent a gap at the bottom of the axis.

### 2. Bucket

```
low  = floor(min(values) / width) * width
high = floor(max(values) / width) * width + width
count = max(1, round((high - low) / width))
bin_i  = clamp(floor((value - low) / width), 0, count - 1)
```

The domain is **data-driven**, not a fixed 0–200 or 0–5 axis. A library that
ships only 120–140 BPM gets a 20-BPM-wide report with ten bins, not 100 empty
ones. `high` uses `floor(max/width)*width + width` so the maximum value falls
**inside** the last bin rather than off the end.

### 3. Dense floor

```ts
const floor = Math.max(DENSE_FLOOR_MIN, Math.ceil(DENSE_FLOOR_SHARE * n));
```

`n` is that dimension's measured count, not the library size: a dimension the
user has barely rated must not borrow confidence from the dimensions they have.

### 4. Classify, group, filter

A bin is **dense** when `count >= floor`. Group maximal runs of non-dense bins.
A run becomes a **region** only when all three hold:

1. a dense bin exists on its left and on its right (`i > 0 && j < count - 1`,
   and those two bins are dense),
2. `runTotal <= THIN_RATIO * min(leftFlank, rightFlank)`,
3. the run is not empty of bins (impossible by construction).

Condition 1 is what stops the lowest and highest bins from being regions: at
the edge of the data there is no second side to be thin *between*, and an edge
bin is where a dimension simply begins.

The `min` of the two flanks, not the mean: a run is thin when it is far below
**both** sides. `min` refuses a region that leans on one dense neighbour while
the other side is already small.

### Worked example, on real numbers

The sandbox library, BPM, width 2, `n = 1906` measured tracks of 1907.

`floor = max(5, ceil(0.02 × 1906)) = max(5, 39) = 39`.

The histogram around the techno range (2-BPM bins from 116):

```
116–118   0     124–126   2     132–134   0     140–142   0
118–120   0     126–128   6     134–136   0     142–144   0
120–122   0     128–130 548     136–138 142     144–146   0
122–124 417     130–132   2     138–140   0     146–148   0
```

Walk the runs (`floor = 39`):

| Run | Bins | Total | Left flank | Right flank | Cap `0.10 × min` | Region? |
|---|---|---|---|---|---|---|
| 118–122 | 2 | 0 | 73 | 417 | 7.3 | **yes**, 0 ≤ 7.3 |
| 124–128 | 3 | 8 | 417 | 548 | 41.7 | **yes**, 8 ≤ 41.7 |
| 130–136 | 3 | 2 | 548 | 142 | 14.2 | **yes**, 2 ≤ 14.2 |
| 138–142 | 2 | 0 | 142 | 197 | 14.2 | **yes**, 0 ≤ 14.2 |
| 144–152 | 4 | 1 | 197 | 114 | 11.4 | **yes**, 1 ≤ 11.4 |
| 154–end | — | 61 | — | — | — | no — the run reaches the last bin, so it has no right flank |

The run from 154 upward never meets another dense bin: every value above it is
37, 18, 5 or 1, all under the floor of 39. It therefore merges into the
trailing run that touches the top of the domain, and condition 1 rejects it.
That is the edge rule doing its job: an axis that fades out at the top is not a
hole *between* two populated sides.

Five regions. The third is Tim's 130–134 gap, in 2-BPM bins: **130–136 holds 2
tracks between a neighbour of 548 and a neighbour of 142**.

A tiny second example, to show the ratio doing work rather than the count:
`[60, 70, 80, 1, 85, 90, 95, 100]` has `n = 581`, `floor = 12`. Bin 3 holds 1
track and is the only non-dense bin. `1 ≤ 0.10 × min(80, 85) = 8.0`, so the run
is a region. Raise that bin to 9 and it stops being one: 9 is still under the
floor of 12, so the run is unchanged, but `9 > 8.0` breaks the ratio. The count
alone does not decide, the two flanks do.

### Boundary cases, and what each returns

| Case | Result | Why |
|---|---|---|
| Empty library | every dimension "Not enough data" | `n = 0 < 50` |
| One track | "Not enough data" | same guard |
| 49 tracks | "Not enough data" | the guard is `< 50`, inclusive at 50 |
| 50 tracks, all at 128 BPM | one bin, no region | a single bin has no two sides |
| 200 tracks, one dense bin | no region | domain is one bin wide |
| A flat uniform range (every bin 5) | no region | every bin is dense at `n=200, floor=5` |
| Genuinely bimodal (100 at 120, 100 at 140) | one region, 122–140 | the space between two dense sides is exactly the definition |
| A hole touching the last bin | no region | condition 1 fails: no right flank |
| One track in an otherwise empty middle | one region | 1 ≤ 0.10 × flank, as in Tim's example |
| Every bin equal | no region | every bin is dense |

The "genuinely bimodal" case is the one that must be reported, and the "hole at
the edge" case is the one that must not: the report is about the space
*between* things you have, and an edge is not between anything.

## Data flow

```
storage.getSongs()  ──►  buildFeatures? no: toFeatures(song) per song
        │                        │
        │                        └─ ► { bpm, energy, year, duration }
        ▼
  src/lib/libraryGaps.ts  (pure)
        │  reportLibraryGaps(features[]) → DimensionReport[]
        ▼
  src/pages/LibraryGaps.tsx  (route /gaps)
        │
        └─► HistogramStrip + RegionList per dimension
```

`reportLibraryGaps` takes the four numbers and nothing else, so a component
never re-derives a rule. `src/lib/libraryGaps.ts` imports `toFeatures` from the
map's `features.ts` and never the track map's components.

## Files

| File | Change |
|---|---|
| `src/lib/libraryGaps.ts` | new — the pure algorithm and its types |
| `src/lib/libraryGaps.test.ts` | new — known-answer tests, plus the boundary table above |
| `src/pages/LibraryGaps.tsx` | new — the `/gaps` page |
| `src/pages/00_Index.md` | new row |
| `src/lib/00_Index.md` | new row |
| `src/App.tsx` | the route |
| `src/components/layout/DJSidebar.tsx` | the nav entry |
| `docs/requirements/35_LIBRARY_GAPS.md` | new — written first |
| `docs/requirements/00_Index.md`, `00_INDEX.md`, `92_PLANNED_FEATURES.md`, `99_CHANGELOG.md` | the index, PF-93, the changelog entry |
| `docs/plans/LIBRARY_GAPS_PLAN.md` | this file |
| `docs/plans/LIBRARY_GAPS_BEHAVIOR_CONTRACT.md` | the contract, written before the build |
| `docs/plans/00_Index.md` | two rows |

No backend change. No store change. No new dependency — the histogram is a
loop over an array of at most a few hundred bins.

## Interaction semantics

- **No controls that change the report.** The four dimensions always show, in
  the fixed order BPM, energy, year, playtime. There is no width picker, no
  threshold slider and no filter: a threshold the user can tune is a
  target-setting form by another name, and the issue rejected that.
- **One disclosure per dimension.** The histogram strip is always drawn, and
  the region list is always drawn beneath it. Nothing is hover-only, so nothing
  needs a keyboard twin.
- **The one orange thing** is the region mark on the strip: the bars that form
  a region carry the signal colour, because they are "this one" — the finding.
  Every other bar is `bg-foreground/15` on its ground. Orange is never used to
  mean a dimension.
- **A bar and its number.** Each bar has a tooltip (title attribute) and an
  `aria-label` with its range and count, so the strip reads on a screen reader
  without the visual.
- **The empty report** is an inline `EmptyState`, not a page one: the page still
  has four sections to describe.

## Tests and gates

- `src/lib/libraryGaps.test.ts` covers the worked example, both tiny examples,
  and every boundary row above. Two mutations must each kill a test:
  1. `min(leftFlank, rightFlank)` → `max(...)`: the "one track between 200 and
     200" case and the real 130–136 region both survive, but a run of 8 with
     flanks 417/548 stays a region while a run leaning on a small flank does
     not — the test at bin 154–160 catches it.
  2. `<=` → `<` in the ratio test: the "9 vs 8.0" case flips.
  3. `>=` → `>` in the dense test: the 50-track case at exactly `floor` changes.
- Gates: `tsc`, `vitest`, `pytest backend/tests`, `eslint` on the changed files,
  `vite build`, and the code-standards gate.
- A live check at 1440, 1280, 768 and 375 px in both themes.

## The BPM grid, made visible (settled 2026-11-04, after the measurement)

The report first shipped with the lattice caveat only in the requirements'
known limits. That was not enough: a gap finder that names the 130–134 techno
hole without saying that the BPM axis is quantised would send the user to buy
records for a hole in his own analyser. So the note moved into the page.

`gridFit(values)` measures, and never corrects:

```
constant = 60 × 22050 / 512          // 2583.984, from beat_track's defaults
k        = round(constant / value)
onGrid   = |constant / k − value| <= 0.05
```

It reports `onGrid` against `distinct`. On the sandbox library that is **31 of
37**, and a test fixes those numbers against the exact histogram. Nothing is
snapped, rounded or interpolated (REQ-9-GR VC18): the bins hold the stored
values, and the note sits in the BPM section in the reader's language, above
the region list, where it cannot be missed (VC17).

The consequence for the product, stated plainly: **the BPM dimension is
approximate and the other three are not.** Energy, year and playtime do not
come from `beat_track`, so they carry the feature. On the sandbox, energy is
under the resolution guard and year and playtime find no region — which makes
BPM the only section with output, and the reason its caveat is written into
the page rather than into a footnote.

## Risks

- **The analyser lattice.** 31 of 37 distinct BPM values sit on
  `60 × (22050/512) / k`. A thin BPM bin can be a hole in the analyser's grid
  rather than in the collection. Not fixable here — fixing it means re-analysing
  with a finer hop. The page names the limit and the requirements record it.
- **A dimension with a small measured count.** Energy has 29 measured tracks of
  1907, so it reports "Not enough data" on this library. That is the honest
  answer, not a bug.
- **The report may find nothing.** Year and playtime find no region on the real
  library. That is a finding, and the page states it rather than inventing a
  threshold that produces output.
