# Technical plan — scan and analysis progress (issue #46)

Spec: `docs/requirements/10_LIBRARY_AND_FILE_LOADING.md`, REQ-10-SP and REQ-10-AP
(incl. "Where progress shows, and Abort"). Contract:
`JOB_PROGRESS_BEHAVIOR_CONTRACT.md`. Branch: `feature_46_job-progress` from `int`.
Decisions: Tim, 2026-10-23 (quoted in the spec). Issue #47 (MCP) depends on the
scan job built here.

## Verified facts (2026-10-23, `int` @ ab17b60)

- `POST /api/library/scan` is synchronous and returns only when every file is
  done (`backend/api/library.py:28-119`). No test covers it.
- Analysis is already a job: `_analyze_state`, `_analyze_lock`, a daemon thread,
  `GET /analyze-status` (`backend/api/library.py:240-419`).
- `analyze_all_missing_bpm` calls `progress_cb` with the 1-based index of the
  track **about to start**, and the missing-file skip path has no second call
  (`backend/scanner/audio_analysis.py:241-251`), so the first status reads `1 / N`.
- The route's `total` (songs missing BPM whose file exists,
  `backend/api/library.py:354-362`) can differ from the loop's own count
  (`audio_analysis.py:226,236`), which then overwrites it.
- Scan and analysis never check each other; only the Import page's `busy`
  (`src/pages/LoadFiles.tsx:234-236`) keeps them apart.
- `TOAST_LIMIT = 1` (`src/hooks/use-toast.ts:5`): a `toast()`-based progress
  toast would be replaced by the next toast. Radix guards
  `duration={Infinity}`, portals every `<Toast>` inside the provider into the
  shared viewport, and needs `altText` on `ToastAction`
  (`node_modules/@radix-ui/react-toast/dist/index.mjs`). `Toaster` takes no
  props today (`src/components/ui/toaster.tsx:4`) and sits outside
  `<BrowserRouter>` (`src/App.tsx:40`).
- Only `SongLibrary` listens for `klangkurator:library-changed`
  (`src/components/dj/SongLibrary.tsx:174`).
- Closing the desktop window stops the backend (`backend/pywebview_launcher.py`).

## Files in scope

- `backend/api/library.py`
- `backend/scanner/audio_analysis.py`
- `backend/tests/test_scan_job.py`
- `backend/tests/test_analysis_job.py`
- `backend/tests/00_Index.md`
- `src/lib/BackgroundJobsContext.tsx`
- `src/lib/00_Index.md`
- `src/components/dj/JobProgressToast.tsx`
- `src/components/dj/00_Index.md`
- `src/components/ui/toaster.tsx`
- `src/App.tsx`
- `src/pages/LoadFiles.tsx`
- `docs/requirements/10_LIBRARY_AND_FILE_LOADING.md` (only if the build must deviate)
- `docs/requirements/99_CHANGELOG.md` (only if the build must deviate)

## Steps

### Backend

1. **One job lock.** Replace the analysis-only guard with one module-level
   `_job_lock` plus `_job: str | None` (`"scan"`, `"analysis"`, `"reanalyze"`).
   Every start (`POST /scan`, `/analyze-all`, `/analyze/{song_id}`) checks and
   claims it under the lock, else 409 naming the running job ("A scan is
   running"). The job's `finally` releases it.
2. **Scan job.** Split `scan_library`: the handler validates the folder, walks
   it, counts `N`, claims the lock, initialises `_scan_state`, starts a daemon
   thread and returns `{started: true, total: N}`. `_run_scan(root, files)`
   keeps the existing per-file logic unchanged (metadata, crate, dedupe, peaks,
   artwork). Before each file it sets `current_file` (name) and `current_crate`;
   after each file (added, skipped or failed) `done += 1`. Its `finally` sets
   `running=False`, `finished=True` and `result` or `error`. `GET /scan-status`
   returns a copy, like `analyze_status`.
3. **Analysis counter.** In `analyze_all_missing_bpm`, `should_stop()` is the
   loop's first statement; call `progress_cb(idx - 1, …)` before track `idx`
   and `progress_cb(idx, …)` after it on every path (analyzed, failed, missing
   file). The route counts `total` once and hands the loop that same list.
4. **Abort.** `_analyze_stop = threading.Event()`, cleared inside the locked
   setup before the thread starts (otherwise an early cancel is lost).
   `POST /analyze-cancel` answers 409 when no analysis runs, else sets the event
   and returns `{stopping: true}`. Status `stopping = running and
   _analyze_stop.is_set()`. The result gains `cancelled`, true only when the
   loop broke on the event.

### Frontend

5. **`App.tsx`:** move `<Toaster />` inside `<BrowserRouter>` (so the job toast
   can read the route) and wrap it and the layout in
   `<BackgroundJobsProvider>`.
6. **`BackgroundJobsContext.tsx`** (pattern: `src/lib/PlayerContext.tsx`):
   `scan` and `analysis` progress, `startScan(root)`, `startAnalysis()`,
   `abortAnalysis()`, and a per-run `toastClosed` flag for each. On mount it
   reads both statuses once (resume). While a job runs it polls that job's
   status every 500 ms, and a failed poll keeps polling. When a job ends it fires
   `klangkurator:library-changed`. A scan ends with `toast({title: "Scan finished"})`
   and no numbers. An analysis ends with "Analysis complete" or "Analysis stopped"
   plus analyzed / updated / skipped. An Abort answered with 409 only refreshes
   the status.
7. **`toaster.tsx`:** accept `children?: ReactNode`, rendered inside
   `<ToastProvider>` before `<ToastViewport />`.
8. **`JobProgressToast.tsx`** (rendered as `<Toaster><JobProgressToast /></Toaster>`):
   one controlled Radix `<Toast open duration={Infinity}>`. It shows the title,
   a `<Progress>`, `done / total` and the current title (for a scan, the track
   and its crate). For analysis it adds
   `<ToastAction altText="Abort the BPM and key analysis">`. It is open while a job
   runs, the route is not `/load-files`, and the toast was not closed for this
   run. Closing it (X or swipe; Escape is ignored, BC-18) sets `toastClosed` for the run. Hold the last
   progress so the exit animation is not empty. The jobs exclude each other, so
   one toast slot is enough.
9. **`LoadFiles.tsx`:** remove its own scan and analysis polling and state, and
   read the context instead. It shows inline progress for both jobs (bar,
   `done / total`, current title, or track plus crate) and an **Abort** button
   next to the analysis bar. `busy` is true while any job runs, including a
   resumed one. Show `ScanSummary` only for a scan that finished while the page
   was mounted.

## Hook ordering

`LoadFiles.tsx` (4+ hooks): `useBackgroundJobs()` first, then the derived
`busy`, then the existing `loadCurrentState` callback and its effect; the
"finished while mounted" effect reads the context's scan state, so it comes
after the context read. `JobProgressToast`: `useBackgroundJobs()` and
`useLocation()` before the derived `open`.

## Tests

- `test_scan_job.py` (per-file work mocked): start returns `{started, total}`
  at once; a second start → 409; `done` rises monotonically from 0 to `N`; a
  file that throws lands in `errors` and the job still finishes; an unexpected
  exception ends `running: false` with `error`; an empty folder gives
  `total: 0`; analysis started during a scan → 409, and the reverse.
- `test_analysis_job.py`: the first status has `done == 0`, the last
  `done == total`; a missing-file skip advances `done`; cancel with no job →
  409; cancel during track 1 of 3 → `cancelled: true`, `analyzed == 1`, tracks
  2–3 keep `bpm = None`; cancel during the last track → `cancelled: false`.
- Frontend: vitest is node-only (no DOM setup), so the UI is covered by the
  live check.

## Gates (repo `AGENTS.md`)

`npx tsc --noEmit -p tsconfig.app.json` (no new errors) ·
`python -m pytest backend/tests` · `npx eslint <changed files>` ·
`npx vite build` · live check, against the sandbox (never the real library),
in both themes at 1440, 1280, 768 and 375 px: Import page during a scan and an
analysis, library page with the toast, toast next to a regular toast · the
impeccable audit for the toast and the Import page.

## Live verification (sandbox)

Scan a folder of about 20 files and walk the contract: the toast appears outside
Import, closing it leaves the progress on Import, and the scan ends with "Scan
finished" and no numbers. Then analysis: Abort mid-run, Abort during the last
track, and a reload mid-run resumes it.

## PR

Into `int`, titled for #46, body naming the contract clauses checked. No
`Closes` keyword (the issue closes at the `int` → `main` release).
