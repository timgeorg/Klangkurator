---
source: auto
tags:
  - index
---
# Index — backend/api

- [[__init__.py]] — APIRouter aggregation; includes all sub-routers into one root router.
- [[audio.py]] — `GET /api/audio/{song_id}`: streams a song's library-tracked file via FileResponse (mime-guessed, Range-capable, inline); `GET /api/audio/waveform/{song_id}`: persisted peak envelope with lazy recompute (PF-13).
- [[artwork.py]] — `GET /api/artwork/{song_id}`: serves the extracted cover thumbnail from `~/.klangkurator/artwork/` with 1-day cache headers; 404 when absent (PF-14).
- [[blocks.py]] — Blocks/sets-of-songs grouping CRUD endpoints.
- [[library.py]] — Library-wide endpoints (rescan, stats, library file access); scan computes waveform peaks at import time (PF-13).
- [[misc.py]] — Miscellaneous endpoints (health, config, system info).
- [[relationships.py]] — Song-to-song relationship/transition CRUD endpoints.
- [[sets.py]] — DJ set CRUD and set-song membership endpoints.
- [[songs.py]] — Songs CRUD plus song-tag, related, transition-suggestions, playlist sub-resources.
- [[tags.py]] — Tag CRUD and tag-song listing endpoints.