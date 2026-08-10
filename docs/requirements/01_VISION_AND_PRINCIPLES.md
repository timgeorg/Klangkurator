# Vision And Principles

Status: Active
Last Updated: 2026-08-09
Source: Requirements.md sections 1, 14

## Vision

Klangkurator is a fully local, single-user DJ music organization, curation,
and set planning tool. It adds **super-extended curation capabilities** on top
of a DJ's existing workflow — not by replacing Rekordbox, but by complementing
it.

**Rekordbox stays the core of playing.** Klangkurator is the layer above:
organization, annotation, transition mining, set planning, and export back to
Rekordbox.

Each track is a rich, tagged, rated, related entity — searchable, filterable,
and arrangeable into reusable mix blocks and full DJ sets. Transitions between
tracks are first-class entities, mined from the DJ's own library and existing
mixes.

The core insights:
1. **A DJ set is not a playlist. It has a temporal arc** — opening, building,
   peak, closing — and the tool must support planning that arc, not just
   ordering tracks.
2. **Transitions are the DJ's craft.** The tool must help mine, store, and
   surface transitions — not just "track A goes after track B" but *how*
   they connect, at what point, with what technique.
3. **Curation > playback.** Rekordbox handles playback, cue points, USB
   export. Klangkurator handles the thinking that happens *before* you open
   Rekordbox.

### Target User

A DJ who:
- Has 1,000–5,000 tracks organized in folders by genre/vibe
- Uses Rekordbox as their primary performance tool (CDJ/XDJ/USB)
- Currently relies on SoundCloud playlists + memory to plan sets
- Wants to write notes about each track so they don't have to re-listen
- Thinks in phases (opening, sunset, peak, closing) when building a set
- Wants to discover and catalog transitions between tracks
- Needs the tool fully offline — no cloud, no login, no subscription

### Inspiration

- [lexicondj.com](https://www.lexicondj.com/) — but more organization-focused,
  with set planning and transition mining as first-class features.
- Rekordbox — for playback, cue points, and USB export. Klangkurator reads
  from and writes to Rekordbox, but does not replace it.
- AI-assisted curation — future: spectral analysis, AI transition suggestions,
  AI set planning workflows.

## Design Principles

| ID | Principle | Rationale |
|---|---|---|
| P1 | Everything local, nothing cloud | DJ crates are personal; no track data or metadata leaves the machine |
| P2 | Notes are the core asset | The value is in the DJ's written knowledge of each track — the tool must make note-taking fast and frictionless |
| P3 | Structure follows the DJ's mental model | Folders → crates → blocks → sets mirrors how DJs actually think; the tool matches that, not the other way around |
| P4 | Set planning is phase-based, not flat | A set has temporal arcs (energy, mood, genre); the tool must support planning by phase, not just drag-and-drop ordering |
| P5 | Explicit over automatic | Track analysis (BPM detection, key detection) is user-triggered or imported, not auto-guessed silently |
| P6 | Graceful degradation | Without PyWebView/Python backend, the web app still works with localStorage; without audio metadata extraction, manual entry works |
| P7 | Rekordbox is the playback engine, not the competitor | Klangkurator reads from and writes to Rekordbox (cue points, playlists); it never tries to be a player |
| P8 | Transitions are first-class entities | Transitions between tracks are mined, stored, rated, and surfaced — they are the DJ's craft knowledge, not an afterthought |
| P9 | AI augments curation, doesn't replace it | AI skills (transition suggestions, spectral clustering, set planning) propose options; the DJ always decides |