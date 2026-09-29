# Klangkurator

A locally-hosted DJ music library organizer — a personal "knowledge management for DJs" tool. Inspired by [Lexicon DJ](https://www.lexicondj.com/) but focused on deep organization, tagging, knowledge-graph relationships between tracks, and set/block planning.

Built in two phases (see `Requirements.md`):

- **Phase 1 — Web app (currently working):** React + Vite + TypeScript + Tailwind + shadcn/ui, runs in the browser with `localStorage` persistence.
- **Phase 2 — Local desktop app (skeleton built, not wired up):** Python/FastAPI backend, JSON-file storage, launched as a desktop window via PyWebView.

---

## Current state (2026-09)

- **Frontend**: functional table-based library UI (playlist/set/tag editing, filter popovers, relationships graph canvas). Runs via `npm run dev`.
- **Backend**: a freshly "vibecoded" FastAPI skeleton (last commit 2026-08-11) with API routes for songs/tags/blocks/sets/relationships/library + audio file scanning (`file_scanner`, `metadata`, `audio_analysis`).
- **⚠️ Not yet done:**
  - Backend has **never been run against real music data** — `~/.klangkurator/` is empty (no `library.json`, `blocks.json`, `sets.json`).
  - The scanner → metadata → audio-analysis pipeline is unverified end-to-end.
  - Desktop/PyWebView launcher exists but is untested.

---

## Project layout

```
dj-crate-explorer/
├── backend/                  # Phase 2 — Python/FastAPI backend
│   ├── main.py               # FastAPI app + SPA static-file serving
│   ├── __main__.py           # entry: python -m backend (desktop or --server)
│   ├── config.py             # data dir (~/.klangkurator), frontend dist path
│   ├── pywebview_launcher.py # PyWebView window / uvicorn server launcher
│   ├── api/                  # route modules: songs, tags, blocks, sets, relationships, library, misc
│   ├── storage/              # JSON stores: library, blocks, sets
│   ├── scanner/              # file scanner, metadata, audio analysis
│   └── models/               # Pydantic models
├── src/                      # Phase 1 — React frontend (Vite)
├── dist/                     # built frontend (npm run build output)
├── Requirements.md           # master spec & vision
├── requirements.txt          # backend Python deps
└── package.json              # frontend deps
```

---

## Prerequisites

- **Node.js + npm** (for the frontend / `npm run dev`)
- **Python 3.10+** (for the backend, Phase 2)

---

## Quick start — `./run.sh`

The launcher figures out which Python interpreter has the backend deps and starts
the right thing for you.

```sh
./run.sh            # dev mode (default): backend + Vite dev server, hot reload
./run.sh server     # backend only, serves the built dist/ on one port
./run.sh desktop    # build the frontend, then open the PyWebView window
./run.sh status     # what's running, health check, data dir state
./run.sh stop       # stop the backend (and Vite) for this project
./run.sh help       # full usage
```

Dev mode prints the two URLs and reuses an already-running backend on port 8000
instead of failing on the port conflict. The manual commands below still work.

**Overrides:** `KLANGKURATOR_PYTHON` (interpreter to use), `BACKEND_PORT` (8000),
`FRONTEND_PORT` (8080), `NO_INSTALL=1` (never run `npm install`).

Dev-mode log for a backend started by the script: `/tmp/klangkurator-backend.log`.

---

## Running the frontend (Phase 1 — recommended)

```sh
cd dj-crate-explorer
npm i
npm run dev
```

This starts the Vite dev server with hot reload. Open the printed localhost URL in your browser. Data persists to browser `localStorage`.

**Production build** (outputs to `dist/`, used by the backend for static serving):

```sh
npm run build
```

---

## Running the backend (Phase 2 — in development)

Install Python dependencies:

```sh
pip install -r requirements.txt
```

> Heavy deps: `librosa` (audio analysis) and `pywebview` (desktop window). If audio analysis isn't needed yet, you can `pip install fastapi uvicorn pydantic mutagen` to get the API running without `librosa`.

**Server-only mode** (for development — API at `http://127.0.0.1:8000`, serves the built `dist/` if present):

```sh
python -m backend.main --server
# or
python -m backend --server
```

Custom port:

```sh
python -m backend.main --server --port 9000
```

**Desktop mode** (opens a PyWebView window pointing at the running app; requires the frontend to be built first):

```sh
python -m backend.main
```

**Health check:** `GET http://127.0.0.1:{port}/api/health` → `{"status":"ok","version":"0.1.0"}`

### Data storage

The backend reads/writes JSON files in `~/.klangkurator/`:

```
~/.klangkurator/
├── library.json   # songs, tags, relationships
├── blocks.json    # reusable mix blocks
└── sets.json      # full DJ sets
```

Files are created on first run. Note: this directory is currently **empty** — the backend has not yet been run against real data.

---

## Roadmap

Full vision is documented in **`Requirements.md`** (song model, library table, tags, genres, relationships graph, blocks/sets, data integrity rules).

Remaining work to reach the Phase 2 target:
- [ ] Exercise the backend against a real audio folder (scan → metadata → analysis)
- [ ] Verify data integrity (stable IDs, idempotent init) per `Requirements.md` §2.4
- [ ] Test the PyWebView desktop launcher end-to-end
- [ ] Hook the React frontend to the FastAPI API (instead of `localStorage`)
