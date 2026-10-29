# System Context

Status: Active
Last Updated: 2026-09-24
Source: Requirements.md sections 2, 13

## Runtime Architecture

### Phase 1 (historical): Web App, browser only
- React + Vite + TypeScript + Tailwind + shadcn/ui
- Browser `localStorage` persistence — **retired**: all state is in
  `~/.klangkurator/*.json` since Phase 2, and UI preferences moved there too in
  issue #51 (PF-89)
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

## Data Access

The frontend reads and writes through `src/lib/storage.ts`, whose `storage`
object calls the FastAPI backend (`RemoteStorageImpl`) in the desktop window
and in a browser alike. There is no sample-data mode: the earlier mock layer
(`MockupDataService`, `LocalDataService`, `DataServiceFactory` under
`src/services/`) had no caller and was removed on 2026-10-23 (issue #57).

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

Replaced on 2026-10-08 by the editorial design system (issue #1). The
source of truth is [`design-system/`](../../design-system/README.md) at the
repo root; `DESIGN.md` records the built world.

- **Editorial look** from the user's moodboard: ink (dark, default) and paper
  (light) themes, one signal orange, black-and-white covers, a small
  vocabulary of geometric shapes, fine paper grain without roughness
- **Orange means "this one"**: the playing/current track, selection, focus,
  the one primary action, the brand mark. Never a category colour; users'
  genre and tag colours come from a print-ink palette that leaves it out
- **Signature: the orange cut** on the current track's cover (an orange disc
  multiplied over the black-and-white image), in the table and the player
- **Type**: Inter for the interface, Literata for editorial moments (empty
  states, detail titles, notes), Geist Mono for data; all self-hosted
  (offline desktop app)
- **Dense where it works**: the library stays a dense, filterable table;
  hairlines instead of boxes; numbers in mono, right-aligned
- **Static SVG waveforms** (not animated); the player's waveform is the
  scrubber