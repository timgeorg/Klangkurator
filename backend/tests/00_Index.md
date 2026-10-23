---
source: auto
tags:
  - index
---
# Index — backend/tests

- [[conftest.py]] — Points HOME at a throwaway folder before the backend is imported, so tests never touch the real library.
- [[test_analysis_job.py]] — The library-wide analysis job (issue #46): `done` counts finished tracks (0 / N first, N / N last), a missing file still advances it, Abort with no job is a 409, Abort mid-run keeps the tracks done so far and stops the rest, Abort during the last track ends normally.
- [[test_analysis_keeps_edits.py]] — Batch analysis keeps a BPM or key set by hand while it runs (the table edits during long analyses).
- [[test_concurrent_writes.py]] — Concurrent saves keep library.json whole and hold every song's last write (the store's save lock).
- [[test_song_update.py]] — Partial song updates: an explicit null clears an optional field, omitted fields stay, required and list fields can't be blanked.
- [[test_rank.py]] — The per-track rank (issue #4): create round-trips, PUT sets it, and a song without a rank reads back as 0.
- [[test_decimal_energy.py]] — Decimal ratings (issue #7): fractional round-trips, rank stays int, legacy fractional JSON lists without 500.
- [[test_export_import.py]] — Export/import (issue #10): envelope, match precedence, fill/clobber, conflict resolutions, uuid protection, tag identity, other-store skip, wholesale-replace regression.
- [[test_reanalyze.py]] — Per-track re-analyze (issue #6): it overrides the "only fill missing" rule, the BPM range reaches the engine and steers it, an out-of-range result is reported and never written, one analysis at a time, malformed ranges are 422.
- [[test_scan_job.py]] — The folder scan job (issue #46): start returns at once with `{started, total}`, done counts 0 → N, a throwing file lands in errors and the job still finishes, an unexpected exception ends `running: false` with `error`, an empty folder is `total: 0`, and scan and analysis refuse each other with a 409.
