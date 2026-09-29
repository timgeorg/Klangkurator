---
source: manual
created: 2026-09-24
tags:
  - plan
  - implementation
  - testing
status: active
---
# PLAN — Audio Analysis Progress (REQ-10-AP)

Status: Active
Estimated: 0.5 day
Requirements: `docs/requirements/10_LIBRARY_AND_FILE_LOADING.md` → "Audio analysis progress"
Testing guide: see "Testing Guide" section at the bottom.

## Problem

"Analyze BPM/Key" posts `POST /api/library/analyze-all` and blocks until
every track is analyzed (librosa, ~3-5s per track). For a crate of 100+
tracks the UI silently hangs for minutes with a spinner and no feedback.
Tim asked for `Analyzing (3/47)…`-style progress.

## Design

**Pattern: in-memory job + polling.** No WebSocket, no SSE, no Celery —
the backend is a single-user localhost JSON-store app; polling a status
endpoint every 500ms is plenty and keeps the stack simple.

```
┌────────────────┐   POST /analyze-all       ┌──────────────────┐
│ LoadFiles.tsx  │ ────────────────────────► │ library.py       │
│                │   → 202 {started: true}   │  start_analysis() │
│   poll 500ms   │                           └────────┬─────────┘
│                │◄──── GET /analyze-status ──┘        │ background
│  "3/47…"       │   {running, done, total,            │ thread
└────────────────┘    current_title, error?}          ▼
                                              analyze_all_missing_bpm
                                              (existing, unchanged)
```

## Tasks

### 1. Backend — `backend/api/library.py`

New module-level state (single job, process-local):

```python
_analyze_state = {
    "running": False, "done": 0, "total": 0,
    "current_title": "", "started_at": None,
    "error": None,
}
_analyze_lock = threading.Lock()
```

- **`POST /api/library/analyze-all`** — rework:
  - If a job is already running → `HTTPException(409, "Analysis already running")`
  - Compute `total` (songs missing BPM with an existing file) synchronously;
    if `total == 0` → return the summary directly (`{"analyzed": 0, ...}`)
  - Reset state, set `running: True`, spawn a `threading.Thread(daemon=True)`
    that calls `analyze_all_missing_bpm(store)` with a **progress callback**,
    then sets `running: False` and stores the final summary in state
  - Return `202 {"started": true, "total": N}`
- **`GET /api/library/analyze-status`** — returns the state dict:
  `{"running": bool, "done": int, "total": int, "current_title": str,
    "finished": bool, "result": summary | None}`
- **`analyze_all_missing_bpm`** (`backend/scanner/audio_analysis.py`) —
  add optional `progress_cb(done: int, total: int, current_title: str)`
  parameter; call it *before* each track starts and after each completes.
  Signature stays backward compatible (default `None`).

Thread-safety notes:
- `_analyze_state` mutations are trivial dict writes — protected by the
  lock only on start/reset; per-track counter updates are a single
  `done += 1` in one writer thread (no race in CPython).
- The existing uvicorn server is fine running FastAPI sync endpoints in
  its threadpool; the job thread must not touch `store` concurrently with
  requests that mutate the library. Acceptable for a single-user app
  (matches the existing design where scan/analyze already mutate from
  request handlers); document this in a code comment.

### 2. Frontend — `src/pages/LoadFiles.tsx`

Replace `handleAnalyzeAll` + the `busy`-disabled button with:

- State: `analysis: {running, done, total, current_title} | null`
- On click: `POST /library/analyze-all`
  - `202` → set `analysis = {running: true, done: 0, total}`, start polling
    `GET /library/analyze-status` every **500ms** (`setInterval` in an
    effect keyed on `analysis?.running`)
  - `409` → toast "Analysis already running"
- While running, the Audio Analysis card shows:
  - Progress bar (`<Progress>` component, `done/total`)
  - Text: `Analyzing (3/47)…` + `current_title` (truncated)
  - Button disabled
- When poll returns `running: false && finished` → show final toast with
  the summary (`analyzed/updated/skipped`), clear `analysis`, refresh
  library state (`loadCurrentState()`), stop polling
- Polling must stop on unmount (cleanup in effect return)

### 3. Frontend build + integration

- `npm run build` so the desktop/server mode serves the new UI
- No new dependencies

## Out of scope

- Persisting job state across restarts (requirement says per-run)
- Cancelling a running job (future; keep the button disabled while running)
- WebSocket/SSE push

---

# Testing Guide

## T1 — Unit: progress callback (backend)

```bash
cd /home/tim/Vault/Repositories/Klangkurator/dj-crate-explorer
.venv-none  # no project venv — use the workspace one
/home/tim/Vault/.venv/bin/python - <<'EOF'
import sys; sys.path.insert(0, '.')
from backend.scanner.audio_analysis import analyze_all_missing_bpm
from backend.storage.base_store import BaseStore
from backend.storage.library_store import LibraryStore
from pathlib import Path

# fixture library: 2 songs pointing at generated audio (created in T2 steps)
store = LibraryStore(BaseStore(Path('/tmp/kk-ap-test/library.json')))
events = []
result = analyze_all_missing_bpm(store, progress_cb=lambda d, t, title: events.append((d, t, title)))
assert len(events) >= 2, f"expected ≥2 callbacks, got {len(events)}"
for done, total, title in events:
    assert isinstance(done, int) and isinstance(total, int) and total >= 1
    assert done >= 1, "callback fires with done ≥ 1"
print("T1 PASS — callbacks:", events)
EOF
```

Fixture creation (run before T1): see T3 — generate audio with ffmpeg.

## T2 — API contract (backend, running server)

```bash
# start a test backend on 8010 with a fixture library
# then:
curl -s -X POST localhost:8010/api/library/analyze-all
# expect: {"started":true,"total":N} or a direct summary if nothing to analyze
curl -s localhost:8010/api/library/analyze-status
# expect while running: {"running":true,"done":<n>,"total":T,"current_title":"..."}
# expect after finish:  {"running":false,"done":T,"total":T,"finished":true,"result":{...}}
curl -s -X POST localhost:8010/api/library/analyze-all
# expect 409 while the first job is still running
```

## T3 — End-to-end browser check (integration)

1. Generate a fixture crate with 3 short tracks, two **missing** BPM:
   ```bash
   mkdir -p /home/tim/Vault/.kk-ap-fixture && cd /home/tim/Vault/.kk-ap-fixture
   ffmpeg -loglevel error -f lavfi -i "sine=frequency=440:duration=30" \
     -metadata title="Track A" -metadata artist="Fix A" -y a.mp3
   ffmpeg -loglevel error -f lavfi -i "sine=frequency=550:duration=30" \
     -metadata title="Has BPM" -metadata artist="Fix B" \
     -metadata TBPM=128 -y b.mp3
   ffmpeg -loglevel error -f lavfi -i "sine=frequency=330:duration=30" \
     -metadata title="Third" -metadata artist="Fix C" -y c.mp3
   ```
2. Start a **test** backend (isolated data dir):
   ```bash
   cd dj-crate-explorer
   setsid env KLANGKURATOR_DATA_DIR=/home/tim/.klangkurator-aptest \
     /home/tim/Vault/.venv/bin/python -m uvicorn backend.main:app \
     --host 127.0.0.1 --port 8010 > /tmp/kk-ap-backend.log 2>&1 &
   ```
   ⚠️ `config.py` currently hardcodes `DATA_DIR = Path.home() / ".klangkurator"`
   — the env var is NOT read. For the isolated test, either accept the shared
   dir on a throwaway scan or temporarily point `HOME` elsewhere. The
   implementer must verify which and note it.
3. Via the UI on `http://127.0.0.1:8010/load-files`:
   - Set root via Advanced (path: the fixture dir) → scan (3 added)
   - Click "Analyze BPM/Key"
   - **PASS if:** progress bar + `Analyzing (1/2)…` text appear within ~1s;
     counter increments; on completion a toast shows the summary and the
     progress UI disappears
4. Double-click protection: while a job runs, `POST analyze-all` again → 409
   (check via devtools Network tab or curl).
5. Backend restart mid-job: kill the test backend during analysis →
   restart → `analyze-status` shows idle state, app remains usable.

## T4 — Regression

- `npx tsc -p tsconfig.app.json --noEmit` — no NEW errors in changed files
- `npm run build` succeeds
- Re-scan idempotency still holds (INV-5): re-scan → `added: 0`
- `analyze_one_song` (`POST /analyze/{id}`) still works unchanged

## Cleanup after tests

```bash
pkill -f "uvicorn backend.main:app.*8010"
rm -rf /home/tim/Vault/.kk-ap-fixture /home/tim/.klangkurator-aptest
# restore the shared data dir if the test polluted it:
rm -f ~/.klangkurator/library.json   # only if it contains test fixtures
```