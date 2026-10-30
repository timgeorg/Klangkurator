# Behavior contract — add a song to a set (issue #64)

Written **before** implementation (Feature-Development-Playbook: a user-facing
behavior change needs a behavior contract, judged source-blind by the Validator).
Spec: `docs/requirements/16_SET_PLANNING.md` REQ-16-AS. Run against the sandbox copy
of the library, backend `:8001`, Vite `:8091`.

## Clauses (given / when / then)

### BC-1 — the action is in the row
**Given** the library **then** each track row shows an "Add <title> to a set"
action beside Play and Edit, and it is named for a screen reader.

### BC-2 — it reveals like its neighbours
**Given** the pointer is on a row **then** the action shows. **Given** keyboard focus
is inside a row **then** the action shows.

### BC-3 — the song page has it too
**Given** a song page **then** an **Add to set** button shows in the action row, after
Play, Edit, Re-analyze and Relationships.

### BC-4 — the list is the Sets page's order
**When** I open the menu **then** every set is listed in the order the Sets page
shows, read when the menu opened.

### BC-5 — each row says what it is
Each set shows its colour, its name and its number of tracks.

### BC-6 — typing narrows the list
**When** I type in the menu **then** only sets whose name contains the text remain.

### BC-7 — a pick appends
**When** I select a set **then** the song becomes the last item of that set's running
order, and it is the last track the editor shows for that set.

### BC-8 — it saves at once
**Given** I never open the Sets page **when** I reload **then** the song is still in
the set. The notice names the set.

### BC-9 — a set that has it cannot be picked
**Given** a set already holds the song, in `items` or inside a phase **then** its row
shows a tick and does not respond to a pick.

### BC-10 — nothing else changes
**Given** a set with a name, a description, notes, `phases` and a target duration
**when** I add a song **then** all of those read exactly as before, and only `items`
changed.

### BC-11 — a set whose stored positions have gaps
**Given** a set whose stored positions are `[0, 1, 5]` **when** I add a song **then**
the saved positions are `0..n-1` and the new song is last.

### BC-12 — no sets at all
**Given** no sets exist **when** I open the menu **then** it shows "No sets yet" and a
link to the Sets page.

### BC-13 — a failed save
**Given** the save fails **then** an error notice shows, and the set in storage still
lacks the song. The menu closes; nothing on screen claims success.

### BC-14 — keyboard only
**When** I reach the trigger with Tab, press Enter, arrow to a set and press Enter
**then** the song is added. Escape closes the menu and focus returns to the trigger.

### BC-15 — touch targets
**Given** a coarse pointer **then** the row action and each set row are at least 44 px
tall.

## Known limits (recorded, not defects to fix here)

- The success notice is the app's single toast slot, so a notice already showing is
  replaced.
- A set editor open on the same set with unsaved changes keeps its own copy of the
  running order and overwrites this addition on its next save.
- A set that holds its tracks only in `phases` gets the song at the end of the flat
  running order, which the current editor is the only UI for; the phases themselves
  are untouched.
