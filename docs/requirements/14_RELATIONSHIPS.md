# Relationships (Knowledge Graph)

Status: Active
Last Updated: 2026-10-08
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

One component, opened from the song detail page's "Relationships" action and
from the Edit track dialog.

### List View
- Existing relationships with delete buttons
- Inline add form with searchable Combobox for picking target song
- "In Playlists" section: shows which playlists contain the song + position

### Graph View
- HTML canvas, nodes = songs as black-and-white cover discs, related songs on
  an ellipse around the centre song; the centre song carries the orange cut
- Each relationship type has its own line, so the graph also reads in
  grayscale: `transition` solid and heavier in the foreground colour; `remix`,
  `edit`, `cover` solid in violet, green, cobalt; `mashup`, `bootleg` dashed
  in rose, clay; `same_sample`, `in_playlist` dotted in ochre, slate
  (source of truth: `src/lib/relationshipStyle.ts`)
- A legend lists all eight types with their line
- Song titles visible by default (no hover required); edge labels sit off
  the node so they don't overlap
- Clicking another node **navigates** — that song becomes the new center,
  with back-button history; this works the same from the list view
- Follows the theme (ink or paper): colours come from the design tokens, and
  the canvas redraws when the theme changes; no grid, glow or gradients

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