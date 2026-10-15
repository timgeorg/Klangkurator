# Relationships (Knowledge Graph)

Status: Active
Last Updated: 2026-10-15
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
- *(changed in PF-81, [33_TRACK_MAP.md](33_TRACK_MAP.md) REQ-33-DG)* The graph
  is a small instance of the track map's canvas: the same renderer
  (`src/components/map/TrackMapCanvas.tsx`) and the same headless layout
  (`src/lib/trackMap/layout.ts`), still only the song and its relationship
  partners (all eight types). The dialog opens with its song selected; the
  song sits at the origin with its partners around it, one line style per
  relationship type. Clicking a track, or choosing an entry in the details'
  partner list, selects it and shows its details beside the canvas; re-centring
  moves to the **Show its relationships** action, with the same back-button
  history. A legend under the canvas lists the relationship types on screen,
  each with its line style. **Open in map** (phase 7) continues into the full
  map with this song and its partners as a removable filter
- The selected track's details are compact: title, artist, its relationship
  partners as a list (each entry selects that track) and the actions **Play**
  (a run of one), **Song page** and **Show its relationships**. It shows no
  nearest tracks — those belong to the map rail
- A node is a track: a disc in its main genre's user colour, neutral when it
  has none. Orange means "this one": the playing track carries the orange cut,
  the selected track the focus ring. Hovering a track highlights it and its
  edges and dims the rest
- Each relationship type has its own line, so the graph also reads in
  grayscale: `transition` solid and heavier in the foreground colour; `remix`,
  `edit`, `cover` solid in violet, green, cobalt; `mashup`, `bootleg` dashed
  in rose, clay; `same_sample`, `in_playlist` dotted in ochre, slate
  (source of truth: `src/lib/relationshipStyle.ts`)
- Song titles show at close zoom, and always on the hovered and selected
  tracks; a line leaves a gap at a node's edge, so the two never overlap
- Clicking empty canvas clears the selection
- Follows the theme (ink or paper): colours come from the design tokens, read
  at runtime, and the canvas redraws when the theme or cover mode changes; no
  grid, glow or gradients

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