# Klangkurator

A local-first DJ music library organizer — knowledge management for DJs. Inspired by
[Lexicon](https://www.lexicondj.com/), focused on deep organization: a dense, filterable
library table, real waveform previews, embedded album art, tags and relationships between
tracks, and set planning. Runs as a desktop app or in the browser, entirely on your machine.

<!-- TODO: screenshot — library table, dark theme, cover + waveform columns visible -->

## Features

- **Library table** — 17 data-driveable columns (BPM, key, genre/subgenres, energy
  ratings, tags, notes, ...) with per-column filters (text, range, multi-select),
  resizing, show/hide, and **drag-and-drop column reorder** — order, visibility, and
  widths all persist to localStorage
- **Real waveforms** — 200-bucket peak envelopes computed from the actual audio at scan
  time (soundfile, float32 decode + decimation); a lazy backfill endpoint covers tracks
  scanned before this feature existed
- **Audio player** — fixed bottom bar with play/pause/seek and persisted volume; seeking
  works via a Range-request streaming endpoint that only serves library-tracked audio files
- **Album covers** — embedded art extracted from ID3 `APIC` / FLAC pictures / MP4 `covr`,
  re-encoded to bounded 300px thumbnails, served through a cacheable artwork endpoint
- **Root-folder import** — native OS folder picker in desktop mode, sandboxed
  home-directory browser dialog in web mode; auto-scan on import, and idempotent re-scan
  that never overwrites your notes, tags, or ratings
- **Background analysis** — scanning and audio analysis run as a background job with live
  progress (polled status endpoint), so the UI stays responsive while a library processes
- **Song detail view** — full metadata, notes, tags, relationships, cover, and waveform in
  one place; an empty library redirects to the import flow instead of a dead-end table
- **One launcher** — `./run.sh` covers dev, server-only, and PyWebView desktop modes

## Architecture

| Layer | Stack |
|---|---|
| Frontend | React, Vite, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | FastAPI (Python), JSON-file storage, mutagen + soundfile |
| Desktop shell | PyWebView |

The backend owns the audio work — file scanning, metadata extraction, the waveform and
artwork pipelines, background analysis jobs — and serves the built frontend in production
mode. Storage is three human-readable JSON files under `~/.klangkurator/` (`library.json`,
`blocks.json`, `sets.json`).

Why JSON files instead of SQLite: Klangkurator is deliberately a single-user, local-first
tool. Plain JSON keeps the data model inspectable and diffable, makes backup and hand
editing trivial, and avoids schema-migration machinery at this scale — in exchange for an
explicit, numbered invariant table (stable IDs, idempotent re-scan, ID-only references) in
[docs/requirements/91_INVARIANTS.md](docs/requirements/91_INVARIANTS.md).

Security posture reflects the local-only design: CORS is scoped to localhost origins, and
the audio endpoint serves only paths already tracked in the library — no client-controlled
paths, no traversal, and non-audio files are rejected with a 415.

## Quick start

Requires Node.js/npm and Python 3.10+.

```sh
./run.sh            # dev (default): FastAPI backend + Vite dev server, hot reload
./run.sh server     # backend only, serves the built frontend from one port
./run.sh desktop    # build frontend, then open a PyWebView desktop window
./run.sh status     # what's running, health check, data dir state
./run.sh stop       # stop the backend (and Vite dev server)
./run.sh help       # full usage
```

The launcher finds a Python interpreter that has the backend deps (or honors
`KLANGKURATOR_PYTHON`), reuses a healthy backend instead of failing on a port conflict,
and skips package installs with `NO_INSTALL=1`. Default ports: `BACKEND_PORT=8000`,
`FRONTEND_PORT=8080`; backend log at `/tmp/klangkurator-backend.log`. The API answers at
`GET /api/health` if you want to explore it directly.

First run: the library is empty and the app takes you to the import page — pick a music
folder, let the scan finish (you get a progress bar), and the library view takes over.

## How it's built

The interesting part is the process, not just the feature list. Each feature passes
through a requirements → plan → agent-squad → live-verify pipeline:

1. **Requirements tree** — `docs/requirements/` holds numbered domain specs (library
   view, song model, tags, set planning, invariants, NFRs) with a changelog; behavior
   changes go through the spec before the code.
2. **Dispatchable planning** — each feature is validated as a short design, then split
   into flash-sized subtasks (one file or one endpoint each, explicit inputs/outputs,
   its own verification command) in
   [docs/plans/BACKLOG_ORCHESTRATION.ipynb](docs/plans/BACKLOG_ORCHESTRATION.ipynb),
   with a dependency map across features.
3. **Agent squad execution** — implementer and tester subagents execute the subtasks;
   the orchestration notebook records designs, decisions, and results as the trail.
4. **Live verification** — "done" means verified in a real browser against the real
   library (92 tracks at time of writing), with the TypeScript/lint baseline checked
   before and after.

The tester role is where judgment pays off — probing beyond the happy path has caught:

- **Metadata extraction bugs on real files**: mutagen's `VComment.get` raises
  `ValueError` on unknown keys, and FLAC/ID3 return list-valued tags that would silently
  poison fields — fixed with multi-key, list-aware tag reads and per-format fallbacks
- **Security holes while wiring the player**: a CORS wildcard that would let any website
  probe library-servable files, and path serving that needed an explicit trust boundary —
  now localhost-only CORS plus library-tracked-paths-only serving
- **A layout blowup in horizontal-scroll work**: a `w-max` wrapper let the flexible
  trailing column size to raw content length (an 868px notes cell, measured) — caught in
  live browser verification, fixed by bounding the column
- **An unreachable performance target**: the waveform-per-track budget failed on long
  tracks (1.25s measured on an 11-minute file); the bottleneck turned out to be audio
  decode, not peak computation. Fixed by reading float32 and decimating before bucketing —
  and the honest remaining decode floor is documented in the module rather than claimed away

## Documentation

- `docs/requirements/` — numbered domain specs with a changelog: `13_LIBRARY_VIEW.md`
  (the table contract), `11_SONG_MODEL.md`, `16_SET_PLANNING.md`, the data-model docs
  (`20`–`22`), `90_NFRS.md`, `91_INVARIANTS.md` (the numbered constraint table),
  `92_PLANNED_FEATURES.md` (the backlog), `93_OUT_OF_SCOPE.md`
- `docs/plans/BACKLOG_ORCHESTRATION.ipynb` — the working session log: sprint board,
  per-feature designs and decisions, verification results
- `docs/plans/PHASE_*.md` — the phased build plan (setup → storage → API/scanner →
  frontend integration → desktop packaging → analysis progress)
- `Requirements.md` — the original master spec; domain detail now lives in
  `docs/requirements/`

## Current state and roadmap

Works today: root-folder import with auto-scan and idempotent re-scan, the full library
table (filters, reorder, persisted layout), real waveform previews, album covers, the
media player, the song detail view, and the set/block planning data model — running
against the author's real 92-track music library.

Honest limits: single-user, JSON-file storage (no SQLite, no sync), the analysis job is
in-process and not persisted across restarts, and the player is single-track (no queue
yet). This is a working local tool, not production software.

Next up (tracked in [docs/requirements/92_PLANNED_FEATURES.md](docs/requirements/92_PLANNED_FEATURES.md)):
a player queue and bulk tag editing (PF-3), smart playlists (PF-9), set-planning
auto-suggestion (energy curves, genre flow) and set templates (PF-20–24), Rekordbox
integration — cue-point read/write, playlist and USB export (PF-30–34), and transition
mining plus local-LLM-assisted curation (PF-40+).
