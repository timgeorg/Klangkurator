# Transitions

Status: Active
Last Updated: 2026-11-04
Built: 2026-11-04 (issue #82). Source: Tim, 2026-11-03 and 2026-11-04 (verbatim below). The page builds on
14_RELATIONSHIPS.md and on REQ-33-LY. It specifies PF-43 from
31_TRANSITION_MINING.md.

## The ask (Tim, 2026-11-03, verbatim)

> *"Also I need a view where I can view and store and add transitions and
> transition ideas, regardless of id they are in a set or not. The hierarchy is
> "transition" (atomic) -> block -> set. For example wha I want to add is that
> tatemcrae housewife fits hannah montana best of both worlds really well. This
> is a transition. Maybe the songs are missing maybe not."*

## The decision: one store (Tim, 2026-11-04)

Tim picked one of three options: *"One store (Recommended)"*. The option read:
*"A transition is a relationship of type "transition". A Transitions page lists
all of them and lets you add new ones. Either side can be a track that isn't in
your library yet, and you can mark a transition as an idea. Each transition
shows the blocks and sets where its two tracks follow each other."*

He did not pick the other two options. One kept separate transition records
beside the relationship type. The other had no page at all.

What follows from the decision:

- A saved transition is a relationship of the transition type (REQ-14-RT). The
  app has no second store for transitions.
- A transition is the smallest unit of a set. A block chains transitions. A set
  chains tracks and blocks.
- Two consecutive tracks in a block are a transition. Two consecutive tracks in
  the running order of a set are a transition too. The track map uses the same
  definition for its Transitions layer (REQ-33-LY).

## Must not change

- The Transitions layer of the track map keeps its facts: transition
  relationships, and consecutive tracks in blocks and sets.
- The set editor keeps its offer of saved transitions from the last track
  (16_SET_PLANNING.md).
- Blocks and sets keep their own transition notes. The Transitions page shows
  these notes and does not move them.
- A relationship of another type never shows on the Transitions page.

### The Transitions page lists every transition (REQ-19-TL, issue #82)

Status: Done
Priority: P1
Basis: V — Tim, 2026-11-03 (verbatim above), and his decision of 2026-11-04. VC16 to VC18 are I. VC18 follows REQ-33-LY.
Serves: the user sees all transitions in one place, in a set or not.

Verification criteria:

- VC1: The sidebar shows a "Transitions" entry.
- VC2: The "Transitions" entry opens the Transitions page.
- VC3: The page shows one row for each saved transition.
- VC4: The page shows one row for each pair of consecutive tracks in a block.
- VC5: The page shows one row for each pair of consecutive tracks in the
  running order of a set. A block in the set counts with its tracks in their
  place.
- VC6: The page shows each direction once. Example: A followed by B in a saved
  transition, in a block and in a set gives one row.
- VC7: A followed by B and B followed by A give two rows.
- VC8: Each row shows the first track, an arrow and the second track.
- VC9: Each row names its sources: "Saved" for a saved transition, and the name
  of each block and of each set.
- VC10: Each row shows the note of each source that has a note.
- VC11: A missing track or a deleted block ends the chain. The tracks before
  and after it do not make a row.
- VC12: The search field keeps the rows whose first or second track contains
  the typed text in its title or in its artist. The match ignores case.
- VC13: With no transitions, the page shows the text "No transitions yet."
  and the "Add transition" action.
- VC14: At a width of 375 px, the page does not scroll sideways.
- VC15: On a touch screen, each action on the page is at least 44 px tall.
- VC16: A saved transition from a track to the same track makes no row.
- VC17: The rows sort by the title of the first track, then by the title of
  the second track. The sort ignores case.
- VC18: The phases and the alternatives of a set make no rows.

### The user adds, edits and deletes saved transitions (REQ-19-TA, issue #82)

Status: Done
Priority: P1
Basis: V — Tim, 2026-11-03: "view and store and add transitions".
Serves: the user saves a transition at the moment they find it, without a block or a set.

Verification criteria:

- VC1: The page has an "Add transition" action.
- VC2: "Add transition" asks for the first track, the second track and an
  optional note.
- VC3: The user picks a library track for a side by its title or its artist.
- VC4: Saving stores a relationship of the transition type from the first track
  to the second track.
- VC5: The new row shows on the page at once, without a reload.
- VC6: The new transition shows in the Relationships dialog and on the song
  page of each library track in it.
- VC7: The app refuses a transition whose first and second track are the same
  library track.
- VC8: The app refuses a saved transition that exists already in the same
  direction (REQ-14-RD, VC8).
- VC9: The user can change the note of a saved transition.
- VC10: The user can delete a saved transition after a confirmation.
- VC11: A row that comes only from blocks or sets has no edit action and no
  delete action. The block editor or the set editor changes it.
- VC12: The user can add, edit and delete a saved transition with the keyboard
  alone.

### A side of a transition can be a track that is not in the library (REQ-19-TM, issue #82)

Status: Done
Priority: P1
Basis: V — Tim, 2026-11-03: "Maybe the songs are missing maybe not." VC13 is I: a link that the app guesses can join the wrong track. VC14 to VC16 are I. They apply the duplicate rule of REQ-14-RD to typed sides.
Serves: the user saves a transition before they own both tracks.

Verification criteria:

- VC1: In "Add transition", the user can type an artist and a title for a side
  instead of a library track.
- VC2: A typed side needs a title. The artist is optional.
- VC3: Both sides of one transition can be typed.
- VC4: A typed side shows its artist and its title with the mark "Not in
  library".
- VC5: The user can link a typed side to a library track. The track picker
  opens with the typed title as its search text.
- VC6: After the link, the row shows the library track, and the typed text is
  gone.
- VC7: A transition can join a library track and a typed side. The song page
  and the Relationships dialog of the library track list that transition. They
  show the typed side with the mark "Not in library".
- VC8: The track map and the graph of the Relationships dialog draw no line for
  a transition with a typed side.
- VC9: The set editor does not offer a typed side as a suggestion.
- VC10: The tool `list_relationships` of the MCP server returns a typed side
  with its artist and its title.
- VC11: The library export contains each typed side.
- VC12: If the import takes relationships, it keeps each typed side.
- VC13: The app never links a typed side to a library track without an action
  of the user.
- VC14: Two typed sides are the same track if their artists and titles match.
  The match ignores case.
- VC15: The app refuses a link that makes a transition from a track to the same
  track.
- VC16: The app refuses a link that makes a transition that exists already
  (REQ-14-RD, VC8).

### A transition can be an idea (REQ-19-TI, issue #82)

Status: Done
Priority: P1
Basis: V — Tim, 2026-11-03: "transitions and transition ideas". VC2 is I: a new entry is a transition unless the user says that it is an idea. VC7 and VC8 are I: an idea stays a transition everywhere, with its mark.
Serves: the user keeps untried ideas apart from transitions that they know work.

Verification criteria:

- VC1: "Add transition" and the edit of a saved transition have an "Idea"
  switch.
- VC2: The switch is off for a new transition.
- VC3: A saved transition with the switch on shows the mark "Idea" on its row.
- VC4: A filter on the page shows all rows, only ideas, or only the rows that
  are not ideas.
- VC5: Only a saved transition can be an idea. A row from blocks or sets shows
  the mark only if the saved transition of the same row is an idea.
- VC6: The set editor shows the mark "Idea" on a suggestion that is an idea.
- VC7: The track map draws an idea like any other transition.
- VC8: The MCP tool `get_transitions` returns an idea with its mark.

## Not in scope (issue #82)

- Putting a transition into a block or a set from this page. The block editor
  and the set editor do that.
- Mix points, technique, rating and play count (31_TRANSITION_MINING.md). They
  stay future work, as fields of the relationship.
- A link that the app makes by itself from a typed side to a library track
  (REQ-19-TM, VC13).
- A typed side from an agent. The MCP tool `link_tracks` takes library tracks
  only.
