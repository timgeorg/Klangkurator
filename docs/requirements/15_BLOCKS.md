# Blocks

Status: Active
Last Updated: 2026-10-14
Source: Requirements.md section 10.1

## Concept

A **Block** = an ordered sequence of songs glued by transitions (a reusable
mini-mix). Think of it as a pre-built segment that you can drop into any set.

Example: "Melodic Techno Opener" block = 5 tracks that always work together
as an opening sequence.

## Block Entity

| Field | Type | Description |
|---|---|---|
| `id` | string (UUID) | Stable |
| `name` | string | Block name (e.g. "Sunset Afro House Block") |
| `description` | string? | What this block is for |
| `color` | string? | Visual color for set builder |
| `songs` | BlockSong[] | Ordered list of songs with transition notes |
| `created_at` | ISO timestamp | |
| `updated_at` | ISO timestamp | |

### BlockSong
| Field | Type | Description |
|---|---|---|
| `song_id` | string | Reference to song |
| `position` | number | Order in the block (0-indexed) |
| `transition_notes` | string? | Notes about the transition into the next song |

## Block Editor

- Add tracks from a searchable picker (title, artist, album); a track is in a
  block at most once
- Reorder with move up / move down buttons (keyboard reachable; focus follows
  the moved row); remove a track; drag-and-drop is not built
- A transition note sits between each pair of tracks (`transition_notes` on
  the earlier track)
- Shows the track count and running total duration
- A block needs a name and at least two tracks; both are checked on save with
  an inline message
- A track that left the library keeps its slot as "Track no longer in the
  library" until it is removed
- A row's number turns into Play on row hover or keyboard focus: the block
  plays from that track in the order on screen, saved or not, and the
  player's next / previous step through it (PF-80). A missing track's row
  has no Play

## On the Sets page

- One row per block: a strip of its colour tile (half disc) and up to four
  black-and-white covers, the name, description, the chain of track titles,
  track count, total duration and how many sets use it
- Play plays the block from its first track (unavailable while it has no
  tracks); the player's next / previous step through it (PF-80)
- Play, edit and delete are always visible; deleting asks first and says how many
  sets use the block. Those sets keep the slot, marked "Deleted block", until
  it is removed from them

## Reuse

Blocks are first-class entities — they can be dropped into multiple sets.
When a block is updated, all sets containing it reflect the update.