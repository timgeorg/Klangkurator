# Music Locations — Behaviour Contract (issue #11)

Judged **black-box** against a copy of the library, through the running app,
never against Tim's real data folder.

Crate names and paths below use the real library's shapes, so a reader can find
the same things in the sandbox copy.

---

## ML-1 — The migration keeps the library

**Given** a `library.json` from the single-root model. It holds 1,907 songs,.
27 distinct `root_folder` values, and a `_config.root_path`.
**When** the app starts and reads the library.
**Then** `GET /api/songs` still returns 1,907 rows.
**And** no row carries `root_folder`.
**And** every row carries a `crate_id`.
**And** every `crate_id` appears in `GET /api/library/crates`.
**And** no crate name differs from the name that crate had before.

## ML-2 — A second read changes nothing

**Given** a library the migration has already run on.
**When** the app reads it again, or the backend restarts.
**Then** `library.json` matches what it held before, byte for byte.
**And** the app migrates no song a second time.

## ML-3 — A corrupt registry self-heals

**Given** a library whose `_config.crates` is a string, or holds junk entries,.
or holds a crate with no `location_path`. Its `_config.music_locations` is
absent.
**When** the app reads the library.
**Then** the app starts, and answers `GET /api/songs` with every row.
**And** every row's `crate_id` appears in `GET /api/library/crates`.
**And** the log names each entry the app skipped.

## ML-4 — A row the migration cannot place is kept

**Given** a song with `root_folder` and an empty `file_path`.
**When** the app reads the library.
**Then** the row stays in the library.
**And** it keeps its old `root_folder` value.
**And** the app logged the row.

## ML-5 — A second location is discovered from the data

**Given** the real library. Its `classic-techno-groove-techno` songs sit under.
`~/Vault/downloads/…`, and the configured root is on an external drive.
**When** the migration runs.
**Then** `GET /api/library/locations` lists **two** locations.
**And** the 92 songs belong to the second one.
**And** their crate carries the name `classic-techno-groove-techno`.

## ML-6 — A crate survives a scan of its location

**Given** a location holding 3 audio files in 2 crates.
**When** the user scans it.
**Then** `GET /api/library/crates` reports 2 crates, with counts 2 and 1.
**And** the crate counts add up to the library's track count.

## ML-7 — Two crates with one name stay two crates

**Given** two locations, and each one holds a folder called `House`.
**When** the user scans both.
**Then** `GET /api/library/crates` lists **two** crates named `House`.
**And** they carry different ids and different `location_path` values.
**And** the crate tabs show two tabs.
**And** a click on one tab shows only that location's `House` tracks.

## ML-8 — The Crate filter keys on the id

**Given** two crates named `House`.
**When** the user picks one in the Crate filter.
**Then** the table shows exactly that crate's tracks.
**And** the filter chip and the tab name the same crate.

## ML-9 — An absent location is a no-op with a warning

**Given** a registered location whose folder is not on disk.
**When** the user rescans it in Settings.
**Then** a notice names the folder and says it is not there.
**And** no error state appears.
**And** its songs keep their crates and their notes.
**And** the songs of every other location stay as they were.
**And** `POST /api/library/scan` answered `{started: false, warning}`.

## ML-10 — Removing a location flags and keeps

**Given** a location holding tracks with notes, tags and ratings.
**When** the user removes it in Settings and confirms.
**Then** the dialog told the user that every track stays.
**And** `GET /api/songs` still returns those rows.
**And** each one carries `missing_since`.
**And** their notes, tags and ratings keep their values.
**And** the crate no longer appears in `GET /api/library/crates`.
**And** `DELETE /api/library/locations/{id}` reported `songs_flagged` > 0.

## ML-11 — Re-adding a location brings its songs back

**Given** a removed location.
**When** the user adds the same folder again.
**Then** its songs lose `missing_since`.
**And** their `crate_id` matches the id they had before the removal.
**And** the crate appears in `GET /api/library/crates` with its old name.
**And** their notes, tags and ratings are still there.

## ML-12 — The same file under two locations is one song

**Given** a library holding a file.
**When** the user scans a second location that also holds that file.
**Then** the library's track count stays the same.
**And** the file has one row.

## ML-13 — The Import page is the first-location flow

**Given** a library with no location.
**When** the user opens Import.
**Then** the page offers "Choose folder & scan".
**When** the user picks a folder.
**Then** the app registers it as a location and scans it, in one action.
**And** the page lists the location with its crate and track counts.

## ML-14 — Settings owns the ongoing list

**Given** a library with locations.
**When** the user opens Settings.
**Then** a "Music folders" section lists every location with its counts.
**And** each row offers Rescan and Remove.
**And** an absent folder carries the marker "Not connected".
**And** the section offers adding a folder by picker and by typed path.

## ML-15 — Both themes, four widths

**Given** the Settings sections and the Import page.
**When** the window is 1440, 1280, 768 or 375 px wide, in Ink and in Paper.
**Then** no control overlaps another, no control is cut off, and every control.
is reachable
**And** every icon-only action has an accessible name.
**And** the crate tab bar still wraps, and still collapses past 10 crates.

## ML-16 — The data directory guard

**Given** `KLANGKURATOR_REQUIRE_HOME` pointing at a scratch folder.
**When** the resolved data directory sits outside it.
**Then** the store raises an error instead of writing.
**And** it creates or changes no file outside the scratch folder.
