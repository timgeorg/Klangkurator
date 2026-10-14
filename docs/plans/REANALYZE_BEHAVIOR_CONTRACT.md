# Behavior contract — per-track re-analyze with a BPM range hint (issue #6)

Written **before** implementation (Feature-Development-Playbook, task-type
cross-reference: user-facing behavior change → behavior contract, judged
source-blind by the Validator). Clauses are stated as observable
given/when/then against the running app, never as code.

## Fields in scope

BPM and musical key of **one** track, via a popup on the song detail page.
The BPM range is a hint, optional. The library-wide "Analyze BPM and key" job is
out of scope and must not change behavior.

## Clauses

### BC-1 — the repair path exists
**Given** a track in the library whose stored BPM is `117.5` while the record
really is 174 BPM
**when** the user opens the track's detail page
**then** a `Re-analyze` action is offered next to Play / Edit / Relationships,
and it opens a popup that names the track and shows the stored BPM and key.

### BC-2 — re-analysis overrides the "only fill missing" rule for one track
**Given** a track that already has a BPM and a key
**when** the user runs Re-analyze in the popup with no range
**then** the BPM and the key are re-detected and **both are written**, and the
detail page shows the new values after the run — unlike the library-wide job,
which skips any track that already has a BPM.

### BC-3 — the range steers the estimate
**Given** the same track as BC-1 (true 174 BPM, detected `117.5` with no range)
**when** the user enters the range `165` to `185` and runs Re-analyze
**then** the detected BPM lies inside `165…185` (the observed value was
`172.3`), it is written, and the popup's result line reads
`BPM 117.5 → 172.3, key <old> → <new> — saved.` — the before half comes from the
values captured when the run started, not from the row, which has already
refreshed.

### BC-4 — an unsatisfiable range is reported, never hidden
**Given** a track whose detector answer falls outside the range the user gave
(observed: true 90 BPM with the range `170…172` lands at `172.3`; true 90 with
`200…220` lands at `198.8`; true 128 with `240…250` lands at `234.9`)
**when** the run finishes
**then** the popup says `Detected <x> BPM, outside the range you gave. The
stored BPM is unchanged (<stored>).` and the stored BPM on the detail page is
exactly what it was before the run.

### BC-5 — key is repaired too, in the same run
**Given** a track whose key is wrong and whose BPM is right
**when** the user runs Re-analyze
**then** the key is re-detected and written in the same run — one popup, one
run, no second action for the key.

### BC-6 — a range that cannot be true is refused before running
**Given** the popup is open
**when** the user enters only one bound, or a low bound that is not below the
high bound, or a bound outside `40…250`
**then** the run does not start and the popup shows, verbatim, one of
`A BPM range needs both bounds. Leave both empty to re-analyze without one.`,
`The low bound must be below the high bound.`, or
`BPM bounds go from 40 to 250.` — and no analyze request is sent.

### BC-7 — never two analyses at once
**Given** the library-wide analysis job is running
**when** the user opens the popup and presses Re-analyze
**then** the run is refused with the message "An analysis is already running",
and the library-wide progress is unaffected.

**Given** a per-track run is in progress
**when** the user starts the library-wide job
**then** that job is refused too — the same one-at-a-time rule as REQ-10-AP.

### BC-8 — a run that changes nothing says so
**Given** a track whose stored BPM and key equal what the detector returns
**when** the run finishes
**then** the popup's result line ends `— the stored values were already
correct.` (not "saved."), and no field is presented as if it had been updated.

### BC-9 — the popup closes without pretending to undo
**Given** a completed run
**when** the user closes the popup
**then** the values that were written stay written, and there is no "Cancel"
that would imply the opposite. Closing returns focus to the action that opened
the popup.

### BC-10 — failures are named
**Given** a track whose audio file is gone, or a backend that is not running
**when** the user runs Re-analyze
**then** the popup reports which track could not be analyzed and why, the stored
values are untouched, and the popup stays open to retry.

### BC-11 — the library-wide job is unchanged
**Given** a library with some tracks missing BPM and some already set
**when** the user runs the library-wide "Analyze BPM and key"
**then** only the missing ones are analyzed and written; tracks that already
have a BPM keep it. Fixture for the "as before" half: a track stored at
`184.6` BPM must still read `184.6` BPM after a library-wide run, and the
detector must be the same one — `librosa.beat.beat_track` with no prior — not
`feature.tempo`, which agrees on click tracks but reads this real track as
`112.3`.

### BC-12 — a range the signal does support resolves inside it
**Given** a track whose true tempo is 128 BPM and the range `200…220`
**when** the run finishes
**then** the popup reads `BPM <old> → <x>, key … — saved.` with `<x>` inside
`200…220` (observed `215.3`): the hint is a bias, so the signal's own
double-time answer inside the window wins and is written. This is the
counterpart to BC-4, not a contradiction of it — the range steers, it does not
wall.

### BC-13 — a failed detection is not blamed on the range
**Given** a track whose tempo cannot be read at all (a silent or corrupt file)
**when** the user runs Re-analyze
**then** the popup says the tempo could not be detected and nothing was changed
— it does **not** claim the result fell outside the range, even though the
backend reports `bpm_fit: false` for both.

## Out of scope (this contract)

- An entry point in the library table row (deliberate follow-up).
- Preview / apply / revert of an analysed value — the write lands on success.
- Any change to `analyze_all_missing_bpm`'s "only fill missing" policy.
- Persisting the range or remembering the last range between runs.
