# Library And File Loading

Status: Active
Last Updated: 2026-10-31
Source: Requirements.md sections 4, 12; new set-planning workflow

## Music Locations (issue #11)

The library reads **a list of music locations**. A music location is a folder
that the app scans as a root. The walk is recursive, and every folder inside it
holds crates. This mirrors how DJs organize: a `Music/` folder with subfolders
like `Melodic Techno/`, `Deep House/`, `Afro House/` — and, when the collection
outgrows one drive, a second folder somewhere else.

The single-root model is gone. The key `_config.root_path` no longer exists,
because the migration below consumes it. The app has no "one extra folder as a
crate" side door. A music location is the one concept, and it has one scanning
path.

### Location Selection

**A folder is the unit of import.** The app does not import single audio files.
A library grows from folders, never from loose file picks.

- The Import page (route `/load-files`) is the import surface
- The user picks a folder in a **native OS folder dialog**. It is a real
  directory dialog, never a browser file-input control. Manual path typing is
  never the primary flow
  - Desktop (PyWebView): native FOLDER_DIALOG through `POST /api/library/pick-folder`
  - Browser against a local backend: the backend's GTK portal dialog through
    the same endpoint (localhost is trusted, same machine)
  - Manual path entry stays as a fallback only, collapsed under "Advanced",
    for headless and SSH setups
- Selecting a folder **registers it as a music location and scans it at once**.
  This is one action, not "save" and then a separate "Scan"
- A location with **no subfolders** is valid. The app imports all audio files
  in it, and the crate takes the name of the location folder
- The app saves each location path in `library.json`. A re-scan adds new files
  only (INV-5, INV-20)
- **The Import page carries the first location.** The user adds, removes and
  rescans further locations in **Settings** (`REQ-17-LOC`)
- An **absent location** — an unmounted drive, a moved folder — gives a
  **no-op with a warning**. `POST /api/library/scan` answers
  `{started: false, total: 0, warning}`, and no other location changes. The
  app never treats this case as an error

### Folder → Crate Mapping

- **Every folder inside a location is a crate**, at any depth. The walk is
  recursive, so `House/`, `House/Deep/` and `House/Deep/Late/` give three
  crates. The rule is not "direct subfolders only"
- A crate name is its **path below its music location**, with `/` between the
  components (`house/deep`). The app **always flattens** nested crates into
  that name. It has never built a tree view (PF-11)
- A file directly in a location gives a crate named after that location
- A crate is a **registry entry** (INV-19), not a derived string. Each entry
  holds `{id, name, location_path}` in `_config.crates`. The song stores the
  **id**, never the name. Two folders called `House` in two locations give two
  crates with two ids, so a name collision can no longer merge them

### The crate registry and the one-time migration

A `library.json` written by the single-root model holds a `root_folder` string
on every song and one `_config.root_path`. The app migrates that file **when it
reads the file**:

- Each song's `root_folder` becomes a `crate_id`, resolved against the crate
  registry keyed by crate path. The app then removes the old field. No state
  ever holds both shapes
- The app consumes `_config.root_path`. The value gives the location that the
  old crates belong to, and the app then removes the key. There is no derived
  mirror of it: a second copy would be a second truth
- **The migration keeps each crate name.** An upgrade renames nothing
- A crate whose files sit outside the old root becomes **its own music
  location**, which the app discovers from the paths. The real library needed
  this: 92 songs sit under `~/Vault/downloads/…`, and the configured root is on
  an external drive
- **A second read changes nothing** and writes nothing. The pass is idempotent
- A **missing or corrupt registry self-heals** from the song rows. It never
  raises, so a hand-edited or truncated `_config` cannot cost the library
- **A row the migration cannot place keeps its old value, and the app logs it.**
  The app never drops the row and never blanks the value (INV-18)
- The pass repairs a song whose crate id the registry does not know. Such a row
  comes from an import made on another machine, or from a lost registry entry.
  The file path decides, because the path is the truth
- The pass leaves a **flagged-missing** song alone. Its crate is gone because
  the user removed that location. A rebuild would undo the removal

### Crate Selection for Set Planning
- When planning a set, the user selects which crates to work with
- Only songs from selected crates appear in the set-planning pool
- Multiple crates can be selected (e.g. Melodic Techno + Deep House + Afro House)
- Crate selection is **per set** — different sets can draw from different crates

## File Scanning

### Supported Formats
`.mp3`, `.flac`, `.wav`, `.m4a`, `.ogg`, `.aiff`

### Metadata Extraction
- **Phase 1 (browser)**: filename parsing only — extract BPM/key from
  filename patterns like `128BPM_Am_TrackName.mp3`
- **Phase 2 (PyWebView)**: full audio metadata via Python `mutagen` —
  ID3 tags, FLAC Vorbis comments, BPM, key, duration, artwork

### Import Flow
1. User picks the root folder in the native OS folder picker
2. The root is persisted; the scanner walks the root **and all
   subdirectories** recursively
3. For each audio file:
   - Extract metadata via `mutagen` (title/artist/album/year/BPM/key/
     duration/genre); fallback: filename parsing
   - Check if file already exists in library (by `file_path` or artist+title)
   - If new: create song record with all fields, `root_folder` from parent folder
     (root folder's own name when the file sits directly in the root)
   - If exists: skip (idempotent — no duplicates)
4. Show stats: total, added, skipped, errors
5. User can then browse, tag, and annotate the imported tracks

### Scan progress (REQ-10-SP, PF-86; built 2026-10-23, issue #46)
A scan decodes every file for its waveform peaks (~1.4 s per file measured),
so a large folder takes minutes. It must never be a silent blocking request.
- The scan runs as a **background job**. `POST /api/library/scan` returns at
  once with `{started: true, total: N}`.
- `GET /api/library/scan-status` reports `running`, `finished`, `done`,
  `total`, `current_file` (the file name, not the path), `current_crate`,
  `added`, `skipped`, `errors` (a list of `"<file>: <reason>"` strings), and
  once finished `result` (`{total, added, skipped, errors}`) or `error`.
- `done` counts **files finished**: added, skipped or failed. The first status
  reads `0 / N`, the last `N / N`; `current_file` is the file in progress.
  Progress comes from these counts, never from a timer.
- The job always ends with `running: false` and a `result` or an `error`, also
  when a file throws, so no view spins forever.
- **Where it shows** (Tim, 2026-10-23: *"yes, outside, toas with loading bar on
  library page, if clicked away only on the import page"*):
  - On the **Import page**: a progress bar, `done / total`, and the current
    track with its crate. Leaving the page and coming back mid-scan shows it
    again (the page reads the status on mount).
  - **Outside the Import page** (the library page, and the other pages too —
    the toast host is app-wide): a **progress toast** with the same bar, count
    and current track. The toast can be closed; once closed it stays closed
    for that scan, and the progress shows only on the Import page.
- **When it finishes** (Tim: *"no, just that it finished, no stats"*): a toast
  says **"Scan finished"**, without numbers, on whatever page is open. The
  Import page shows the summary (added / skipped / errors) only for a scan that
  finished while the page was open.
- Stopping a scan is not part of this (not requested).

### Slim library listing (REQ-10-SL; issue #47)
`GET /api/songs` carries each track's 200-float `waveform_peaks`, which is the
bulk of the body and something no list view needs: measured 3,735,141 bytes at
1,907 tracks, of which the peaks are most (62–71 % across the measurements on
record, about 1.2 KB per track).
- `?slim=true` returns the same rows with the `waveform_peaks` key absent —
  not null. Everything else is identical for value, including the model
  defaults a legacy row lacks (`rank: 0`, `phase_tags: []`, `vibe_tags: []`),
  because the projection runs after validation.
- **The app keeps the full rows.** `GET /api/songs` without the parameter is
  unchanged, so the library table, the track map and the player keep their
  waveforms; nothing in the frontend sends `slim`.
- This is a **projection, not pagination**: the same track count, the same
  order, no filter applied.
- `get_track` on the MCP side (`34_MCP_SERVER.md`) is the one read that asks
  for the whole row, peaks included.

### Backend folder browsing (picker support)
- `GET /api/library/browse?path=<dir>` lists a directory's subfolders for
  the client-side tree dialog
- Only directories are returned; access outside the home folder and the
  configured root is rejected (REQ-10-BW below)
- Used by the browser-mode folder dialog; desktop mode uses the PyWebView
  native dialog directly
- In the dialog a folder opens on click or Enter (focus moves to its first
  subfolder); the use button takes the folder that is open. Paths inside the
  home folder show as `~/…`; a folder without subfolders says so

#### The sandbox allows the configured root too (REQ-10-BW; issue #47)
The browser was sandboxed to `$HOME` only, so a library on an external drive
could not be reached — while `POST /api/library/scan` and `PUT
/api/library/root` accepted the very same path. Measured on the real library:
the root is `/media/tim/Extreme SSD/#MUSIC`, and browsing it answered `403
Access denied: … is outside your home directory (/home/tim)`.
- A path is allowed when it is the home directory, the **configured root**
  (`_config.root_path`, resolved), or inside either. Everything else keeps the
  403 and the same message shape, naming what was refused.
- `parent` is `null` at both boundaries (home and root), so the dialog's "up"
  control stops there.
- A library with no music location falls back to the home folder alone.
- The widening is the browser's, not the scan's: neither `POST /scan` nor
  `POST /locations` changes what it accepts.

### Re-scan
- Re-scanning the same music location adds new files only. The app never
  overwrites an existing song, so the user's notes, tags and ratings stay
- The app flags a file that no longer exists on disk and keeps it, until the
  user agrees to a cleanup
- A location that is not connected gives a warning and no scan (see above).
  The app never flags its songs from that run, because an unmounted drive is
  not proof that the files are gone

### Removing a music location (REQ-17-LOC)
The user removes a location in Settings. The app asks once, then flags that
location's songs as missing and keeps every row. A song stays in this flow,
with its data.
- The app keeps every song: each one holds its path, notes, tags, ratings and
  relationships, and gains a `missing_since` marker
- Re-adding the same folder re-resolves those songs by path, so they return
  with their data. Crate ids come from the crate path, so the same ids come
  back
- This flow replaces the old "orphan the songs on a root change" behaviour
- The scan, the Crate column and the crate tabs all read the same marker: a
  missing song still shows its crate name, marked as missing

### Audio analysis progress (REQ-10-AP)
- "Analyze BPM and key" runs as a **background job with visible progress**. A
  silent multi-minute blocking request is not acceptable.
- Backend: `POST /api/library/analyze-all` starts the job and returns
  `{started: true, total: N}`. `GET /api/library/analyze-status` reports
  `running`, `finished`, `stopping`, `done`, `total`, `current_title`, and once
  finished `result` (`{analyzed, updated, skipped, errors, cancelled}`) or
  `error`. `total` is counted once, at the start, and the status reports that
  same number.
- `done` counts **tracks finished** (analyzed, skipped or failed): the first
  status reads `0 / N`, the last `N / N`; `current_title` is the track in
  progress.
- **One background job at a time.** Library-wide analysis, per-track re-analyze
  (below) and the folder scan (REQ-10-SP) exclude each other in the backend:
  starting one while another runs is refused with 409 and a message naming the
  running job (checked and claimed under one lock). The Import page disables
  folder pick, Re-scan and Analyze while any job runs, including a job it
  picked back up on load, and while a start request is still on its way. A
  start refused with 409 reads both statuses, so a job started elsewhere (an
  MCP agent, a second tab) shows its progress here too, and the message is a
  notice, not a failure.
- The job is per-run (in-memory), not persisted to JSON — if the backend
  restarts mid-job, progress is simply gone and the user can restart.
- When a job (analysis or scan) ends, the app fires
  `klangkurator:library-changed`, so the library table refreshes.
- **No progress spins forever.** A run that vanished in a backend restart
  (neither a result nor an error) ends with "The scan stopped" or "The
  analysis stopped", never "finished". If the backend stops answering for
  about 10 s (20 failed reads in a row), the progress ends with "Lost contact
  with the app".

#### Where progress shows, and Abort (PF-86; built 2026-10-23, issue #46)
The same rule as the scan (REQ-10-SP), so both jobs behave alike:
- On the **Import page**: the progress bar, `done / total`, the current title,
  and an **Abort** button.
- **Outside the Import page**: a **progress toast** with the bar, `done /
  total` songs, the current title and **Abort**. It stacks with the regular
  toasts and is never replaced by them. It can be closed; once closed it stays
  closed for that run, and progress and Abort remain on the Import page.
  Escape does not close it (only its close button does), and the Import page
  counts with or without a trailing slash. Below 640 px toasts sit under the
  mobile header, and their close button is always visible on touch screens.
- **Abort** stops the job **after the track it is on** (3–5 s). Tracks already
  analyzed keep their BPM/key, because every track is saved as it finishes.
  While stopping, the progress reads "Stopping after this track…" and Abort is
  disabled. `POST /api/library/analyze-cancel` asks the running job to stop; it
  answers 409 when none runs, and the app then only refreshes the status (no
  error message). A stop requested during the last track ends the job normally
  (`cancelled: false`).
- When the job ends, a toast gives the summary — "Analysis complete" or
  "Analysis stopped", with analyzed / updated / skipped — and the Import page
  keeps its "Last run" line.
- A page reload (or a second tab) while a job runs picks it back up: the app
  reads both statuses once on start. Closing the desktop window stops the
  backend, and the job with it.

### Per-track re-analyze (REQ-10-RA, PF-79; issue #6)
- A track's **detail page** offers `Re-analyze` next to Play / Edit /
  Relationships. It opens a popup that names the track, shows the stored BPM and
  key, and runs `POST /api/library/analyze/{song_id}` — the same detector as the
  library-wide job, on one track, **synchronously** (one track is 3–5 s; no
  progress job is needed).
- Re-analysis **overrides** the "only fill missing" rule for that track: that is
  the point. The library-wide job skips a track that already has a BPM, which
  makes a *wrong* BPM otherwise unrepairable except by typing.
- The popup takes an optional **BPM range** (min/max, both or neither, inside
  40–250). The range is a **hint**: it biases the detector toward the window
  rather than filtering candidates, so it cannot return the detector's
  out-of-window answer as if it were inside. `bpm` and `musical_key` are
  re-detected in the same run; `duration` is only filled when missing.
- If the detected BPM does not fall inside a given range, the stored BPM is
  **left unchanged** and the popup names the detected value. Nothing is
  overwritten silently (INV-13).
- Key is written on every successful run, range or not.
- The popup shows before → after and has no Cancel — the write lands on a
  successful run, so offering to undo it would be false.

### Library view — empty-library redirect
- Opening the Library view with **zero songs** auto-redirects to the
  Import page (the import entry point)
- Without a root folder, Import opens on "Start with your music folder." with
  "Choose folder & scan" and the three steps (choose, scan, analyze); with a
  root it shows the folder, BPM/key analysis, the crates and the path
  fallback
- No redirect when the library has at least one song