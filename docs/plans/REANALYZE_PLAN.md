# Technical plan — per-track re-analyze with a BPM range hint (issue #6)

Repo: `dj-crate-explorer`, worktree `/tmp/kk-issue6`, branch
`feature_6_reanalyze-bpm-key` off `origin/main` (634e88c).

## Problem

The library-wide "Analyze BPM and key" only fills **missing** values
(`analyze_all_missing_bpm` skips any song whose `bpm` is already set —
`backend/scanner/audio_analysis.py:161`). A *wrong* BPM is therefore not
repairable except by hand. The repair path is a per-track re-analyze that
overwrites, and it must accept a **BPM range** so a first-pass octave error can
be steered.

## Verified facts (2026-10-14, probed on `origin/main` 634e88c)

> Line numbers below are the **pre-change** rev this plan was written against.
> `backend/api/library.py` was rewritten on this branch, so its citations no
> longer point at the same code — the quoted snippets are what was verified.

1. **The route existed and was already synchronous, unlocked and overwriting.**
   At the probed rev (`origin/main` 634e88c) `backend/api/library.py:390-422`
   was `POST /api/library/analyze/{song_id}` → `analyze_one_song`: no body, no
   lock, never read `_analyze_state["running"]`, and wrote `bpm`/`musical_key`
   unconditionally (`:409-412`); `duration` only when `None` (`:413-414`). The
   batch path deliberately does the opposite — so re-analyze already *is*
   semantically different from "analyze all". This part is wiring, not new.
   (Line numbers are the pre-change rev; the route was rewritten in this
   branch, so they no longer point at the same code.)
2. **`beat_track` takes a prior; `feature.tempo` is *not* the same estimator.**
   `librosa.beat.beat_track` exposes `prior` (`librosa/beat.py:44`, passed at
   `:226-232`), so the prior needs no swap of estimator at all. That matters,
   because the obvious-looking swap to `librosa.feature.tempo` is **not**
   identity-preserving: `beat_track` builds its onset envelope with
   `aggregate=np.median` (`beat.py:217`) while `feature.tempo` defaults to
   `np.mean` (`feature/rhythm.py:292`). Probed on the real library (14 tracks
   with existing files): **2 of 14 land on a different BPM** —
   `Confusion - Paramount` 184.6 → 112.3, `Dioxid - Outside` 92.3 → 136.0. On
   synthetic click tracks the two agree (median ≈ mean when onsets are sparse),
   which is exactly why the click-track probe was a false negative and the
   real-audio probe is the one that counts. ⇒ the implementation keeps
   `beat_track(y=y, sr=sr, prior=prior)`, so the no-hint answer is bit-identical
   to today's and BC-11 holds.
3. **Filtering candidates to the window silently lies.** Probed: with the
   window `(200, 220)` on a true-128 track the in-window argmax picks `215.3`;
   with `(60, 100)` on true-140 it picks `69.8`. There is **no** usable
   detector for "the answer is not in the window" — the in-window/global peak
   ratio was 0.021 for that 215.3 (loud, wrong) and 0.951 for the true 172.3
   answer of a *different* track. The window always returns a number; it has
   no notion of "no fit". ⇒ do **not** implement a candidate filter.
4. **A bounded log-normal prior biases the estimate into the window — it does
   not guarantee it.** With `prior = lognorm(loc=0, s=ln(max/min)/4,
   scale=sqrt(min*max))` passed to `beat_track`: 7/7 in-window on the click
   cases, and it steered the mis-read `117.5` to `172.3` for a true-174 track
   asked for `165–185`. On **real** library audio it steers too (`Confusion -
   Paramount`, stored 184.6 → 172.3 in `165–185`, `71.8` in `60–100`). But an
   adversarial sweep of narrow/far windows landed **outside** in 4 of 8
   (true 128 → `(240,250)` gave `234.9`; true 90 → `(170,172)` gave `172.3`;
   true 90 → `(200,220)` gave `198.8`; true 70 → `(240,250)` gave `234.9`), and
   the live check reproduced it on real audio (`240–250` → `234.9` for a 136 BPM
   track). ⇒ `bpm_fit` is a genuinely reachable branch and the "kept the old
   value" path is not dead code. The prior never changes the no-range answer
   (fact 2).
5. **The wrong `OOS-5` row is real and its ID is duplicated.**
   `docs/requirements/93_OUT_OF_SCOPE.md:14` and `:15` both carried `OOS-5`; the
   waveform/beat-detection row is the wrong one and its text ("BPM is entered
   manually … not computed from audio") has been false since librosa shipped.
   At the probed rev. Fixed in this branch by renumbering to `OOS-12` and
   correcting the text — the requirements-doc task below owns it, so a reader
   following the plan cannot leave it stale.
6. **No frontend caller existed.** At the probed rev, `grep` for `analyze/` in `src/` finds nothing;
   the only trigger is the library-wide button (`src/pages/LoadFiles.tsx:378`).
   `storage.ts` has **no** analyze method at all (`StorageInterface`,
   `src/lib/storage.ts:152-207`).
7. **The dialogs are parent-controlled and get focus-return for free.**
   `EditSongDialog` / `LyricsDialog` take `{ song, open, onOpenChange, … }`;
   `DialogContent` injects `useReturnFocus` itself (`src/components/ui/dialog.tsx:39-45`).
8. **BPM in the table has no component** — a raw `TextCell` with `checkBpm` /
   `parseBpm` and `BPM_RANGE = {min:40, max:250}` (`src/lib/trackFormat.ts:33-43`,
   `src/components/dj/SongTableRow.tsx:168-185`). The detail page shows BPM/key
   as **read-only** `<Spec>` cells (`src/pages/SongDetailPage.tsx:169-179`).
9. **`scipy` is already a hard dependency** of librosa (imported here for the
   log-normal prior), so no new dependency is added.

## Decisions (frozen; the issue's open questions)

- **How the range constrains the estimate — a bounded prior, not a filter.**
  `prior` = log-normal with median `sqrt(min·max)` and `σ = ln(max/min)/4`
  (≈ ±2σ spans the window), so the autocorrelation is biased toward the window
  without a hard cut. It is passed to **`beat_track`**, which already accepts
  it — *not* to `feature.tempo`, whose different onset aggregation moves the
  answer on real audio (fact 2). Verified in fact 4, including that it is a
  bias and not a guarantee — hence the `bpm_fit` branch below.
- **A window an octave wide or more is "no constraint", so it behaves as no
  hint.** The prior's strength grows with the window width, so a wide window
  over-steers: centred at the geometric mean of 40–250 (= 100 BPM), it dragged a
  correct 136 to 92.3 and a correct 143.6 to 71.8 — all *in* window, so silently
  written. A window that cannot disambiguate octaves (the one thing the hint is
  for) is dropped (`_bpm_prior` returns `None`), which makes the dialog's own
  placeholder range 40–250 a no-op; verified 0 of 14 real tracks change.
  `min ≥ max` is also dropped there rather than built, since a zero-width
  log-normal is all-NaN and poisons the tempogram silently.
- **`bpm <= 0` is a failed detection, not a tempo.** `beat_track` answers `0.0`
  when the onset envelope has no onsets at all (silence, a beatless pad, a
  reverb-only intro), so `analyze_track` maps it to `None`. Otherwise a run
  would write `0` BPM — outside the 40–250 the app allows, rendered as `–` in
  the table, and never revisited by the batch job, which only fills `bpm is
  None`.
- **A range that cannot be satisfied is reported, never hidden.** The response
  carries `bpm_fit: bool` (`min ≤ bpm ≤ max`). When it is `False` the detected
  BPM is **not written** — the stored value stays, and the popup says so.
  Rationale: every alternative is a silent lie (facts 3 and 4). "Refuse to
  change, tell the user why" is the only honest option, and it is also the only
  one that keeps a wrong number from being replaced by a no-fitter.
- **Scope: BPM and key in one popup.** Key is free — the same call already
  computes it and it does not depend on the tempo prior. It is written on every
  successful analysis, range or not.
- **Entry point: the song detail page only.** One entry point satisfies the
  repair need; the detail page already has the header action row
  (Play/Edit/Relationships) and the read-only BPM/key `<Spec>` cells that this
  repairs. A second action in the table's 52 px row cluster would crowd
  Play+Edit. `SongDetailPage` is therefore where the popup hangs. (The table
  entry point stays a deliberate follow-up, not an oversight.)
- **Concurrency: the per-track run takes the batch lock.** `_analyze_lock` is
  acquired non-blocking; if a library-wide job is running the route returns
  `409`, and the batch route keeps refusing to start while a per-track run
  holds it. One analysis at a time, as REQ-10-AP already requires — just
  enforced in both directions now.
- **Manually typed BPM: no extra confirm beyond the popup.** Opening the popup
  and pressing Re-analyze is a deliberate, informed action; the popup shows the
  current value before the run and before/after after it. A second modal
  question on top of that is bureaucracy.
- **Writes land immediately on a successful analysis.** There is no
  preview/apply round-trip: the popup shows what changed (before → after) and
  the library refreshes. Cancel semantics would be a lie (the backend already
  wrote), so there is no Cancel button — only Close.
- **`bpm_fit` is transient.** It is not a song field, not persisted, and not in
  the Pydantic model — so there is no data-model change and no migration.

## Changes (files in order)

### Backend

- `backend/scanner/audio_analysis.py`
  - `analyze_track(file_path, duration_seconds=120.0, bpm_range: tuple[float, float] | None = None)`.
  - Tempo: `prior = _bpm_prior(*bpm_range) if bpm_range else None`, then
    `tempo, _ = librosa.beat.beat_track(y=y, sr=sr, prior=prior)` — the *same*
    call as today plus a prior, so `prior is None` is bit-identical (fact 2) —
    and `bpm = round(float(np.asarray(tempo).item()), 1)` as today (`round()`
    alone would raise on the array `beat_track` returns).
  - `_bpm_prior(lo, hi)` — the log-normal from the decision above, with a clear
    docstring saying *why* a prior and not a filter (fact 3), so nobody
    "simplifies" it back into a candidate filter.
  - Return adds `"bpm_fit": bool` — `True` when no range, else `lo ≤ bpm ≤ hi`;
    `False` when `bpm is None`.
  - `analyze_all_missing_bpm` calls `analyze_track(file_path)` unchanged (no
    range) — the batch path must stay "only fill missing".
- `backend/api/library.py`
  - `class ReanalyzeRequest(BaseModel)`: `bpm_min: float | None = None`,
    `bpm_max: float | None = None`.
  - `POST /analyze/{song_id}` gains an optional body. The route's own checks
    are `422` with a one-line string `detail`: one bound without the other;
    `min ≥ max`; either bound outside `40..250` (the app's `BPM_RANGE`). A
    *non-numeric* bound is rejected by Pydantic first and yields `detail` as a
    **list**, which `describeApiError` ignores — so the browser copy comes out
    as raw JSON there. Accepted, because the dialog validates with
    `Number.isFinite` before the request and the user cannot reach it; noted so
    nobody assumes every 422 reads nicely.
  - Serialisation needs **two** guards, because the batch job releases
    `_analyze_lock` the moment it has spawned its thread: an in-flight batch is
    visible only through `_analyze_state["running"]`, while an in-flight
    per-track run is visible only through the lock (it never sets `running`).
    So the route does `_analyze_lock.acquire(blocking=False)` → `409 "An
    analysis is already running"`, then checks `running` under it, and releases
    in `finally`. The batch route acquires non-blocking the same way and keeps
    its own `running` check. Both refuse rather than wait — a plain `with`
    blocks the caller silently for 3–5 s, and during a batch run only the
    `running` check stops the per-track route (verified live: without it, a
    per-track run slipped in mid-batch).
  - Write: `bpm`/`musical_key` as today **except** `bpm` is skipped when
    `bpm_fit is False`. `duration` unchanged (only when `None`). The song is
    re-read under the lock, because a 3–5 s run is long enough for an inline
    edit and `changed` must compare against what the song holds now.
  - Response: `{song_id, bpm, musical_key, duration, bpm_fit, applied}` where
    `applied` holds only the fields that **changed** — so the popup can say a
    run changed nothing without re-deriving it from a stale copy. The popup
    names `applied.musical_key` in the out-of-range branch too: the key is
    re-detected regardless of the BPM hint, and leaving it unmentioned would be
    exactly the silent overwrite INV-13 forbids.

### Frontend

- `src/lib/storage.ts` — `ReanalyzeResult` type and
  `reanalyzeSong(songId, range?: {min: number; max: number}): Promise<ReanalyzeResult>`
  on `StorageInterface` + `RemoteStorageImpl` (`api.post('/library/analyze/' + id, range)`);
  `LocalStorageImpl` throws a named "needs the Klangkurator backend" error —
  audio analysis does not exist in the browser-dev fallback and a silent no-op
  would be worse.
- `src/components/dj/ReanalyzeDialog.tsx` (new) — `{ song, open, onOpenChange, onSave }`.
  Shows the stored BPM/key, two optional BPM bound inputs (empty = no hint,
  placeholders from `BPM_RANGE`), a Re-analyze button with a pending state
  (`aria-busy`, disabled while running), then the result as **before → after**
  per field. The before values are captured when the run starts, because
  `onSave` refreshes `song` and the live value would otherwise already be the
  after one. Three distinct results: nothing detected, out-of-range (stored BPM
  kept), or saved/no-change. When `bpm_fit` is `False`: a warning line naming the detector's answer
  and saying the stored BPM was kept. Errors surface through `describeApiError`
  in a destructive toast (the `LoadFiles`/`Settings` precedent).
- `src/pages/SongDetailPage.tsx` — a `Re-analyze` button in the header action
  row (after Edit), owning `reanalyzeOpen`; renders the dialog; on a successful
  run refreshes the song so the `<Spec>` cells show the new values.
- `docs/plans/00_Index.md`, `backend/tests/00_Index.md`,
  `src/components/dj/00_Index.md` and `src/lib/00_Index.md` — the folder-index
  convention (`folder-index` skill) requires a row for each new artifact.

### Requirements docs (spec-first, same change)

Per `AGENTS.md` ("Behavior changes go through the spec before the code; update
the matching file and `99_CHANGELOG.md` in the same change"):

- `10_LIBRARY_AND_FILE_LOADING.md` — new **REQ-10-RA** section.
- `91_INVARIANTS.md` — new **INV-13** (analysis never overwrites a human-set
  value silently).
- `92_PLANNED_FEATURES.md` — new **PF-79** row.
- `93_OUT_OF_SCOPE.md` — the wrong OOS-5 row renumbered to **OOS-12** and
  corrected (fact 5 below).
- `99_CHANGELOG.md` — the dated entry.
- `11_SONG_MODEL.md`, `90_NFRS.md` — checked, no change required.

### Not changing (deliberate)

- `SongLibrary.tsx` / `SongTableRow.tsx` — no table entry point (decision
  above), no new column, no `COLUMN_DEFINITIONS` change.
- `backend/models/song.py` — `bpm_fit` is transient; no field, no migration.
- `analyze_all_missing_bpm` write policy — the batch job keeps skipping
  existing values (INV-5).
- `LoadFiles.tsx` — the library-wide button and its progress poll are untouched.

## Data flow trace

`ReanalyzeDialog` → `storage.reanalyzeSong(id, {min,max})` →
`POST /api/library/analyze/{id}` with `{bpm_min, bpm_max}` →
`analyze_track(path, bpm_range=(min,max))` → `{bpm, musical_key, duration, bpm_fit}`
→ route writes the patch through `store.update_song` → response
`{…, applied}` → the dialog renders before/after → `onSave` → the detail page
refetches the song → the `<Spec>` cells show the new BPM/key. The table, when
open, is not in this path; the detail page refetch is authoritative, and
`storage.updateSong`'s `updated_at` moves as usual.

## Algorithm contract (BPM range)

- **Inclusion predicate:** with a range, the estimate is the mode of the
  tempo autocorrelation biased by the bounded prior; `bpm_fit := (bpm_min ≤
  bpm ≤ bpm_max)`. Without a range, `bpm_fit := True`.
- **Worked example (probed):** true 174 BPM, no range → `117.5` (octave
  mis-read); the same file with range `(165, 185)` → `172.3`, `bpm_fit: true`,
  written. Same file with range `(60, 100)` → `69.8` — which *is* in-window and
  lands there by design (a genuine sub-multiple of 174): `bpm_fit: true`, and
  the user's range was honoured.
- **Boundary:** range `(200, 220)` on the true-128 file → `215.3`,
  `bpm_fit: true`, written: the prior wins inside its own window. The user sees
  before → after and can correct it; nothing is hidden.
- **Out-of-window:** the prior is a bias, not a wall. Probed out-of-window
  landings: true 90 with range `(170,172)` → `172.3`; true 90 with `(200,220)`
  → `198.8`; true 128 with `(240,250)` → `234.9`. Those are reported as
  `bpm_fit: false`, the stored BPM is left untouched, and the popup names the
  detector's answer.

## Interaction & presentation semantics

- Range bound inputs: optional, both-or-neither, `40 ≤ min < max ≤ 250`; the
  error text names the rule ("Both bounds are needed", "The low bound must be
  below the high bound").
- The Re-analyze button is disabled while the run is pending and while another
  analysis is running (a `409` surfaces as "An analysis is already running").
- The dialog always shows the stored BPM/key it is about to change, and after
  the run shows the old and new value side by side; a field that did not change
  is not dressed up as one.
- Close only — no Cancel, because the write already happened. Copy says so.

## Testing

`backend/tests/test_reanalyze.py` (module docstring states the claim; module-level
`TestClient(app)`; throwaway `HOME` from `conftest.py`), mirroring
`test_analysis_keeps_edits.py` for the monkeypatch style:

1. re-analyze **overwrites** an existing BPM/key where the batch job would skip;
2. the range reaches the engine — a monkeypatched `analyze_track` asserts it was
   called with `(lo, hi)`;
3. a range steers a real signal: a synthetic click track whose no-range answer
   is wrong gets the right answer inside its range (the probed case, asserted);
4. `bpm_fit is False` ⇒ the stored BPM is unchanged and the response says why;
5. `409` while a batch job is running; and a per-track run blocks a batch start;
6. `422` for one bound only, `min ≥ max`, and a bound outside `40..250`;
7. `404` for an unknown song and for a missing file;
8. `analyze_all_missing_bpm` still skips existing values (regression guard for
   INV-5 after the signature change).

## Gates before the PR

- `npx tsc --noEmit -p tsconfig.app.json` — no new errors.
- `python -m pytest backend/tests` — green (`/home/tim/Vault/.venv/bin/python`).
- `npx eslint <changed files>` — no new problems.
- `npx vite build` — passes.
- Live check of the detail page and the popup in both themes at 1440, 1280,
  768 and 375 px, against the sandbox backend on :8001, never the real library.
