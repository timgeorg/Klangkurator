# Behavior contract — crate tabs: collapse and multi-select (issue #49)

Written **before** implementation (Feature-Development-Playbook: user-facing
behavior change → behavior contract, judged source-blind by the Validator).
Spec: `docs/requirements/13_LIBRARY_VIEW.md` REQ-13-CT. Run against the sandbox
copy (27 crates) and synthetic libraries with 10 and 11 crates.

## Clauses (given / when / then)

### BC-1 — ten or fewer crates
**Given** a library with 10 crates **then** all 10 tabs show and there is no
toggle.

### BC-2 — collapsed by default
**Given** N crates with N > 10 and no stored choice **then** the bar shows "All
tracks", 10 crate tabs and "+(N − 10) more".

### BC-3 — expand and remember
**When** I press "+… more" **then** all N crate tabs show, followed by "Show
fewer", and focus stays on the toggle. **When** I reload (in a browser) **then**
the bar is still expanded.

### BC-4 — the selection is never hidden
**Given** the bar is collapsed **when** I select a crate beyond the first 10
(through the Crate column filter) **then** its tab shows active after the 10,
and the toggle count drops by one.

### BC-5 — nothing left to hide
**Given** 11 crates, collapsed **when** I select the 11th **then** there is no
toggle.

### BC-6 — click selects one
**When** I click crate A **then** only A is active and the table shows only A's
tracks.

### BC-7 — Shift+click adds
**Given** A is selected **when** I Shift+click B **then** A and B are active, the
table shows the tracks of A or B, and the count equals A's plus B's.

### BC-8 — Shift+click adds and removes
A, Shift+B, Shift+C gives A+B+C; Shift+B again gives A+C; Shift+A and then
Shift+C gives All tracks.

### BC-9 — a plain click inside a selection
**Given** A+C are selected **when** I click A **then** only A is selected.
**When** I click D (not selected) **then** only D is selected.

### BC-10 — All tracks clears
**Given** A+C are selected **when** I click All tracks, with or without Shift
**then** All tracks is active and every track shows.

### BC-11 — the map keeps the selection
**Given** A+B are selected **when** I switch to Map **then** only A and B tracks
are on it; **when** I switch back to Table **then** A+B are still selected.

### BC-12 — column filter and tabs agree
**When** I pick two crates in the Crate column filter **then** both tabs are
active and the chip reads "A, B".

### BC-13 — no text selection
**When** I Shift+click across several tabs **then** no text is highlighted.

### BC-14 — keyboard
**When** I Tab to a crate and press Shift+Enter **then** it joins the selection;
**when** I press Shift+Space on a selected crate **then** it leaves it.

### BC-15 — focus never gets lost
**Given** the bar is collapsed and a selected crate beyond the first 10 has
focus **when** I deselect it with Shift+Enter **then** focus moves to the toggle.

### BC-16 — touch size
**Given** a touch device (coarse pointer) at 375 px **then** the tabs and the
toggle are at least 44 px tall.

## Out of scope

Range selection · Ctrl/Cmd+click · crate identity (#11) · keeping the collapse
choice across desktop-window launches (the desktop window does not keep
`localStorage` today).
