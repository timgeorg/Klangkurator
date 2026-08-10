---
source: manual
created: 2026-08-09
tags:
  - plan
  - implementation
  - mvp
status: active
---
# Phase 0 — Project Setup

Status: Active
Estimated: 1 day
Prerequisites: None

## Goal

Get the Python backend project scaffolded alongside the existing frontend,
with a running FastAPI server that serves a health check endpoint.

## Context

The frontend lives in `dj-crate-explorer/` with this structure:
```
dj-crate-explorer/
├── src/              # React frontend (existing)
├── package.json
├── vite.config.ts
└── ...
```

We add a `backend/` directory at the same level. The backend is a Python
package that serves a FastAPI app. It will later be wrapped by PyWebView
(Phase 5), but for now it runs standalone via `uvicorn`.

## Tasks

### 0.1 — Create backend directory structure

```
dj-crate-explorer/
├── backend/
│   ├── __init__.py
│   ├── main.py                  # FastAPI app + static file serving + PyWebView entry
│   ├── config.py                # Paths, constants, data directory resolution
│   ├── api/
│   │   ├── __init__.py          # APIRouter aggregation
│   │   ├── songs.py
│   │   ├── tags.py
│   │   ├── relationships.py
│   │   ├── blocks.py
│   │   ├── sets.py
│   │   └── library.py           # Scan / crate endpoints
│   ├── models/
│   │   ├── __init__.py
│   │   ├── song.py
│   │   ├── tag.py
│   │   ├── relationship.py
│   │   ├── playlist.py
│   │   ├── block.py
│   │   └── set.py               # Phase-based set model
│   ├── storage/
│   │   ├── __init__.py
│   │   ├── base_store.py        # Generic JSON file store (load, save, atomic write)
│   │   ├── library_store.py     # library.json (songs, tags, relationships, playlists)
│   │   ├── blocks_store.py      # blocks.json
│   │   └── sets_store.py        # sets.json
│   ├── scanner/
│   │   ├── __init__.py
│   │   ├── file_scanner.py      # Walk directory tree, find audio files
│   │   └── metadata.py          # mutagen-based metadata extraction
│   └── pywebview_launcher.py    # PyWebView window (Phase 5, stub for now)
├── requirements.txt             # Python deps
└── ...
```

### 0.2 — Python dependencies

Create `requirements.txt` at the `dj-crate-explorer/` root:

```
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
pydantic>=2.0
mutagen>=1.47
pywebview>=5.0
```

Install into the workspace venv:
```bash
/home/tim/Vault/.venv/bin/pip install -r requirements.txt
```

### 0.3 — Config module

`backend/config.py`:
- `DATA_DIR`: resolves to `~/.klangkurator/` (create if not exists)
- `LIBRARY_FILE`: `DATA_DIR / "library.json"`
- `BLOCKS_FILE`: `DATA_DIR / "blocks.json"`
- `SETS_FILE`: `DATA_DIR / "sets.json"`
- `SUPPORTED_AUDIO_EXTENSIONS`: `['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.aiff', '.aac', '.wma']`
- `FRONTEND_DIST`: path to `src/../dist/` (built React assets, for Phase 5)

### 0.4 — FastAPI app skeleton

`backend/main.py`:
- Create `FastAPI` instance
- Mount `GET /api/health` → `{"status": "ok", "version": "0.1.0"}`
- Include API routers (empty stubs for now, just import the router objects)
- CORS: allow `localhost:5173` (Vite dev server) and `localhost:8000` (PyWebView)
- Static file serving: mount `dist/` at `/` (for Phase 5, disabled in dev)

### 0.5 — API router stubs

Each file in `backend/api/` creates an `APIRouter` with the correct prefix:
- `songs.py` → `router = APIRouter(prefix="/api/songs", tags=["songs"])`
- `tags.py` → `prefix="/api/tags"`
- `relationships.py` → `prefix="/api/relationships"`
- `blocks.py` → `prefix="/api/blocks"`
- `sets.py` → `prefix="/api/sets"`
- `library.py` → `prefix="/api/library"`

Each router has no endpoints yet — just the router object and a comment listing the endpoints that will be added in Phase 2.

### 0.6 — Verify

- Run: `cd dj-crate-explorer && /home/tim/Vault/.venv/bin/uvicorn backend.main:app --reload --port 8000`
- `curl http://localhost:8000/api/health` → `{"status": "ok", "version": "0.1.0"}`
- OpenAPI docs at `http://localhost:8000/docs` loads (empty but valid)

## Deliverable

FastAPI server starts, serves health check, OpenAPI docs are accessible.
All directory structure and stubs are in place for Phase 1.

## Notes

- Use the workspace venv at `/home/tim/Vault/.venv/` (already used for other repos)
- The backend is a Python **package** (`backend/`), not a script — run via `uvicorn backend.main:app`
- No virtualenv inside the repo — use the shared workspace venv
- `.gitignore`: add `backend/__pycache__/`, `*.pyc`, `dist/`