# Blocks

Status: Active
Last Updated: 2026-08-09
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

- Add/remove/reorder songs via drag-and-drop
- Edit transition notes per song
- Shows running total duration
- Block card preview: name, song count, total duration, song-chain preview

## Reuse

Blocks are first-class entities — they can be dropped into multiple sets.
When a block is updated, all sets containing it reflect the update.