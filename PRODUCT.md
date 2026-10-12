# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

A React app served by a local FastAPI backend. It runs in a PyWebView desktop window (`./run.sh desktop`, 1400×900 default, 1000×600 minimum; the engine is the platform default, so WebKitGTK on Linux rather than Chromium) and in any modern browser (`./run.sh`, `./run.sh server`). Desktop and browser are the job. Phone and tablet widths must not break, but they get no designed mobile experience in this round (confirmed 2026-10-07).

## Users

Primary user: the author, Tim, a DJ (house and techno, sunset sets for friends) who curates his own collection and prepares sets at home, before the gig. Today the tool runs against his real library (92 tracks).

Later: other DJs with 1,000–5,000 tracks in folders who use Rekordbox to perform, plan sets from playlists and memory today, write notes per track so they never re-listen before a gig, think in set phases, and want everything offline. A public release is plausible, so the app should feel like a real product, not a personal script (confirmed 2026-10-07: "me first, others later").

## Product Purpose

Knowledge management for DJs. Klangkurator turns a folder of music into a curated library: import a root folder (subfolders become crates), see real waveforms and covers, filter a dense table, preview tracks, write notes, tag and rate, relate tracks to each other, and assemble reusable blocks and full sets. It handles the thinking that happens before the DJ opens Rekordbox. Success means arriving at the gig with the set already reasoned through and nothing left to re-listen to.

## Positioning

The layer above Rekordbox, never a replacement: Rekordbox stays the playback and performance engine (cues, USB, CDJs); Klangkurator owns organization, annotation, transitions and set planning. Inspired by Lexicon but focused on deep organization rather than library sync. Fully local: plain JSON files the DJ can read, diff and back up; no cloud, no login, no subscription.

## Operating Context

- Runs on the DJ's own machine: `./run.sh` (dev: Vite :8080 + API :8000), `./run.sh server` (one port), `./run.sh desktop` (PyWebView window).
- Data lives in `~/.klangkurator/` (`library.json`, `blocks.json`, `sets.json`, `artwork/`).
- Workflow: pick the root folder, scan it, optionally run BPM/key analysis, browse and filter the library table, preview-play one track at a time, edit metadata, notes, tags and relationships on the song, then build blocks and sets.
- Offline is a hard requirement: fonts, textures and every asset ship with the app.

## Capabilities and Constraints

- Built views: Library table (18 configurable columns, per-column filters, resize, drag reorder, persisted layout, inline notes and tags), Song detail, Edit Song / Lyrics / Relationships dialogs (list and canvas graph), Sets and Blocks (cards and editors), Load Files (root folder, scan, background analysis progress, crates), Settings (tags, genres and subgenres), a single-track preview player, 404.
- Not a player (principle P7): preview only, no queue, decks or mixing.
- Scale: the table must stay comfortable at 1,000–5,000 tracks (NFR-3); notes editing stays inline and fast (NFR-11).
- Terminology: root folder, crate, track/song, main genre, subgenre, tag, energy / danceability / social acceptance (0–5), block, set, set phase, transition, relationship (remix, cover, mashup, edit, bootleg, same sample, in playlist, transition).
- Data limits: cover thumbnails are at most 300 px; there is no record-label field; keys arrive in short notation (Am, C#); genre and tag colors are user data stored as hex.
- Spec'd but not built (backlog, not this round): phase-based set planner with arc review, playlists, transition library, Settings backup/export and preferences, Rekordbox and AI surfaces, home/analytics/collections views shown on the moodboard.

## Brand Commitments

- Name: **Klangkurator**. Legacy names in the UI ("DJ Database", "Local Music Library") are retired.
- Binding visual reference: the user's moodboard (2026-10-07), "editorial magazine look mit shapes & layouts und texturen und keine Rauheit" (editorial magazine look with shapes, layouts and textures, and no roughness).
- The moodboard's taglines are placeholders, not approved copy. App copy stays factual and task-focused (confirmed 2026-10-07).
- UI language: English.
- The design system must be reusable for a future Klangkurator website and for future views such as a set canvas.

## Evidence on Hand

- The author's real library: 92 tracks with covers, BPM, key, year, duration and waveforms for all; ratings, tags, notes, relationships, blocks and sets are still empty.
- README feature list and the requirements tree in `docs/requirements/`.
- No testimonials, users, benchmarks or press exist. Never fabricate them.

## Product Principles

1. Everything local, everything readable.
2. Notes are the core asset; capturing them must be fast and frictionless.
3. Structure follows the DJ's mental model: folders, crates, blocks, sets.
4. Curation before playback; Klangkurator never tries to be a player.
5. The DJ decides; analysis and AI only propose.

## Accessibility & Inclusion

No product-specific requirement is documented. Baseline: WCAG 2.2 AA contrast, visible focus, full keyboard reach for every action (no hover-only controls), labelled icon buttons, reduced-motion respect.
