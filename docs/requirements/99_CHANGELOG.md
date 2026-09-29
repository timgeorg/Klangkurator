# Requirements Changelog

Status: Active
Last Updated: 2026-09-24

## 2026-09-24 (v2)

### Audio analysis progress (10)

Analysis of BPM/key can take minutes for a full crate. Added REQ-10-AP:
the "Analyze BPM/Key" job must show live progress (`Analyzing (3/47)…`,
current track, progress bar) via a polled `GET /api/library/analyze-status`
endpoint. Single background job; completion summary unchanged.

### Backlog additions (92)

Six features requested by Tim, recorded in `92_PLANNED_FEATURES.md`
(PF-12 … PF-17): duration display format, real waveform preview, album
cover column, column drag-and-drop reorder, media player, song detail view.

- **Duration format revision** — PF-12's plain seconds replaced by mm:ss
  (minutes unpadded) after user feedback; all duration paths unified.

## 2026-09-24

### Root folder is the unit of import (10, 02, 93)

Closed the gap between the requirement and the running app, found while
using the app for the first time with a real backend:

- **Loose file import is out** — "load audio files by themselves" was a
  Phase-1 leftover (File API `<input type=file>` in `fileLoader.ts`) and
  contradicted the crate concept. Explicitly added as OOS-11.
- **Native OS folder picker mandatory** — manual path typing demoted to a
  collapsed "Advanced" fallback; `<input webkitdirectory>` / File System
  Access API dropped as a primary flow
- **Root folder selection auto-scans** — picking a folder sets the root
  and immediately imports; no separate "Save" + "Scan" sequence
- **Subfolder-less root is valid** — audio files directly in the root
  import with the root's own name as the crate
- **Backend folder browsing** — `GET /api/library/browse` lists
  directories under the user's home for the browser-mode picker
- **Library empty → Load Files** — the Library view redirects to the
  import page when it has zero songs to show

## 2026-08-09

### Initial split from monolithic Requirements.md

Split the root-level `Requirements.md` into a numbered requirements folder
following the Smartimize `docs/requirements/` pattern:

- `00_INDEX.md` — requirements index
- `01_VISION_AND_PRINCIPLES.md` — vision, principles, target user
- `02_SYSTEM_CONTEXT.md` — runtime architecture, data services, design system
- `10_LIBRARY_AND_FILE_LOADING.md` — root folder selection, crate mapping, file scanning
- `11_SONG_MODEL.md` — full song entity including new phase_tags and vibe_tags
- `12_TAGS_AND_GENRES.md` — tags and genre hierarchy
- `13_LIBRARY_VIEW.md` — table layout, columns, filtering
- `14_RELATIONSHIPS.md` — knowledge graph and relationship types
- `15_BLOCKS.md` — reusable mini-mixes
- `16_SET_PLANNING.md` — **NEW** — phase-based set planning workflow
- `17_SETTINGS.md` — tags/genres/backup/preferences
- `20_DATA_MODEL_OVERVIEW.md` — entity relationships
- `21_DATA_MODEL_LIBRARY_JSON.md` — library.json schema
- `22_DATA_MODEL_BLOCKS_AND_SETS_JSON.md` — blocks.json and sets.json schemas
- `90_NFRS.md` — non-functional requirements
- `91_INVARIANTS.md` — constraints and data integrity
- `92_PLANNED_FEATURES.md` — future work
- `93_OUT_OF_SCOPE.md` — explicit non-goals

### New: Set Planning domain (16)

Added the set planning workflow based on the 2026-08-08 session where Tim
planned a 2-hour sunset set with Sterling. Key additions:

- **Set entity** with phases, target duration, crate selection
- **Phase-based set building** (Kanban-style board: pool → phase columns)
- **Phase tags and vibe tags** on songs (opening, building, sunset, peak, closing; dark, uplifting, tearjerker, banger)
- **Automated set checks**: artist clustering, genre ping-pong, energy dips, tempo jumps
- **Arc review**: energy curve, genre flow, artist clustering visualization
- **Set export** as markdown (matching the existing `09-08-2026_Welzheimer-Str-Sunset.md` format)

### New: Root folder / crate concept (10)

Formalized the "select a root folder, subfolders become crates" workflow
that Tim described. Crates are the unit of selection for set planning —
you pick which crates to draw from, then filter within that pool.

## 2026-08-09 (v2 — Rekordbox + transitions + AI)

### Refined: Vision and positioning

Klangkurator does **not** replace Rekordbox. Rekordbox stays the core of
playing (cue points, USB export, CDJ/XDJ performance). Klangkurator is the
curation and set planning layer above it. Updated `01_VISION_AND_PRINCIPLES.md`
with 3 new principles (P7–P9):

- P7: Rekordbox is the playback engine, not the competitor
- P8: Transitions are first-class entities
- P9: AI augments curation, doesn't replace it

### New: Rekordbox Integration domain (30)

Added `30_REKORDBOX_INTEGRATION.md` — read/write cue points, export sets as
Rekordbox playlists, USB export, bidirectional sync. Planned features PF-30
through PF-34.

### New: Transition Mining domain (31)

Added `31_TRANSITION_MINING.md` — mine transitions from existing sets, suggest
transitions based on history, score transition compatibility, transition
library view, import transitions from Rekordbox mix history. Planned features
PF-40 through PF-44.

### New: AI Curation domain (32)

Added `32_AI_CURATION.md` — AI set planning (the Sterling session workflow),
AI transition suggestions, spectral clustering, micro-structure suggestions,
vibe analysis, energy arc optimization. All running locally via Ollama /
llama-cpp-python. Planned features PF-50 through PF-56.

### Updated: Out of scope

Added OOS-9: no cloud-based AI processing — all AI runs locally.
Clarified OOS-5: Klangkurator does not replace Rekordbox.

### Refined: Architecture — FastAPI over PyWebView JS bridge

Updated `02_SYSTEM_CONTEXT.md` and `ROAD_TO_MVP.md` to clarify the architecture
decision: FastAPI on localhost (not Smartimize's `window.pywebview.api` JS bridge).

Rationale: FastAPI enables a future browser/mobile companion version without
rewriting the frontend. The same React app talks to `fetch('/api/...')` whether
it's in PyWebView, a browser, or on a phone pointed at a home server.

PyWebView's native file dialog is still used for folder selection when available
(hybrid approach). Browser File System Access API is the fallback.

### New: Browser / Mobile Companion roadmap

Added Phase 3 (future) to `02_SYSTEM_CONTEXT.md`: browser/mobile companion with
read-only library access + set planning. No audio files on device — metadata and
notes only. FastAPI makes this a deployment change, not a rewrite.

Added PF-60 through PF-63 to `92_PLANNED_FEATURES.md`.
Added OOS-10: no mobile audio playback (metadata + notes + set planning only).