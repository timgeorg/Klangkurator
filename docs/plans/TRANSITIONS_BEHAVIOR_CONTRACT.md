# Transitions — Behaviour Contract (issue #82)

A judge reads this against a copy of the library, through the running app. The
judge never opens Tim's real data folder.

The sandbox copy holds 1,907 tracks and 2 relationships (both `remix`). It also
holds one block and one set. The numbers below are that copy's.

The test pair throughout is Tim's own: **tatemcrae / housewife** into
**hannah montana / best of both worlds**.

---

## TL — the list

### TL-1 — the sidebar entry
**Given** the app is open
**when** the user looks at the sidebar
**then** there is a "Transitions" entry after "Sets".

### TL-2 — the entry opens the page
**Given** that entry
**when** the user activates it
**then** the Transitions page shows. The entry carries `aria-current="page"`.

### TL-3 — a saved transition is a row
**Given** a saved `transition` relationship between two library tracks
**when** the page opens
**then** one row shows both titles with an arrow between them.

### TL-4 — a block's consecutive tracks are a row
**Given** a block holding A then B
**when** the page opens
**then** a row shows A → B. Its sources name the block.

### TL-5 — a set's consecutive tracks are a row
**Given** a set whose running order holds A then B
**when** the page opens
**then** a row shows A → B. Its sources name the set.

### TL-6 — one row per direction
**Given** A → B in a saved transition, a block and a set
**when** the page opens
**then** there is one row. Its sources name all three.

### TL-7 — both directions are two rows
**Given** A → B and B → A
**then** the page shows two rows.

### TL-8 — the sources and the notes
**Given** a saved transition with a note, and a block pair with one
**then** each row names "Saved" or the block's name. It shows the note it has.

### TL-9 — the search
**Given** the page is open
**when** the user types "HOUSEWIFE" in the search
**then** one row stays. It is the row whose first or second side holds that title or artist.
The match takes no account of case.
**And** a query that matches no side leaves no row.

The search matches a title in either case. It matches an artist the same way.

### TL-10 — the empty page
**Given** a library with no transitions of any kind
**then** the page shows "No transitions yet." and the "Add transition" action.

### TL-11 — 375 px and touch
**Given** the page at 375 px
**then** it does not scroll sideways.
**And** on a touch screen every action on it is at least 44 px tall.

### TL-12 — the sort
**Given** several rows
**then** they sort by the first title, then by the second, with case ignored.

### TL-13 — a row with no saved transition has no actions
**Given** a row that only a block makes
**then** it offers no Edit and no Delete.

## TA — add, edit, delete

### TA-1 — adding
**Given** the page is open
**when** the user activates "Add transition"
**then** a dialog asks for the first track, the second track and a note.
The note is optional.

### TA-2 — a library track per side
**Given** the dialog
**when** the user searches a title or an artist for a side
**then** the picker offers the matching library tracks.

### TA-3 — the row appears at once
**Given** a saved transition
**then** its row is on the page without a reload. Its sources say "Saved".

### TA-4 — it shows on both song pages
**Given** a saved transition between two library tracks
**when** the user opens either track's song page or Relationships dialog
**then** the transition is there.

### TA-5 — the refusals
**Given** the dialog
**when** the two sides are the same library track
**then** the app refuses the save with a notice.
**when** the user saves the same pair in the same direction again
**then** the app refuses it and says the transition exists.

### TA-6 — the note can change
**Given** a saved transition
**when** the user edits its note and saves
**then** the note on the row is the new one.

### TA-7 — delete asks first
**Given** a saved transition
**when** the user activates Delete
**then** a confirmation asks first. "Keep it" leaves the row. The confirmation
takes the row away.

### TA-8 — the keyboard
**Given** the page
**then** the user can reach and operate every action with the keyboard alone.

## TM — a side not in the library

### TM-1 — typing a side
**Given** the Add dialog
**when** the user picks "Not in library" for a side
**and** types an artist and a title
**then** the transition saves. Its side is the typed track.

A side of one transition can be typed while the other side is a track.

### TM-2 — a typed side needs a title, not an artist
**Given** a typed side with no title
**then** the app disables the save button.
**Given** a typed side with no artist
**then** the transition saves.

### TM-3 — the mark
**Given** a row with a typed side
**then** it shows the typed artist and title with "Not in library".

### TM-4 — link a side
**Given** a row with a typed side
**when** the user activates "Link track"
**then** the track picker opens. Its search text is the typed title.
The typed artist is not part of that text.
**when** the user picks a track
**then** the row shows that track in place of the typed side.

### TM-5 — the typed side reaches the song page
**Given** a transition between a track and a typed side
**when** the user opens that track's song page
**then** the page shows the transition there.
The typed side carries the mark "Not in library".
**when** the user opens the Relationships dialog
**then** the dialog shows it too, with the same mark.

### TM-6 — no line where there is no track
**Given** a transition with a typed side
**then** the Relationships graph and the track map draw no line for it.

### TM-7 — the set editor does not offer it
**Given** the last track of a set has a saved transition to a typed side
**then** the set editor offers no suggestion for it.

### TM-8 — the round trip
**Given** a library with a typed transition side
**when** the user exports it
**and** imports it into an empty library
**then** the typed side survives.
It keeps its artist, its title and its mark.

## TI — ideas

### TI-1 — the switch
**Given** the Add dialog or the Edit dialog
**then** it has an "Idea" switch, off for a new transition.

### TI-2 — the mark on the row
**Given** a saved transition with the switch on
**then** its row shows the mark "Idea".

### TI-3 — the filter
**Given** rows that are ideas and rows that are not
**when** the user picks "Ideas"
**then** only the ideas show.
**when** the user picks "Not ideas"
**then** only the rows that are not ideas show.

### TI-4 — an idea is still a transition
**Given** a transition marked as an idea that joins two library tracks
**then** the track map draws it like any other transition.
**And** `get_transitions` returns it with `idea: true`.

### TI-5 — the set editor's mark
**Given** the last track of a set has a saved transition that is an idea
**then** the set editor's suggestion carries the mark "Idea".
