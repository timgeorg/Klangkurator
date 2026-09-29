# Library And File Loading

Status: Active
Last Updated: 2026-09-24
Source: Requirements.md sections 4, 12; new set-planning workflow

## Root Folder Concept

The library is organized around a **root folder** — the top-level directory
that contains all music subfolders. This mirrors how DJs actually organize
their crates: a `Music/` folder with subfolders like `Melodic Techno/`,
`Deep House/`, `Afro House/`.

### Root Folder Selection

The root folder is **the unit of import**. Loading individual audio files
is explicitly not an import mode — a library is built from folders, never
from loose file picks.

- The "Load Files" page is the single import surface
- Folder selection happens in a **native OS folder picker** (a real
  directory dialog — never a browser file-input dialog and never manual
  path typing as the primary flow)
  - Desktop (PyWebView): native FOLDER_DIALOG via `POST /api/library/pick-folder`
  - Browser against a local backend: the backend's GTK portal dialog via
    the same endpoint (localhost is trusted, same machine)
  - Manual path entry stays as a fallback only (collapsed under
    "Advanced" — for headless/SSH setups)
- Selecting a folder **sets the root and immediately scans it** — one
  action, not "save then separately press Scan"
- A root with **no subfolders** is valid: all audio files in the root
  itself are imported; the crate name is the root folder's own name
- The root path is persisted in settings; re-scans only add new files
  (idempotent — INV-5)

### Folder → Crate Mapping
- Each **subfolder** inside the root becomes a **crate** (selectable collection)
- The folder name is the crate name
- Nested folders (e.g. `House/Deep/`) are flattened with `/` as separator
  (e.g. `House/Deep`) or shown as a tree — TBD, see [92_PLANNED_FEATURES]
- The song's `root_folder` property is derived from its parent folder name
  inside the library root

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

### Backend folder browsing (picker support)
- `GET /api/library/browse?path=<dir>` lists a directory's subfolders for
  the client-side tree dialog
- Only directories are returned; access outside the user's home directory
  is rejected
- Used by the browser-mode folder dialog; desktop mode uses the PyWebView
  native dialog directly

### Re-scan
- Re-scanning the same root folder only adds new files — existing songs are
  never overwritten (preserves user-entered notes/tags/ratings)
- Files that no longer exist on disk are flagged but NOT deleted (user confirms)

### Audio analysis progress (REQ-10-AP)
- "Analyze BPM/Key" runs as a **background job with visible progress** —
  the user sees `Analyzing (3/47)…` with the current track title, a
  progress bar, and elapsed/remaining feel. A silent multi-minute
  blocking request is not acceptable.
- Backend: analysis runs async; progress is exposed at
  `GET /api/library/analyze-status` (done / total / current_title /
  running). The frontend polls it while a job is running.
- Only one analysis job runs at a time; starting a new one while one is
  running is rejected with a clear message.
- The job is per-run (in-memory), not persisted to JSON — if the backend
  restarts mid-job, progress is simply gone and the user can restart.
- Final summary (analyzed/updated/skipped/errors) is shown on completion.

### Library view — empty-library redirect
- Opening the Library view with **zero songs** auto-redirects to the
  Load Files page (the import entry point)
- Load Files shows what is already configured (root folder, crates)
  and the picker/scan actions
- No redirect when the library has at least one song