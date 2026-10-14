---
tags:
  - plan
  - player
  - contract
status: active
created: 2026-10-14
source: session
---
# Behavior contract — the player steps through a run (issue #5)

Written **before** implementation (Feature-Development-Playbook, task-type
cross-reference: user-facing behavior change → behavior contract, judged
source-blind by the Validator against a sandbox copy of the library).

**Run:** the ordered tracks next/previous step through. That is the library
table's rows as shown, a set's running order (blocks expanded in place), or a
block's tracks. It is fixed at the moment Play is pressed.

## How to observe

- **Which track plays:** the player's cover link is named "Open <title>" in
  both the panel and the bar. Below 640 px the bar shows no title text, so use
  that name (or the `<audio>` element's `src`, `/api/audio/<song id>`, and its
  `paused` state).
- **Unavailable** means the control is shown with `aria-disabled="true"` and
  dimmed. Pressing it changes nothing, and it keeps keyboard focus.
- **Reaching the end of a track:** focus the Seek slider and press End, or
  drag it to the end. Tracks run for minutes, so nobody waits them out.
- **Hover-revealed buttons** exist in the DOM at opacity 0. Judge "appears" by
  what is visible.
- **Fixtures:** created through the backend API in the sandbox. The seed
  script and fixture table are in the plan
  ([[PLAYER_RUN_PLAN.md#Tests and gates]]).

## Library

### NP-1 — next and previous follow the rows
**Given** the library table shows at least three rows
**when** the user plays row 2 and presses Next in the player
**then** row 3's track plays; Previous then plays row 2's track, and Previous
again plays row 1's.

### NP-2 — the order is the order on screen
**Given** a search or filter narrows the table to rows A, B, C, sorted by a
column the user chose
**when** the user plays A and presses Next
**then** B plays, never a track the search or filter hides.

### NP-3 — no wraparound
**Given** the table's last row is playing
**then** Next is unavailable, and pressing it changes nothing.
**Given** the first row is playing
**then** Previous is unavailable, and pressing it changes nothing.

### NP-4 — the run is frozen at Play
**Given** row 2 is playing
**when** the user sorts the table by another column, or searches or filters
it, and then presses Next
**then** the track that was row 3 when Play was pressed plays. Pressing Play
on any row afterwards starts a run in the new order.

### NP-5 — the current row still toggles
**Given** a track is playing
**when** the user presses the Play/Pause control on that same track's library row
**then** playback pauses (pressing it again resumes), and Next still goes where
it went before.

## Sets and blocks

### NP-6 — set card Play
**Given** a set whose running order is [song S1, block B (tracks T1, T2), song S2]
**when** the user presses Play on the set's card
**then** S1 plays and Previous is unavailable; Next steps through T1, T2, S2
in that order; on S2 Next is unavailable.

### NP-6b — card Play starts over
**Given** the set from NP-6 is playing its third track (T2)
**when** the user presses Play on that set's card again
**then** S1 plays, and Next plays T1.

### NP-7 — block card Play
**Given** a block with tracks [T1, T2, T3]
**when** the user presses Play on its card
**then** T1 plays and Previous is unavailable; Next steps through T2, T3; on
T3 Next is unavailable.

### NP-8 — set editor row Play
**Given** the editor open on the set from NP-6
**when** the user hovers block B's row, or moves keyboard focus into it
**then** the row number is replaced by a visible Play button named "Play <B's
name>"; pressing it plays T1. After the editor is closed, Next plays T2 and
Previous twice plays S1.

### NP-9 — block editor row Play
**Given** the editor open on the block from NP-7
**when** the user presses Play on row 2
**then** T2 plays. After the editor is closed, Previous plays T1, and Next
twice plays T3.

### NP-10 — the set editor plays the order on screen
**Given** the set editor, where the user has moved S2 to the top without saving
**when** they press Play on S2's row
**then** S2 plays, and after the editor is closed, Next plays S1.

### NP-10b — the block editor plays the order on screen
**Given** the block editor on [T1, T2, T3], where the user has moved T3 to the
top without saving
**when** they press Play on T3's row
**then** T3 plays, and after the editor is closed, Next plays T1.

### NP-11 — empty and missing
**Given** a set whose running order is empty
**then** its card's Play is unavailable (shown disabled).
**Given** a set whose running order is [S1, a deleted track, S2]
**then** the deleted track's row in the editor has no Play, and from S1 Next
plays S2.

### NP-11b — Play after a missing row starts at the right track
**Given** the set editor on [S1, a deleted track, S2]
**when** the user presses Play on S2's row
**then** S2 plays, and after the editor is closed, Previous plays S1.
**Given** the block editor on [T1, a track no longer in the library, T3]
**when** the user presses Play on T3's row
**then** T3 plays, and after the editor is closed, Previous plays T1.

### NP-11c — a block with nothing to play
**Given** a set whose running order is [a block whose tracks are all gone from
the library, S1]
**then** the block's row in the editor has no Play, and Play on S1's row plays
S1 with no Next or Previous (a run of one).

### NP-12 — the same track twice in a row restarts
**Given** a set whose running order is [song S, block (S, T)]
**when** the user plays the set from its card, lets S play past 0:10 and
presses Next
**then** S starts again from 0:00, and Next after that plays T.

## Player

### NP-13 — playback moves on by itself
**Given** a run with a track after the current one
**when** the current track reaches its end
**then** the next track starts playing with no click.
**Given** the last track of the run is playing
**when** it reaches its end
**then** playback stops and the player closes, as when a single track ends.

### NP-14 — next from pause plays
**Given** a run paused on its second track
**when** the user presses Next
**then** the third track starts playing.
**Given** a run paused on its second track
**when** the user presses Previous
**then** the first track starts playing.

### NP-15 — a single track has no next/previous
**Given** nothing is playing
**when** the user plays a track from its song detail page (`/song/:id`)
**then** the player shows no Next or Previous control.

### NP-16 — library play leaves a set run
**Given** a set run is playing
**when** the user plays a different track from the library table
**then** Next and Previous step through the library rows from that row.

### NP-17 — keyboard and names
**Given** a run is playing
**then** Previous and Next are reachable with Tab and are named "Previous
track" and "Next track".
**When** a keyboard user presses Next until the last track
**then** focus stays on the Next button, which is unavailable, with its focus
ring still visible.
Row Play buttons in the editors appear on keyboard focus as well as on hover.

### NP-18 — layout in both themes
**Given** a run is playing
**then** at 1440×900, 1280×800, 768×1024 and 375×812, in both the ink and
paper themes, the player (the panel at ≥ 1280 px when docked as a panel, the
bar otherwise) shows Previous, Play and Next with no overflow, no clipped
control and no horizontal page scroll. The bar's waveform scrubber stays at
least 80 px wide, also at 1024 px with the sidebar expanded. The panel may
scroll vertically inside itself; nothing in it is cut off sideways.

### NP-19 — editing a set while it plays changes nothing until the next Play
**Given** the set from NP-6 is playing S1
**when** the user opens its editor, moves block B below S2, saves, and closes
the editor
**then** Next still plays T1 (the order at Play). Pressing Play on the set's
card afterwards plays S1, then S2, then T1.

### NP-20 — a track that fails to load is skipped
**Given** a set whose running order is [S1, a track whose audio file is
missing on disk, S2]
**when** S1 ends (or the user presses Next on S1)
**then** a message says the track could not be played and names it, and S2
starts playing.
**Given** the failing track is the last of the run
**then** the message appears and playback stops.

### NP-21 — the new track is announced
**Given** a run is playing
**when** Next is pressed or the track moves on by itself
**then** the new title is announced to assistive technology through a polite
live region inside the player.
