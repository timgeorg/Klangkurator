# Relationships (Knowledge Graph)

Status: Active
Last Updated: 2026-08-09
Source: Requirements.md section 7

## Relationship Types

| Type | Description |
|---|---|
| `remix` | Track A is a remix of track B |
| `same_sample` | Both tracks sample the same source |
| `cover` | Track A covers track B |
| `mashup` | Track A is a mashup containing track B |
| `edit` | Track A is an edit of track B |
| `bootleg` | Track A is an unofficial remix of track B |
| `in_playlist` | Track appears in a playlist (auto-managed) |
| `transition` | Track A transitions well into track B (DJ-defined) |

## Unified Relationships Dialog

One component used from both: (a) clicking a song title, (b) the Edit Song dialog.

### List View
- Existing relationships with delete buttons
- Inline add form with searchable Combobox for picking target song
- "In Playlists" section: shows which playlists contain the song + position

### Graph View
- HTML canvas, nodes = songs, edges = color-coded by relationship type
- Center/base node always rendered in a neutral color
- Song titles visible by default (no hover required)
- Clicking another node **navigates** — that song becomes the new center,
  canvas updates instantly (via `key` remount), with back-button history
- Dark background + subtle grid, gradient fills, glow, generous spacing

## Transition Relationships And Set Planning

`transition` relationships are the backbone of set planning — see also
[31_TRANSITION_MINING.md](31_TRANSITION_MINING.md) for the full transition
mining feature.

- When building a set, the set editor surfaces **transition suggestions** from
  existing `transition` relationships as quick-add buttons
- "Track A transitions well into Track B" means the DJ has used this
  transition before and it worked — this is hard-won knowledge
- Transition relationships can have notes: "mix A's outro into B's intro at
  128 BPM, bring in B's percussion under A's last breakdown"

### Transition as a First-Class Entity

In the current model, transitions are stored as `relationship` entities with
`type: "transition"`. As the transition mining feature (PF-40+) evolves,
transitions may be promoted to a dedicated `Transition` entity with richer
metadata:

| Field | Description |
|---|---|
| `from_song_id` | Source track |
| `to_song_id` | Target track |
| `mix_point_in` | Timestamp in the source track where the transition starts |
| `mix_point_out` | Timestamp in the target track where the mix lands |
| `technique` | `beatmatch`, `echo_out`, `cold_drop`, `filter_sweep`, `wordplay`, etc. |
| `bpm_at_transition` | BPM at the handoff point |
| `energy_delta` | Energy change across the transition (-5 to +5) |
| `rating` | How well it worked (0–5) — rated after playing it live |
| `source` | `manual`, `mined_from_set`, `imported_from_rekordbox`, `ai_suggested` |
| `played_count` | How many times this transition has been played live |
| `notes` | Free-text notes about the transition |

This is a **future evolution** — the MVP uses the simpler `relationship` model.
See [31_TRANSITION_MINING.md](31_TRANSITION_MINING.md) for the full plan.