# Behavior contract — lazy library rows (issue #63)

Written **before** implementation (Feature-Development-Playbook: a user-facing
behavior change needs a behavior contract, judged source-blind by the Validator).
Spec: `docs/requirements/13_LIBRARY_VIEW.md` REQ-13-LR. Run against the sandbox copy
of the real library (1,907 tracks) with the backend on `:8001` and Vite on `:8091`.

## Clauses (given / when / then)

### BC-1 — the library opens fast
**Given** a cold page load of `/` and a 1,907-track library **when** the page settles
**then** the first row is visible in under 1,000 ms and the crate tabs are on screen.

### BC-2 — the first build is small
**Given** the library has opened and I have not scrolled **then** the table body holds
exactly `min(50, matching)` rows.

### BC-3 — scrolling adds a page
**Given** 1,907 matching tracks and 50 rendered rows **when** I scroll to the last
rendered row **then** the table holds 100 rows and the `#` column runs 01…100 with no
gap or repeat at the seam.

### BC-4 — scrolling to the end shows everything
**When** I keep scrolling to the bottom **then** all 1,907 rows are rendered and the
last one reads 1907.

### BC-5 — a new crate starts again
**When** I select a different crate **then** the table shows the first 50 rows of that
crate and the table is scrolled to the top.

### BC-6 — a new list starts again
**When** I type in the search, change a filter or change the sort **then** the table
shows the first 50 rows of the new list, scrolled to the top.

### BC-7 — editing keeps my place
**Given** the table is scrolled to row 300 **when** I edit a cell in place **then** the
row count and the scroll position stay as they were.

### BC-8 — the count describes everything
**Given** a search that matches 1,696 tracks and 50 rows rendered **then** the header
count reads 1,696, not 50.

### BC-9 — the player walks the whole run
**Given** the first row is playing and only 50 rows are rendered **when** I press next
60 times **then** playback reaches track 60 and the table keeps revealing rows.

### BC-10 — a screen reader hears the real position
**Given** 1,907 tracks and 50 rows rendered **then** the table announces a row count of
1,907 and each rendered row announces its absolute position.

### BC-11 — an empty result
**Given** a search matching nothing **then** the table shows the empty-result message
and no sentinel loop runs.

### BC-12 — a short list needs no sentinel
**Given** a list of 12 matching tracks **then** all 12 render and no reveal happens.
