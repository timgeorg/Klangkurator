# Relationships (Knowledge Graph)

Status: Done
Last Updated: 2026-11-04
Source: Requirements.md section 7, and Tim, 2026-11-03 and 2026-11-04
(relationship types the user edits, issue #81)

## Relationship Types

A relationship type is an entry the user owns: `{id, name, color, both_ways,
opposite_id}`. The list lives in `library.json` beside the tags and the genres
(`21_DATA_MODEL_LIBRARY_JSON.md` › `relationship_types`), and a relationship row
stores the type's **id**, so a rename touches no row.

The app once had a fixed table of eight types. It is gone, with the code that
held it. The six defaults replace it (REQ-14-RT), and a library whose rows used
one of the other old values gains a type of its own for it (REQ-14-RM VC5).

## Relationship types the user edits

PF-91, issue #81. The ask (Tim, in the session of 2026-11-03 to
2026-11-04, verbatim):

> *"I need song relationships in directions. "is remix of" is the opposite "is
> original of"". I need these differentiated."*

> *"I have a better idea. I want transitions to be like tags and genres to be
> editable. And the ones I want to have at the moment is "is remix of", "is
> original of", "same sample", "works as mashup", "transition". I think those
> are the important ones that should be there by default. I do not have more or
> better ideas at the moment. So add these and also that they also go into file
> persistance."*

> *"I have an idea: "same vibe" would be another relationship to add for songs.
> I just found an example: Chlär - Nigh Genesis and Lars Hiusmann - Echo."*

In the second quote, "transitions" names the relationship types. The list that
follows is a list of types, and "transition" is one item in it. Tim's decision
of 2026-11-04 in 19_TRANSITIONS.md uses this reading.

### The default types

| Type | Reads the same both ways | Opposite |
|---|---|---|
| is remix of | no | is original of |
| is original of | no | is remix of |
| same sample | yes | — |
| works as mashup | yes | — |
| transition | no | — |
| same vibe | yes | — |

The six names and the opposite pair are Tim's. The middle column comes from
the meaning of each name (Basis I). The user can change all of it, except the
transition type. That type stays one-way without an opposite, and it cannot be
deleted. The user can rename it and change its colour (INV-26).

"On a track" below means its song page and the list view of its Relationships
dialog.

### Must not change

- Tim's library holds 2 relationships, both `remix` (a read-only count on
  2026-11-03). Both keep their tracks, their direction and their notes.
- The set editor keeps its offer of saved transitions from the last track.
- The graph and the map keep one legend entry for each type on screen.
- An export written before this change stays importable.

### Relationship types are a list the user edits (REQ-14-RT, issue #81)

Status: Done
Priority: P1
Basis: V — Tim's quotes above, and Tags Management in 17_SETTINGS.md for the rules. The middle column of the default table is I. VC13 and VC14 are I. VC13 keeps the facts that the opposite type can still state. VC14 keeps transitions one-way for the Transitions page.
Serves: the user names the connections between tracks in their own words.

Verification criteria:

- VC1: In a library without a stored type list, Settings shows the six default
  types after the first start. It also shows each old type that REQ-14-RM VC5
  keeps.
- VC2: The user can add a type in Settings. The app requires a name.
- VC3: The app refuses a type name that another type has already. The
  comparison ignores case.
- VC4: The user can rename a type. Every relationship of that type shows the new
  name at once.
- VC5: The user can change the colour of a type, from the same palette as the
  tags.
- VC6: The user can mark a type as "reads the same both ways" or as one-way.
- VC7: Settings shows how many relationships use each type.
- VC8: The user can delete a type after a confirmation. The confirmation states
  how many relationships use the type.
- VC9: The deletion of a type without an opposite deletes every relationship
  of that type.
- VC10: Settings shows no delete action for the transition type.
- VC11: The backend refuses to delete the transition type, whichever client
  asks (INV-26).
- VC12: The type picker of the Relationships dialog lists every type, in the
  order that Settings shows.
- VC13: The deletion of a type with an opposite keeps its relationships. Each
  one changes to the opposite type, with its source and its target swapped.
  The confirmation says so.
- VC14: For the transition type, Settings offers only the name and the colour.
  It shows no both-ways mark and no opposite.

### A relationship reads in its direction (REQ-14-RD, issue #81)

Status: Done
Priority: P1
Basis: V — Tim: "is remix of" is the opposite "is original of". VC8 and VC9 are I, inferred from the opposite pair: without them, one fact can show twice. VC14 to VC19 are I. They give any type a line, as the old fixed styles did for eight types.
Serves: the user can tell a remix from its original on both tracks.

Verification criteria:

- VC1: A one-way type can name another one-way type as its opposite.
- VC2: If the user names B as the opposite of A, the app also names A as the
  opposite of B.
- VC3: On the source track, a relationship shows the name of its type.
- VC4: On the target track, a relationship of a type with an opposite shows the
  name of the opposite. Example: "A is remix of B" shows "is original of A" on
  track B.
- VC5: A relationship of a both-ways type shows the name of its type on both
  tracks.
- VC6: A relationship of a one-way type without an opposite shows the name of
  its type on both tracks. On the source track, the row shows → before the
  partner. On the target track, it shows ← before the partner.
- VC7: The user adds "is original of A" on track B. On both tracks, the result
  shows as if the user added "is remix of B" on track A.
- VC8: The app refuses a relationship with the same two tracks, the same type
  and the same direction as an existing one. A notice says that the
  relationship exists. A typed side of a transition counts as its track. Two
  typed sides are the same track when their artists and titles match, case
  ignored (REQ-19-TM VC14).
- VC9: The app also refuses a relationship that states an existing one from the
  other side. That is the opposite type in the other direction, or a both-ways
  type in either direction.
- VC10: A type and its opposite share one colour. If the user changes the colour
  of one, the colour of the other changes too.
- VC11: The graph of the Relationships dialog and the track map draw each
  relationship in the colour of its type.
- VC12: The legends of the graph and of the map list each type on screen once.
  A type and its opposite share one entry, which names both.
- VC13: If the user marks a type with an opposite as "reads the same both
  ways", the app clears the opposite link of both types.
- VC14: If B had another opposite C before, C has no opposite after the user
  names B as the opposite of A.
- VC15: A new pair takes the colour of the type that the user edits.
- VC16: A one-way type draws a solid line on the graph and on the map.
- VC17: A both-ways type draws a dotted line on the graph and on the map.
- VC18: The transition line stays heavier than the other lines.
- VC19: The Transitions layer of the map draws in the colour of the transition
  type.

### The app saves the type list in the library file and in the backup (REQ-14-RP, issue #81)

Status: Done
Priority: P1
Basis: V — Tim: "they also go into file persistance". The rules copy the genre list (21_DATA_MODEL_LIBRARY_JSON.md, issue #51).
Serves: the types of the user survive a restart, cleared browser data and a move to another machine.

The import takes relationships only into a library that has none (the existing
rule in `backend/services/import_merge.py:241-262`). The type list merges every
time, like the genres.

Verification criteria:

- VC1: The app saves the type list in `library.json`, beside the tags and the
  genres.
- VC2: After a restart, Settings shows the same types with the same names,
  colours, both-ways marks and opposites.
- VC3: After the user clears the site data of the browser, Settings shows the
  same types.
- VC4: The library export contains the type list.
- VC5: An import adds each type that the library does not have. The match is by
  name and ignores case.
- VC6: An import keeps the local settings of a type that both libraries have:
  its colour, its both-ways mark and its opposite.
- VC7: If the import takes relationships, each one keeps the name of its type,
  also when the two libraries gave the type different ids.

### Existing relationships keep their meaning (REQ-14-RM, issue #81)

Status: Done
Priority: P1
Basis: V — the read-only count above (2 relationships, both `remix`). VC5, VC10 and VC11 are I, taken from the old labels and line colours.
Serves: the update loses no relationship and changes the meaning of none.

The old `mashup` meant "A is a mashup that contains B". The new "works as
mashup" pairs two tracks that play well together as a mashup. The meanings
differ, so the update does not merge the two.

Verification criteria:

- VC1: After the first start with this change, each stored relationship has a
  type from the list. The app drops no relationship.
- VC2: A relationship of the old type `remix` shows as "is remix of", with the
  same source and target.
- VC3: A relationship of the old type `same_sample` shows as "same sample".
- VC4: A relationship of the old type `transition` shows as "transition", with
  the same source and target.
- VC5: A relationship of another old type (`cover`, `edit`, `bootleg`, `mashup`,
  `in_playlist`) keeps a type of its own, with the old value as its id. The
  name of that type is the old label: "Cover", "Edit", "Bootleg", "Mashup" or
  "In playlist".
- VC6: The app adds such an old type to the list only if at least one
  relationship uses it.
- VC7: The update keeps the notes and the creation date of each relationship.
- VC8: A second start changes nothing in `library.json`.
- VC9: An export written before this change imports with the results of VC2 to
  VC7, VC10 and VC11.
- VC10: A relationship with any other stored value keeps a type of its own. The
  value is its id and its name.
- VC11: A type from VC5 keeps its old line colour. A type from VC10 gets the
  fallback colour of the palette.

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
  partners (every type in the list). The dialog opens with its song selected; the
  song sits at the origin with its partners around it, one line style per
  relationship type. Clicking a track, or choosing an entry in the details'
  partner list, selects it and shows its details beside the canvas; re-centring
  moves to the **Show its relationships** action, with the same back-button
  history. A legend under the canvas lists the relationship types on screen,
  each with its line style. **Open in map** (phase 7) continues into the full
  map with this song and its partners as a removable filter: it navigates to
  `/map?core=<the dialog's song id>`, and the map recomputes the core from the
  loaded relationships (TM-E3, TM-H1)
- The selected track's details are compact: title, artist, its relationship
  partners as a list (each entry selects that track) and the actions **Play**
  (a run of one), **Song page** and **Show its relationships**. It shows no
  nearest tracks — those belong to the map rail
- A node is a track: a disc in its main genre's user colour, neutral when it
  has none. Orange means "this one": the playing track carries the orange cut,
  the selected track the focus ring. Hovering a track highlights it and its
  edges and dims the rest
- Each relationship type has its own line, so the graph also reads in
  grayscale: a one-way type solid in its own colour, a both-ways type dotted,
  and `transition` the heaviest (source of truth: `src/lib/relationshipStyle.ts`,
  which derives the line from the type)
- A type draws in its own colour. Its line is solid if the type is one-way and
  dotted if it reads the same both ways (REQ-14-RD)
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
- A transition that the user marks as an idea is not tried yet (REQ-19-TI,
  issue #82)
- Either side of a transition can be a track the library does not have yet: a
  typed `{artist, title}` in place of the song id. Only a transition takes one,
  and the Transitions page links it to a track once the user owns it
  (REQ-19-TM, issue #82)
- The duplicate rule below covers a typed side too: two typed sides are the same
  track when their artists and titles match, case ignored
- Transition relationships can have notes: "mix A's outro into B's intro at
  128 BPM, bring in B's percussion under A's last breakdown"

### Transition as a First-Class Entity

**Decided 2026-11-04 (Tim, issue #82):** transitions stay relationships
of the transition type. The app gets no separate `Transition` entity and no
second store. The Transitions page lists them ([19_TRANSITIONS.md](19_TRANSITIONS.md)).
The fields below stay future work (PF-40+), as fields of the relationship.

Until 2026-11-04 the plan was a dedicated `Transition` entity with these
richer fields:

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

These fields are future work, as fields of the relationship. See
[31_TRANSITION_MINING.md](31_TRANSITION_MINING.md) for the plan.