# Behavior contract — People rating (issue #48)

Written **before** implementation (Feature-Development-Playbook: user-facing
behavior change → behavior contract, judged source-blind by the Validator).
Spec: `docs/requirements/11_SONG_MODEL.md`. Run against the sandbox library.

## Field in scope

`people`: 0–5, one decimal (step 0.1), 0 = unrated, label "People". It replaces
Dance (`danceability`) and Social (`social_acceptance`). Energy and Rank are
unchanged.

## Clauses (given / when / then)

### BC-1 — one People column
**When** I open the library **then** there is one People column (five rising
bars, inline edit, a 0–5 range filter, sortable) and no Dance or Social column,
neither in the table nor in column settings.

### BC-2 — edit dialog
**When** I set People to 3.7 in a track's edit dialog and save **then** the table
shows 3 bars with 3.7 in the tooltip, and the dialog reopens with 3.7.

### BC-3 — filter
**Given** tracks with People 2, 3.5 and unrated **when** I filter People ≥ 3
**then** only the 3.5 track remains.

### BC-4 — sort
**When** I sort by People **then** it orders like Energy does.

### BC-5 — the old ratings are gone
**Given** a library that had Dance or Social values **when** I open it after the
change **then** those tracks show People unrated, and Dance and Social appear
nowhere (table, column settings, edit dialog, map).

### BC-6 — map
**When** I open the map's Similarity rail **then** it lists People (on, weight 1)
and neither Danceability nor Social acceptance; a track's details show People.

### BC-7 — saved settings
**Given** a browser with a column layout saved before the change **when** I open
the library **then** the table opens on the default layout without an error.
**Given** saved map settings **then** the map keeps their other weights.

### BC-8 — new tracks
**When** a scan adds tracks **then** their People is unrated.

### BC-9 — export and import
**Given** rated tracks **when** I export **then** the file carries `people`.
**When** I import a file whose `people` differs from the library's (neither 0)
**then** the conflict popup offers it like Energy.

### BC-10 — an old export still imports
**When** I import an export made before the change **then** the import works and
its Dance/Social values are not imported.

## Out of scope

Migrating the old values · removing old keys from an existing library file ·
Energy and Rank.
