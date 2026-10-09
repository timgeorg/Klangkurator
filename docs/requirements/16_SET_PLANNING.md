# Set Planning

Status: Active
Last Updated: 2026-10-08
Source: New — based on set planning session 2026-08-08

## Vision

Set planning is the killer feature. The core insight: **a DJ set is not a
playlist — it has a temporal arc**. The tool must support planning that arc,
not just ordering tracks.

The workflow mirrors how Tim plans sets in practice:

1. **Select crates** (folders) to draw from
2. **Filter and sort** the track pool by notes, tags, BPM, energy, vibe
3. **Define phases** (opening, building, sunset, peak, closing)
4. **Assign tracks to phases** — drag from pool to phase columns
5. **Reorder within phases** — micro-structure
6. **Review the arc** — energy curve, genre flow, artist clustering checks
7. **Persist the set** — save with all notes and transition markers

## Set Entity

| Field | Type | Description |
|---|---|---|
| `id` | string (UUID) | Stable |
| `name` | string | Set name (e.g. "Welzheimer Str Sunset 09.08.2026") |
| `event_name` | string? | Event/gig name |
| `event_date` | date? | When the set is planned for |
| `target_duration_min` | number? | Target set length in minutes |
| `crates` | string[] | Which root folders / crates this set draws from |
| `phases` | SetPhase[] | Ordered phases of the set |
| `notes` | string? | General set notes (vibe, crowd, venue) |
| `created_at` | ISO timestamp | |
| `updated_at` | ISO timestamp | |

### SetPhase

| Field | Type | Description |
|---|---|---|
| `id` | string (UUID) | Stable within the set |
| `name` | string | Phase name (e.g. "Opening", "Sunset Peak") |
| `position` | number | Order in the set (0-indexed) |
| `target_duration_min` | number? | Target phase length |
| `items` | SetItem[] | Ordered tracks or blocks in this phase |
| `notes` | string? | Phase-level notes (e.g. "People arriving, keep it ambient") |

### SetItem

| Field | Type | Description |
|---|---|---|
| `id` | string (UUID) | Stable within the phase |
| `type` | `"song"` \| `"block"` | Whether this item is a single track or a pre-built block |
| `ref_id` | string | Song ID or Block ID |
| `position` | number | Order within the phase (0-indexed) |
| `transition_notes` | string? | Notes about the transition into the next item |
| `alternative_transitions` | AltTransition[]? | Branching options to other songs/blocks |

### AltTransition
| Field | Type | Description |
|---|---|---|
| `ref_id` | string | Alternative song/block ID |
| `label` | string? | Why this is an option (e.g. "if crowd is more energetic") |

## Current Set Editor (flat running order)

The phase-based planner below is the target. What ships today is a flat
running order stored in the set's legacy `items` list (`phases` is kept but
not used by the UI):

- The Sets page lists each set as a contents page: a 2×2 mosaic (the set's
  colour tile with a whole disc, then black-and-white covers), the name in
  the serif, track count and total (and "of" the target when
  `target_duration_min` is set), and the first six items numbered
- The editor adds tracks and blocks from one searchable picker, moves items
  up and down, removes them, and takes a transition note between each pair
- Alternatives: from any transition, "Alternative" adds another possible next
  track, saved as `{ ref_id, label? }`; older `{ to_song_id, notes }` data
  reads the same
- Suggestions: saved `transition` relationships from the last track that
  plays (a block's last track counts) are offered as one-click additions
- Items resolve by `ref_id`; data written by older builds with `song_id` /
  `block_id` resolves too, and saving writes `ref_id`
- A deleted track or block keeps its slot as "Track no longer in the
  library" / "Deleted block" until removed (no title is stored, so the last
  known title cannot be shown); a block card counts its missing tracks
- Track lists keep a track's version or catalogue part ("(Club Remix)
  [CAT01]"), set quieter, so two versions of one track stay distinguishable
- Tracks stored in `phases` are not shown by this editor yet: the card and
  the editor say how many there are, and saving leaves them untouched

## Set Planning UI

### Step 1 — Crate Selection
- Shows all crates (folders) in the library
- Multi-select checkboxes or toggle chips
- Selected crates define the **track pool** for this set
- Track count shown per crate

### Step 2 — Track Pool
- Shows all songs from selected crates in a filterable, sortable table
- Same columns as library view, plus:
  - **Phase Tags** column (which phases this track fits)
  - **Vibe Tags** column (dark, uplifting, tearjerker, banger, etc.)
  - **In Set** indicator (already assigned to a phase)
- Filters: all library filters + phase tag filter + vibe tag filter
- Sort by: BPM, energy, danceability, social, duration, artist, title
- Search across notes

### Step 3 — Phase Board
- **Kanban-style board** with columns = phases
- Default phases: Opening, Building, Sunset Peak, After Sunset, Closing
- Phases are fully editable: rename, add, delete, reorder
- Each phase shows:
  - Phase name + target duration
  - Running duration (sum of assigned tracks)
  - Track count
  - Notes field for the phase
- Drag tracks from the pool into phase columns
- Drag between phases to reassign
- Drag within a phase to reorder

### Step 4 — Arc Review
- **Energy curve visualization**: line chart showing energy rating across all
  tracks in set order — see the arc at a glance
- **Genre flow**: horizontal bar showing genre color transitions across the set
- **Artist clustering check**: flags when the same artist appears 2+ times
  within 4 tracks (like the Bad Bunny clustering issue from the planning session)
- **Phase duration check**: flags phases that are over/under target duration
- **Tempo flow**: BPM across the set, flagging sudden jumps

### Step 5 — Export / Print
- Export set as:
  - **Markdown** (like the `09-08-2026_Welzheimer-Str-Sunset.md` format)
  - **Plain text** (tracklist for posting)
  - **JSON** (full data for backup/re-import)
- Print view: clean tracklist with phase headers, transition notes, and
  per-track notes visible

## Set Planning Checks (Automated)

These are the things a human DJ would flag when reviewing a set — the tool
automates them:

| Check | Trigger | Severity |
|---|---|---|
| Artist clustering | Same artist 2+ times within 4 tracks | Warning |
| Genre ping-pong | Genre switches back and forth 3+ times in one phase | Warning |
| Phase over duration | Phase exceeds target duration by 20%+ | Info |
| Phase under duration | Phase is under target duration by 20%+ | Info |
| Energy dip | Energy drops by 2+ levels between consecutive tracks at peak | Warning |
| Tempo jump | BPM changes by 10+ between consecutive tracks | Info |
| No closing track | Last phase has 0 tracks assigned | Error |
| Untagged track | Track in set has no phase tags and no notes | Info |

Checks run live as the user builds the set — they appear as non-blocking
badges in the Arc Review panel. The user can dismiss any check.

## Transition Notes

Transition notes are the connective tissue of a set:

- Each SetItem has `transition_notes` — how to mix into the next track
- Example: "mix A's outro into B's intro at 128 BPM, bring in B's percussion
  under A's last breakdown"
- When a `transition` relationship exists between two songs, the set editor
  surfaces it as a suggestion: "You have a saved transition to Track B"
- Transition notes are visible in:
  - The phase board (expandable per track)
  - The export (markdown/print)
  - The Arc Review (if missing between high-energy tracks → info flag)

## Relationship To Blocks

- A Block can be dropped into a phase as a SetItem (`type: "block"`)
- The block expands inline, showing its tracks with their transition notes
- Blocks are pre-built mini-mixes — they save time when a sequence is reused
  across sets (e.g. "Melodic Techno Opener" block in every sunset set)

## Persistence

- Sets are saved to `sets.json` (Phase 2) or `localStorage` (Phase 1)
- Saving a set does NOT modify the songs — it references them by ID
- If a song is deleted from the library, sets referencing it show a
  "missing track" placeholder with the last known title
- Sets can be duplicated (e.g. "copy last week's set and adjust")