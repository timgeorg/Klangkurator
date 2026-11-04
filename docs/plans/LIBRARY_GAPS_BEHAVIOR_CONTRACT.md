---
tags:
  - plan
  - library-gaps
  - contract
status: draft
created: 2026-11-04
source: session
---
# Behavior contract — library gaps (issue #9)

Written **before** implementation (Feature-Development-Playbook: user-facing
behavior change → behavior contract, judged source-blind by the Validator
against a sandbox copy of the library). The requirements are
[35_LIBRARY_GAPS.md](../requirements/35_LIBRARY_GAPS.md) (REQ-9-GR); the
algorithm and its numbers are in
[LIBRARY_GAPS_PLAN.md](LIBRARY_GAPS_PLAN.md).

Every clause below is observable from the running app and from
`GET /api/songs`, with no access to the source of the page.

## How to observe

- **The page:** open `/gaps` in the app. The four sections show in the fixed
  order BPM, energy, year, playtime.
- **A section's numbers:** the heading line of each section carries its
  measured count, its bucket count and its dense floor, in the mono face.
- **A region:** its row reads a range, an own count and two flank counts, for
  example `130–136 · 2 tracks · between 548 and 142`.
- **Recomputing the true answer:** `GET /api/songs` returns every track.
  Filter to `bpm > 0`, bucket at the width the section states, apply the floor
  the section states, and the region list must match exactly.
- **The library size:** the page's header meta says "1,907 tracks" on the
  sandbox; `GET /api/songs` gives the same number.

## The route and the entry

### LG-1 — the sidebar entry
**Given** the app is open
**when** the user looks at the sidebar
**then** there is a "Gaps" entry between "Sets" and "Import".

### LG-2 — the entry opens the page
**Given** that entry
**when** the user activates it
**then** the library gap report shows, and the entry carries
`aria-current="page"`.

### LG-3 — the report is read-only
**Given** the page is open
**then** it offers no button, link, field or menu that writes to the library,
and no download handoff to another tool.

### LG-4 — the library size is stated
**Given** the sandbox library
**then** the header states the number of tracks that `GET /api/songs` returns.

## The four dimensions

### LG-5 — the dimensions and their order
**Given** the page is open
**then** exactly four sections show, in the order BPM, energy, year, playtime,
and each states the bin width it used: 2 BPM, 0.5 rating points, 1 year,
120 seconds.

### LG-6 — a section states its own numbers
**Given** a section
**then** it states its measured count, its bucket count and its dense floor,
and each number agrees with the plan's formula applied to `GET /api/songs`.

### LG-7 — unmeasured values are left out
**Given** tracks whose `energy` is 0 or missing
**then** those tracks are absent from the energy section's measured count, and
they do not form a bin at the bottom of the energy histogram.

### LG-8 — the domain follows the data
**Given** a BPM range of 60.1 to 198.8
**then** the BPM section's lowest bin starts at 60 and its highest bin ends at
200, and no bin exists below 60 or above 200.

## The regions

### LG-9 — a region states its range, its count and its flanks
**Given** a section with at least one region
**then** each region row shows its low edge, its high edge, the count inside
it, and the count of the dense bin on each side.

### LG-10 — Tim's 130–134 BPM gap
**Given** the sandbox library at BPM width 2
**then** the BPM section lists a region from 130 to 136, holding 2 tracks,
between a left flank of 548 and a right flank of 142.

### LG-11 — the 124–128 region
**Given** the same library
**then** the BPM section lists a region from 124 to 128 holding 8 tracks,
between 417 and 548.

### LG-12 — energy reports not enough data
**Given** the sandbox library, whose measured energy count is 29
**then** the energy section reads "Not enough data" and lists no region.

### LG-13 — the year and playtime sections find nothing
**Given** the sandbox library
**then** the year section and the playtime section each list no region, and each
says so in its own words rather than being blank.

### LG-14 — an honest empty report
**Given** a library where no dimension has a region
**then** the page states that the library has no thin region and names the four
dimensions it checked.

### LG-15 — a region never touches the axis ends
**Given** any section
**then** no region's low edge is the section's lowest bin, and no region's high
edge is the section's highest bin.

### LG-16 — a bimodal library reports the space between
**Given** a library of 100 tracks at 120 BPM and 100 tracks at 140 BPM
**then** the BPM section lists one region spanning the space between them, with
flanks of 100 and 100.

## Design and access

### LG-17 — 375 px
**Given** a width of 375 px
**then** the page does not scroll sideways.

### LG-18 — both themes
**Given** the paper theme and then the ink theme
**then** every bar, edge label and region row stays legible, and no element
keeps a colour from the other theme.

### LG-17b — the BPM grid note is in the page
**Given** the BPM section on the sandbox library
**then** the section states, in prose above the region list, that BPM is
approximate, the grid constant `2583.98 ÷ k`, and that 31 of 37 distinct values
sit on it, so a hole between two grid points is partly a resolution effect.

### LG-17c — nothing is corrected
**Given** the BPM histogram
**then** the bins hold the stored values, and no value is snapped, rounded or
interpolated to hide the grid.

### LG-19 — orange is the finding, not a category
**Given** a section with a region
**then** the bars inside the region carry the signal colour and no other bar
does, and no dimension is identified by a colour of its own.

### LG-20 — the strip reads without seeing it
**Given** a screen reader
**then** each bar exposes its range and its count as its accessible name, and
the region rows are a list with one item per region.

### LG-21 — touch targets
**Given** a touch screen
**then** every control on the page is at least 44 px tall, and every one is
reachable with the keyboard and has an accessible name.

## Algorithm, judged from the data

### LG-22 — the floor
**Given** a section
**then** its stated dense floor equals `max(5, ceil(0.02 × measured))` for that
section's measured count.

### LG-23 — the ratio
**Given** a listed region
**then** its own count is at most 10 % of the smaller of its two flank counts.

### LG-24 — the guards agree with the data
**Given** the sandbox library
**when** the reader recomputes the BPM regions from `GET /api/songs`
**then** the list matches the page exactly, with no region missing and none
extra.
