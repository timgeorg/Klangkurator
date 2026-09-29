---
source: auto
tags:
  - index
---
# Index — backend/scanner

- [[__init__.py]] — scanner package marker.
- [[audio_analysis.py]] — librosa-based BPM and key detection (track analyzer + batch worker with progress callback).
- [[artwork.py]] — `extract_artwork()`: embedded cover art via mutagen (APIC/FLAC pictures/covr), re-encoded to a ≤300px JPEG q80 thumbnail in `~/.klangkurator/artwork/` at scan/backfill time (PF-14).
- [[file_scanner.py]] — filesystem walking helpers for the library scan.
- [[metadata.py]] — mutagen-based metadata extraction (title, artist, album, year, BPM, key, duration, genre) with fallbacks.
- [[waveform.py]] — `compute_peaks()`: 200-bucket peak envelope via soundfile raw read (librosa fallback), computed at scan time and persisted as `waveform_peaks` (PF-13).