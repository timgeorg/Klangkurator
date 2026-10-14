# Out Of Scope

Status: Active
Last Updated: 2026-10-14

## Explicit Non-Goals

| ID | Non-Goal | Rationale |
|---|---|---|
| OOS-1 | Cloud sync | DJ crates are personal and local; cloud adds complexity and privacy concerns |
| OOS-2 | User accounts / authentication | Single-user local app — no need |
| OOS-3 | Supabase or any external database | JSON files are sufficient for 1,000–5,000 songs |
| OOS-4 | DJ mixing / performance playback | This is a library and curation tool, not a DJ controller — no decks, no crossfader, no mixing or beat-matching. Playing tracks to curate them (preview, stepping through a set, a block or the library) is in scope (P7, PF-80); performing them is Rekordbox's job |
| OOS-5 | Replacing Rekordbox | Klangkurator complements Rekordbox, it does not replace it. Rekordbox stays the core of playing (cue points, USB export, CDJ/XDJ performance) |
| OOS-12 | Waveform analysis / beat detection | No waveform/beat-grid analysis for playback or visualisation — Klangkurator has no decks and stores no beat grid. *Corrected 2026-10-14:* BPM **is** computed from the audio (librosa ships, PF-79); the old text here claimed it was "entered manually or extracted from file metadata", which had been false since the analyser landed. This row is about beat-grid/waveform analysis, which stays out |
| OOS-11 | Loose single-file import ("load audio files by themselves") | The root folder is the unit of import; a library is built from folders, never from individually picked files — file-level picking in the UI is explicitly not an import mode |
| OOS-6 | Music streaming integration (Spotify, SoundCloud, Apple Music) | The tool manages local files; streaming is a different product |
| OOS-7 | Mobile app | Desktop-first; mobile DJ prep is a different use case |
| OOS-8 | Multi-user collaboration | Single-user; sets can be exported/imported for sharing but not edited collaboratively |
| OOS-9 | Cloud-based AI processing | Any AI/spectral analysis runs locally (local models, local inference) — no audio or track data sent to cloud APIs |
| OOS-10 | Mobile audio playback | Mobile companion is for browsing and set planning only — no audio files on device, no playback. Metadata and notes only |