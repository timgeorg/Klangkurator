---
source: auto
tags:
  - index
---
# Index — backend/tests

- [[conftest.py]] — Points HOME at a throwaway folder before the backend is imported, so tests never touch the real library.
- [[test_song_update.py]] — Partial song updates: an explicit null clears an optional field, omitted fields stay, required and list fields can't be blanked.
- [[test_rank.py]] — The per-track rank (issue #4): create round-trips, PUT sets it, and a song without a rank reads back as 0.
