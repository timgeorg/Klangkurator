# System Context

Status: Active
Last Updated: 2026-09-24
Source: Requirements.md sections 2, 13

## Runtime Architecture

### Phase 1 (current): Web App
- React + Vite + TypeScript + Tailwind + shadcn/ui
- Browser `localStorage` persistence
- File loading via browser File System Access API (or `<input webkitdirectory>`)
- No backend — all data in the browser

### Phase 2 (MVP target): Desktop App via PyWebView + FastAPI
- **FastAPI** backend serving a JSON-file API on localhost
- **PyWebView** wraps the React frontend in a desktop window, pointing at `localhost:8000`
- No cloud, no login, no external database
- Audio metadata extraction via Python (`mutagen` library)
- FastAPI chosen over PyWebView's JS bridge (Smartimize's approach) for two reasons:
  1. Frontend and backend are independently testable during development
  2. The same frontend can later run in a browser or on mobile without rewrite
- PyWebView's native file dialog is used for folder selection when available;
  in browser mode the backend's native dialog / directory-browsing endpoint
  is used instead — never a loose file-input dialog (the root folder is the
  unit of import, see [10_LIBRARY_AND_FILE_LOADING])

### Phase 3 (future): Browser / Mobile Companion
- Same FastAPI backend, accessible from any browser
- Mobile companion: read-only library access + set planning (no audio files needed on device — metadata and notes only)
- Could be hosted on a home server / VPS for remote access
- The FastAPI architecture makes this a deployment change, not a rewrite

## Data Service Abstraction

Two interchangeable services behind a common interface (`DataService`):

| Service | Mode | Behavior |
|---|---|---|
| `MockupDataService` | Dev | Ships rich sample tracks/tags/relationships; idempotent upserts (stable IDs) |
| `RemoteDataService` | Desktop + Browser | Calls FastAPI backend via `fetch()`; replaces localStorage |

`DataServiceFactory` selects per environment:
- If `window.pywebview` exists and FastAPI is on localhost → `RemoteDataService` (desktop)
- If running in a browser with a reachable backend URL → `RemoteDataService` (browser/mobile)
- Otherwise → `MockupDataService` (dev/demo)

## Backend Data Files (Phase 2)

Three JSON files loaded fully at startup (~1,000–5,000 songs fits easily in
memory — no need for per-song files or a database):

```
library/
├── library.json   # all songs, tags, relationships
├── blocks.json    # all blocks (reusable mini-mixes)
└── sets.json      # all sets (phase-based set plans)
```

## Design System

- Dark professional DJ theme
- Lexicon-style dark + **orange/red accents**
- Compact, data-dense table aesthetic
- Color-coded BPM badges, key indicators, energy/dance/social rating dots
- Static SVG waveforms (not animated)