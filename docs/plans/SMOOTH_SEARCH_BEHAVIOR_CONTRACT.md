# Behavior contract — instant library search (issue #68)

Written **before** implementation (Feature-Development-Playbook: a user-facing
behavior change needs a behavior contract, judged source-blind by the Validator).
Spec: `docs/requirements/13_LIBRARY_VIEW.md` REQ-13-ST. Depends on #63
(`LAZY_ROWS_BEHAVIOR_CONTRACT.md`). Run against the sandbox copy of the real
library (1,907 tracks), backend `:8001`, Vite `:8091`, with **all tracks selected**.

## Clauses (given / when / then)

### BC-1 — the character appears at once
**Given** all 1,907 tracks selected **when** I type one character **then** the
field shows it within 50 ms, and no keystroke of a typed word is ever lost.

### BC-2 — the table catches up
**When** I stop typing **then** the table shows the matches within 300 ms on the
reference machine, with the previous rows still on screen while it works.

### BC-3 — the order is preserved
**When** I type "techno" fast **then** the field reads exactly "techno", in that
order, with no character dropped or repeated.

### BC-4 — the same matches as before
**Given** any query **then** the table shows the same tracks as the pre-change
build, because `filterSongs` still matches title, artist, genres and key.

### BC-5 — the count matches the table
**Given** a query that matches 235 tracks and 50 rows rendered **then** the header
count reads "235 of 1,907 tracks", never the count of the previous query.

### BC-6 — clearing returns the full list
**When** I clear the search **then** the table shows the first 50 rows of the full
list, at the top.

### BC-7 — the map agrees at rest
**Given** a search in the library **when** I open the map and it settles **then**
the map shows the same matches as the table.

### BC-8 — no fixed delay
**Given** a fast machine **then** the results follow without waiting for a timer;
a slower device shows them later rather than the field stalling.
