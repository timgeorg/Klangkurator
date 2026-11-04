# Library Gaps

Status: Active
Last Updated: 2026-11-04
Source: issue #9, read on 2026-11-04 with
`gh api repos/timgeorg/Klangkurator/issues/9 --jq .body`. The issue was parked
on 2026-10-14 and carries the intent discussion and the gap definitions below.
Plan: [`docs/plans/LIBRARY_GAPS_PLAN.md`](../plans/LIBRARY_GAPS_PLAN.md).
Contract: `LIBRARY_GAPS_BEHAVIOR_CONTRACT.md`.

A read-only report of where the library is thin in one dimension at a time. It
answers the inverse of a set-scoped fill. A set-scoped fill asks which owned
track fills this hole. This report asks which region of the collection holds
almost nothing while its neighbours hold a lot.

## The ask (Tim, 2026-10-13, verbatim)

> *"The canvas or the similarity search can also help to find white spots in
> the library, where digging of new songs is maybe due. For example if there
> is a gap in the techno BPM. Like almost no tracks between 130-134BPM but
> below and above that much exists. This is also an intention between the
> similarity and canvas feature in the klangkurator to better work with the
> existing library."*

## Why it is built now

The issue's status of 2026-10-14 reads: *"do not build now … Reconsider after
#8's canvas exists and has been used"*, and calls the issue *"a candidate to
close as covered by #8 rather than to schedule"*. Tim pulled every open issue
back up on 2026-11-04, which is the trigger the issue named.

**This change builds the narrowest defensible shape.** The issue warns against
building a gap-finder because it is a good idea in the abstract. It says to
build one only if working with #8 leaves a felt need. That warning is in the
issue body, under "The hard question" and under "Open questions". So this
change builds the 1-D marginal report only. That report needs no
intent model and no canvas. The joint 2-D region stays the canvas's job
(REQ-9-GR VC14). The download handoff stays PF-75.

## What a gap means here (decided in the issue)

An empty region is not automatically a gap worth filling. The issue settles
that the intent signal is usage, not configuration:

> *"True, you dont own everything isnt good. And I guess if I truly need
> something it will come up during working with the app myself."*

So the app carries no target-setting form (REQ-9-GR VC13). The threshold is **relative**, not a
bare count. The issue puts it as *"density against local neighbours — 'empty
between two dense sides'"*.

### The thin-region report, one dimension at a time (REQ-9-GR, issue #9)

Status: Active
Priority: P2
Basis: V — Tim, 2026-11-04, "implement all currently open github issues", which is the pull-back-up the parked issue named. The ask itself is the 2026-10-13 quote above. VC2, VC3, VC5 and VC9 are I: they fix the bin set, the resolution guard and the flanks. VC4, VC6 and VC12 are I: they set the numeric constants the gate grades. VC11 is I: a report with no write path follows from "read-only". VC14 to VC16 are V: they are the issue's own scope decisions.
Serves: the user sees where the collection is thin. They learn what to dig for, without a form that asks what they intend to own.

Must not change: the library table, the map, the sets, the player, and every
stored file. This report reads and draws. It writes nothing anywhere.

Verification criteria:

- VC1: The sidebar shows a "Gaps" entry.
- VC2: The report covers four dimensions: BPM, energy, year and playtime.
- VC3: Each dimension buckets the library into fixed-width bins: 2 BPM, 0.5
  rating points, 1 year and 120 seconds.
- VC4: A dimension with fewer than 50 measured tracks reports "Not enough
  data" and no region. A track counts as measured for a dimension when that
  value is present, finite and greater than zero.
- VC5: A bin is dense when its count reaches its dimension's dense floor. The
  floor is the larger of 5 and 2 % of that dimension's measured tracks, rounded
  up.
- VC6: A thin region is a run of one or more adjacent bins that are not dense.
  A dense bin bounds the run on each side. The run's total count is at most
  10 % of the smaller of the two flank counts.
- VC7: Each region shows its low edge, its high edge, its own count and the
  count of each flank.
- VC8: A run that touches the lowest or the highest bin is not a region,
  because one side has no dense bin.
- VC9: Every bin holding the same count leaves no region.
- VC10: A bin thinner than both its neighbours is one region. Its flanks are
  the nearest dense bin on each side.
- VC11: With no region in any dimension, the page says that the library has no
  thin region and names the four dimensions it checked.
- VC12: Each dimension's section shows its bucket count, its measured count and
  its dense floor.
- VC13: The page has no action that writes, no target field and no download
  handoff.
- VC14: The report finds regions in one dimension at a time. It never reports a
  region in two dimensions together.
- VC15: At a width of 375 px, the page does not scroll sideways.
- VC16: Every action on the page is at least 44 px on a touch screen, and every
  one is reachable and named with the keyboard.
- VC17: The BPM section names the analyser's tempo grid in the page itself. It
  gives the count of distinct BPM values on that grid against the total. So a
  hole between two grid points reads as partly a resolution effect.
- VC18: The report never snaps, rounds or interpolates a BPM value. The bins
  hold the values the analyser stored.

**Known limits, recorded rather than hidden:**

- The usage weighting the issue describes is not built. No field weights a
  dimension by use, because the store holds no play count and no play history
  (`library.json`, read 2026-11-04). The sandbox's 1,907 tracks sit in one set
  and one block, which is 49 distinct tracks, or 2.6 %. That signal is too
  thin to weight a histogram without inventing intent. The report carries no
  weight, and this line records that.
- **The BPM dimension is approximate, and the page says so (VC17).** The app
  reads tempo with `beat_track(hop_length=512, sr=22050)`
  (`backend/scanner/audio_analysis.py`), whose grid is `60 × 22050 / 512 ÷ k` =
  `2583.984 / k`. On the sandbox library, 31 of the 37 distinct BPM values sit
  on that grid within 0.05 BPM. The other 6 are the hand-entered ones.
  A thin BPM bin between two grid points is therefore partly a hole in the
  analyser's resolution, not only a hole in the collection. The report shows
  this in the BPM section rather than in a footnote, and it never compensates:
  the bins hold the stored values (VC18). Energy, year and playtime do not come
  from `beat_track`, so they carry the report without this limit.
