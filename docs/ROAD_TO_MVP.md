# Road to MVP — Klangkurator Masterplan

Status: Active
Last Updated: 2026-08-09

## What This Sprint Delivers

A working desktop app where Tim can:
1. Point it at his music folder and import all tracks with real metadata (mutagen)
2. Browse, annotate, and tag tracks in the library table
3. All data persisted to local JSON files (no more localStorage)

**After this sprint** (next sprint): phase-based set planning UI, markdown export,
arc review. See `16_SET_PLANNING.md`.

**Not in any MVP:** Rekordbox integration, transition mining engine, AI features,
spectral clustering. Those are post-MVP (see `92_PLANNED_FEATURES.md`).

## Current State

```
✅ Frontend exists (React + Vite + TS + Tailwind + shadcn/ui)
✅ Library table with columns, filtering, inline editing
✅ Song/Tag/Relationship/Playlist/Block/Set data model in localStorage
✅ MockupDataService with sample data
✅ Edit Song dialog, Relationships dialog, Graph view
✅ Block editor, Set editor (flat — no phases yet)
✅ Load Files page (browser File System Access API)
❌ No Python backend — everything is localStorage
❌ No real metadata extraction (filename parsing only)
❌ No root folder / crate concept
❌ No phase-based set planning UI
❌ No set export to markdown
```

## Architecture Decision: MVP Backend

**Architecture decision: FastAPI + JSON files + PyWebView.** Not Smartimize's JS bridge, not a database.

Rationale:
- The dataset is small (1,000–5,000 songs, ~5–50 MB JSON) — no DB needed
- FastAPI is async, fast, and has automatic OpenAPI docs (useful for frontend integration)
- PyWebView wraps the existing React frontend in a desktop window
- The frontend already has a `DataService` abstraction — we add a `RemoteDataService`
  that calls the FastAPI backend instead of localStorage
- **FastAPI over PyWebView's JS bridge** (Smartimize's approach): enables a future
  browser/mobile companion version without rewriting the frontend. The same React
  app talks to `fetch('/api/...')` whether it's running in PyWebView, a browser,
  or on a phone pointed at a home server. Smartimize's `window.pywebview.api.*`
  approach locks the frontend to the desktop shell.
- PyWebView's native file dialog is still used for folder selection when available
  (hybrid: native dialog in desktop, browser File System Access API as fallback)

```
┌──────────────────────────────────────────────┐
│                 PyWebView                     │
│  ┌──────────────┐    ┌───────────────────┐   │
│  │  React UI     │◄──►│  FastAPI Backend  │   │
│  │  (existing)   │    │  (JSON files)     │   │
│  └──────────────┘    └───────────────────┘   │
│                             │                 │
│                    ┌────────┴────────┐        │
│                    │  library.json   │        │
│                    │  blocks.json    │        │
│                    │  sets.json      │        │
│                    └─────────────────┘        │
│                             │                 │
│                    ┌────────┴────────┐        │
│                    │  mutagen        │        │
│                    │  (audio tags)   │        │
│                    └─────────────────┘        │
└──────────────────────────────────────────────┘
```

---

## Phases

> Each phase has a detailed implementation plan in `docs/plans/`.
> This section is the summary — see the linked files for full task lists, code snippets, and verification steps.

### Phase 0 — Project Setup (1 day)
> Detailed plan: [docs/plans/PHASE_0_PROJECT_SETUP.md](plans/PHASE_0_PROJECT_SETUP.md)

Get the Python backend project scaffolded alongside the frontend.

**Tasks:**
- [ ] Create `backend/` directory in `dj-crate-explorer/`
- [ ] Python project structure:
  ```
  backend/
  ├── __init__.py
  ├── main.py              # FastAPI app entry point
  ├── api/
  │   ├── __init__.py
  │   ├── songs.py         # Song CRUD endpoints
  │   ├── tags.py          # Tag CRUD endpoints
  │   ├── blocks.py        # Block CRUD endpoints
  │   ├── sets.py          # Set CRUD endpoints
  │   ├── library.py       # Library scan / import endpoints
  │   └── relationships.py # Relationship CRUD endpoints
  ├── models/
  │   ├── __init__.py
  │   ├── song.py          # Pydantic models matching TS interfaces
  │   ├── tag.py
  │   ├── block.py
  │   ├── set.py
  │   └── relationship.py
  ├── storage/
  │   ├── __init__.py
  │   ├── library_store.py # Read/write library.json
  │   ├── blocks_store.py  # Read/write blocks.json
  │   └── sets_store.py    # Read/write sets.json
  ├── scanner/
  │   ├── __init__.py
  │   ├── file_scanner.py  # Walk directory tree, find audio files
  │   └── metadata.py      # mutagen-based metadata extraction
  └── pywebview_api.py     # PyWebView API bridge (Phase 3)
  ```
- [ ] `requirements.txt`: fastapi, uvicorn, mutagen, pywebview, pydantic
- [ ] Basic FastAPI app with health check endpoint
- [ ] Run backend: `uvicorn backend.main:app --reload --port 8000`

**Deliverable:** FastAPI server starts, serves `GET /api/health` → `{"status": "ok"}`

---

### Phase 1 — Storage Layer + Data Models (2 days)
> Detailed plan: [docs/plans/PHASE_1_STORAGE_AND_MODELS.md](plans/PHASE_1_STORAGE_AND_MODELS.md)

Build the JSON file storage and Pydantic models that match the existing
TypeScript interfaces.

**Tasks:**
- [ ] Pydantic models for Song, Tag, SongRelationship, Playlist, Block, DJSet
  - Match field names exactly to `src/lib/storage.ts` interfaces
  - Add new fields from requirements: `phase_tags`, `vibe_tags`, `root_folder`
  - Add new Set model with phases (SetPhase, SetItem) per `16_SET_PLANNING.md`
- [ ] `LibraryStore` class:
  - Load `library.json` into memory on startup
  - CRUD methods for songs, tags, relationships, playlists
  - Write back to file on every mutation (atomic write: write to temp, rename)
  - Idempotent import (upsert by file_path or artist+title)
- [ ] `BlocksStore` class: same pattern for `blocks.json`
- [ ] `SetsStore` class: same pattern for `sets.json` (with new phase-based model)
- [ ] Data directory: `~/.klangkurator/` (or app data dir) for the 3 JSON files

**Deliverable:** Backend can read/write all three JSON files, models validated.

---

### Phase 2 — API Layer + File Scanner (2 days)
> Detailed plan: [docs/plans/PHASE_2_API_AND_SCANNER.md](plans/PHASE_2_API_AND_SCANNER.md)

Expose CRUD via FastAPI and implement real metadata extraction.

**Tasks:**
- [ ] Song endpoints: `GET /api/songs`, `POST /api/songs`, `PUT /api/songs/:id`, `DELETE /api/songs/:id`
- [ ] Tag endpoints: same pattern
- [ ] Block endpoints: same pattern
- [ ] Set endpoints: same pattern (with new phase-based Set model)
- [ ] Relationship endpoints: same pattern
- [ ] Library scan endpoint: `POST /api/library/scan`
  - Input: `{ "root_path": "/home/tim/Music" }`
  - Walks directory tree, finds audio files (.mp3, .flac, .wav, .m4a, .ogg, .aiff)
  - Extracts metadata via mutagen (title, artist, album, year, BPM, key, duration, artwork)
  - Derives `root_folder` from parent folder name
  - Upserts into library.json (idempotent — existing songs not overwritten)
  - Returns: `{ "total": 247, "added": 180, "skipped": 67 }`
- [ ] Library scan is synchronous for MVP (no background jobs — 1,000 files takes ~30s)
- [ ] Crate listing endpoint: `GET /api/library/crates`
  - Returns distinct `root_folder` values with track counts

**Deliverable:** `curl POST /api/library/scan -d '{"root_path":"/home/tim/Music"}'` imports all tracks with real metadata.

---

### Phase 3 — Frontend Integration (2 days)
> Detailed plan: [docs/plans/PHASE_3_FRONTEND_INTEGRATION.md](plans/PHASE_3_FRONTEND_INTEGRATION.md)

Connect the existing React frontend to the FastAPI backend.

**Tasks:**
- [ ] Create `RemoteDataService` implementing the `DataService` interface
  - All methods call the FastAPI backend via `fetch()`
  - Replaces `MockupDataService` and `LocalDataService` when running in desktop mode
- [ ] Update `DataServiceFactory` to select based on environment:
  - If `window.pywebview` exists → use `RemoteDataService` (desktop)
  - Otherwise → use `MockupDataService` (dev/demo)
- [ ] Replace `storage.ts` localStorage calls with API calls
  - All `getSongs()`, `addSong()`, etc. become `fetch('/api/songs')` etc.
  - Keep the same interface so components don't change
- [ ] Update `LoadFiles` page:
  - Replace browser File System Access API with a call to `POST /api/library/scan`
  - Show a folder picker (PyWebView native dialog in Phase 4, text input for now)
  - Show scan progress (poll a status endpoint or use the scan response)
- [ ] Crate selector: new component on the Sets page
  - Calls `GET /api/library/crates`
  - Multi-select chips for which crates to include in a set

**Deliverable:** Frontend running against real backend — import real music folder, see real metadata in the table.

---

### Phase 4 — Desktop Packaging (1 day)
> Detailed plan: [docs/plans/PHASE_4_DESKTOP_PACKAGING.md](plans/PHASE_4_DESKTOP_PACKAGING.md)

Wrap the whole thing as a desktop app.

**Tasks:**
- [ ] FastAPI serves built frontend from `dist/` (static files + SPA fallback)
- [ ] PyWebView launcher: starts uvicorn in daemon thread, opens window
- [ ] Native folder picker via PyWebView's `create_file_dialog(FOLDER_DIALOG)`
- [ ] Clean shutdown on window close (stop uvicorn)
- [ ] `python -m backend.main` → desktop app; `--server` flag → server-only for dev
- [ ] Build frontend: `npm run build` → `dist/`

**Deliverable:** `python -m backend.main` opens a desktop window. Import music folder, annotate tracks, everything persists to `~/.klangkurator/`. Also accessible from any browser at `localhost:{port}`.

---

## Next Sprint (Post-MVP)

These are planned but not part of the current sprint:

- **Phase 5 — Set Planning UI**: phase-based set builder (Kanban board), arc review, markdown export. See `16_SET_PLANNING.md`.
- **Phase 6 — Polish**: bulk annotate, quick-add notes, search across notes, column persistence, backup/export.
- **Phase 7+ — Rekordbox integration, transition mining, AI curation**: see `92_PLANNED_FEATURES.md`.

---

## Post-MVP: Browser / Mobile Companion

The FastAPI architecture means a browser/mobile companion is a deployment
change, not a rewrite:

- **Browser**: open `localhost:{port}` in any browser — already works after Phase 4
- **Mobile**: deploy FastAPI on a home server, open the URL on phone — the React
  frontend is responsive by default (Tailwind). Touch-friendly drag-and-drop for
  the phase board is the main adaptation needed.
- **No audio files on mobile**: the mobile companion is metadata + notes + set
  planning only. Audio stays on the desktop where Rekordbox can access it.

See `92_PLANNED_FEATURES.md` PF-60 through PF-63.

---

## Timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| 0 — Project Setup | 1 day | 1 day |
| 1 — Storage + Models | 2 days | 3 days |
| 2 — API + File Scanner | 2 days | 5 days |
| 3 — Frontend Integration | 2 days | 7 days |
| 4 — Desktop Packaging | 1 day | 8 days |

**~8 working days to a working desktop app.** If Tim works evenings + one weekend, that's ~1.5 weeks.

## Post-MVP Roadmap (Not In This Plan)

| Feature | Domain Doc | Priority |
|---------|-----------|----------|
| Rekordbox cue point read/write | `30_REKORDBOX_INTEGRATION.md` | High — enables Rekordbox workflow |
| Set export as Rekordbox playlist | `30_REKORDBOX_INTEGRATION.md` | High — closes the loop to performance |
| Transition mining from sets | `31_TRANSITION_MINING.md` | High — core differentiator |
| Transition suggestion engine | `31_TRANSITION_MINING.md` | Medium |
| AI set planning skill | `32_AI_CURATION.md` | Medium — scales the Sterling session |
| Spectral clustering | `32_AI_CURATION.md` | Low — nice to have |
| USB export | `30_REKORDBOX_INTEGRATION.md` | Medium |

## Tech Stack Summary

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React + Vite + TS + Tailwind + shadcn/ui | Already built |
| Backend | FastAPI + Pydantic | Async, fast, auto-docs, clean models |
| Storage | JSON files (3 files) | Simple, no DB needed for 1k–5k songs |
| Metadata | mutagen | Standard Python audio metadata library |
| Desktop | PyWebView | Wraps web app as native window, minimal overhead |
| Packaging | PyInstaller (later) | Standalone executable distribution |