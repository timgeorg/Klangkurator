# Transition Mining

Status: Planned (Post-MVP, core differentiator)
Last Updated: 2026-08-09
Source: User refinement 2026-08-09; existing transition relationship concept

## Principle

**Transitions are the DJ's craft knowledge.** Knowing that "Track A mixes
beautifully into Track B at the 2:06 mark with a 16-bar blend" is hard-won
knowledge that currently lives only in the DJ's head. Klangkurator mines,
stores, and surfaces this knowledge.

This is a **core differentiator** — no other DJ tool treats transitions as
first-class entities with rich metadata and mining capabilities.

## Transition Entity (Future Evolution)

Currently transitions are stored as `relationship` entities with
`type: "transition"`. As the mining feature evolves, transitions promote
to a dedicated entity (see [14_RELATIONSHIPS.md] for the proposed schema).

Key fields that go beyond the current relationship model:

| Field | Description |
|---|---|
| `mix_point_in` | Timestamp in the source track where the transition starts |
| `mix_point_out` | Timestamp in the target track where the mix lands |
| `technique` | `beatmatch`, `echo_out`, `cold_drop`, `filter_sweep`, `wordplay`, etc. |
| `bpm_at_transition` | BPM at the handoff point |
| `energy_delta` | Energy change across the transition (-5 to +5) |
| `rating` | How well it worked (0–5) — rated after playing it live |
| `source` | `manual`, `mined_from_set`, `imported_from_rekordbox`, `ai_suggested` |
| `played_count` | How many times this transition has been played live |

## Mining Sources

### 1. Mine from Existing Sets (PF-40)
- Analyze saved sets and blocks
- Extract every adjacent track pair as a transition
- Populate `transition_notes` from the set's per-item notes
- Mark `source: "mined_from_set"`

### 2. Mine from Rekordbox History (PF-44)
- Parse Rekordbox play history (tracks played in order at a gig)
- Extract adjacent track pairs as transitions
- These are **proven transitions** — they were played live
- Mark `source: "imported_from_rekordbox"`
- Can also rate them: if the DJ played the same transition at multiple gigs,
  it probably works well → higher `played_count`

### 3. Manual Entry
- DJ writes a transition directly: "A → B, mix at 2:06, 16-bar blend"
- Mark `source: "manual"`

### 4. AI Suggested (PF-51, future)
- AI proposes transitions based on BPM/key compatibility, energy flow,
  genre adjacency, and existing transition history
- Mark `source: "ai_suggested"`
- Always requires DJ confirmation before becoming a rated transition

## Transition Suggestion Engine (PF-41)

When the DJ is building a set and places Track A in a phase, the engine
surfaces suggestions for what could come next:

1. **History-based**: "You've transitioned A → B 3 times, avg rating 4.5"
2. **Compatibility-based**: "B, C, D are within 2 BPM and compatible keys"
3. **Energy-based**: "You need +1 energy — E, F, G are candidates"
4. **Genre-flow-based**: "Your genre is House → these Afro tracks bridge well"

Suggestions are ranked and shown as quick-add buttons in the set editor.

## Transition Library View (PF-43)

A dedicated view to browse, search, and manage all known transitions:
- Filter by technique, rating, source, genre pair
- Search by track name (either side)
- Sort by rating, played_count, recently used
- Visual: A → B pairs with technique and rating badges
- Edit transition metadata (technique, mix points, notes, rating)
- Delete transitions that don't work

## Transition Compatibility Scoring (PF-42)

Score how well two tracks transition based on:

| Factor | Weight | Calculation |
|---|---|---|
| BPM proximity | 30% | Closer BPM = higher score |
| Key compatibility | 25% | Camelot wheel distance |
| Energy delta | 20% | +0 to +1 is ideal; -2 or +3 is risky |
| Genre adjacency | 15% | Same genre or known-compatible genres |
| Transition history | 10% | If A → B has been played before, bonus |

Score is 0–100, shown as a green/yellow/red indicator in the set editor.