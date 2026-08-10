# Library And File Loading

Status: Active
Last Updated: 2026-08-09
Source: Requirements.md sections 4, 12; new set-planning workflow

## Root Folder Concept

The library is organized around a **root folder** — the top-level directory
that contains all music subfolders. This mirrors how DJs actually organize
their crates: a `Music/` folder with subfolders like `Melodic Techno/`,
`Deep House/`, `Afro House/`.

### Root Folder Selection
- User selects a root folder via the "Load Files" page
- In Phase 1 (browser): `<input webkitdirectory>` — user picks the top folder
- In Phase 2 (PyWebView): native folder picker dialog
- The root path is persisted in settings

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
1. User selects root folder
2. Scanner walks all subdirectories recursively
3. For each audio file:
   - Parse filename for metadata (Phase 1) or extract via `mutagen` (Phase 2)
   - Check if file already exists in library (by `file_path` or artist+title)
   - If new: create song record with all fields, `root_folder` from parent folder
   - If exists: skip (idempotent — no duplicates)
4. Show progress bar with stats: total, added, skipped
5. User can then browse, tag, and annotate the imported tracks

### Re-scan
- Re-scanning the same root folder only adds new files — existing songs are
  never overwritten (preserves user-entered notes/tags/ratings)
- Files that no longer exist on disk are flagged but NOT deleted (user confirms)