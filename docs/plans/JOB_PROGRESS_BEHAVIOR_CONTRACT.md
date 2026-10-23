# Behavior contract — scan and analysis progress (issue #46)

Written **before** implementation (Feature-Development-Playbook: user-facing
behavior change → behavior contract, judged source-blind by the Validator).
Spec: `docs/requirements/10_LIBRARY_AND_FILE_LOADING.md` REQ-10-SP, REQ-10-AP.
Run against the sandbox library, never the real one.

## Clauses (given / when / then)

### BC-1 — a scan starts at once and counts up
**Given** a folder with N audio files **when** I choose it on the Import page
**then** within 1 s a progress bar shows `0 / N`, and it counts up to `N / N`.

### BC-2 — the scan names what it is on
**Given** a scan runs **then** the Import page shows the current track's file
name and its crate.

### BC-3 — scan toast outside Import
**Given** a scan runs **when** I open the library page (or Sets, or the map)
**then** a toast shows the bar, `done / total` and the current track. **When**
I return to the Import page **then** the toast is gone and the page shows the
progress.

### BC-4 — closing the scan toast
**Given** the scan toast shows **when** I close it **then** it stays closed for
this scan on every page, and the Import page still shows the progress.

### BC-5 — the scan ends with a plain notice
**Given** a scan runs **when** it finishes while I am on another page **then** a
toast says "Scan finished" with no numbers, and the Import page shows no
summary when I open it. **When** it finishes while I am on the Import page
**then** the page shows added / skipped / errors.

### BC-6 — one job at a time
**Given** a scan or an analysis runs **then** on the Import page the folder
pick, Re-scan and Analyze buttons are disabled; **when** another job is started
through the API **then** it is refused with a message naming the running job.

### BC-7 — analysis progress and Abort on the Import page
**Given** M tracks without BPM **when** I press "Analyze BPM and key" **then**
the page shows `0 / M` counting up, the current title, and an Abort button.

### BC-8 — analysis toast outside Import
**Given** an analysis runs **when** I open another page **then** a toast shows
the bar, `done / total` songs, the current title and Abort. **When** I close it
**then** it stays closed for this run, and progress and Abort remain on the
Import page.

### BC-9 — Abort stops after the current track
**Given** an analysis runs **when** I press Abort **then** the progress reads
"Stopping after this track…" and Abort is disabled; within about 5 s a toast
says "Analysis stopped" with analyzed / updated / skipped. Tracks finished
before the stop keep their BPM and key; the rest have none.

### BC-10 — Abort during the last track
**Given** the analysis is on its last track **when** I press Abort **then** the
job ends normally and the toast says "Analysis complete".

### BC-11 — analysis summary
**When** an analysis finishes **then** a toast says "Analysis complete" with
analyzed / updated / skipped, and the Import page's "Last run" line shows the
same numbers.

### BC-12 — reload resumes
**Given** a job runs **when** I reload the page **then** within about 1 s its
progress is back (on the Import page, or as the toast elsewhere).

### BC-13 — the library refreshes
**When** a job ends **then** the library table shows the new tracks or the new
BPM/key without a manual reload.

### BC-14 — regular toasts don't evict the progress toast
**Given** a progress toast shows **when** another toast appears (e.g. after an
edit) **then** both are visible and the progress toast keeps updating.

### BC-15 — failures end visibly
**Given** a job fails mid-run **then** it ends with an error message and no
progress keeps spinning.

## Out of scope

Stopping a scan · numbers in the "Scan finished" notice · elapsed or remaining
time · progress after the desktop window was closed (the backend stops with it).
