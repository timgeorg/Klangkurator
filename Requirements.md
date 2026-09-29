# DJ Database System — Requirements & Masterplan

A comprehensive, locally-hosted DJ music organization tool inspired by Lexicon DJ but focused on **deep organization, tagging, knowledge-graph relationships, and set planning**. Designed to eventually run as a desktop application via **PyWebView** with a JSON-file backend.

This document is the master spec, consolidated from every requirement raised in the project chat.

---

## 1. Vision & Purpose

Replace Windows Explorer/folder-based music management with a **personal knowledge management system for DJs**. Each track is a rich, tagged, rated, related entity — searchable, filterable, and arrangeable into reusable mix blocks and full DJ sets.

Inspiration: [lexicondj.com](https://www.lexicondj.com/) — but more organization-focused.

---

## 2. Platform & Architecture

### 2.1 Runtime
- **Phase 1 (current)**: Web app (React + Vite + TypeScript + Tailwind + shadcn/ui), browser `localStorage` persistence.
- **Phase 2 (target)**: **Local desktop app via PyWebView** with a Python backend; no cloud, no login, no Supabase.

### 2.2 Data Service Abstraction
Two interchangeable services behind a common interface:
- `MockupDataService` — dev mode, ships rich sample tracks/tags/relationships, idempotent upserts (stable IDs).
- `LocalDataService` — minimal first-run seed for desktop users.
- `DataServiceFactory` selects per environment.

### 2.3 Python/PyWebView Backend (Phase 2)
Three JSON files loaded fully at startup (chosen over per-song files; ~1000–5000 songs fits easily in memory):
```
library/
├── library.json   # all songs, tags, relationships
├── blocks.json    # all blocks
└── sets.json      # all sets
```
Backend exposes CRUD via `window.pywebview.api`.

### 2.4 Data Integrity Rules
- Song/tag IDs are assigned **once on first creation** and never regenerated.
- Mockup initialization is **idempotent**: upsert by natural key (artist + title), never wipe.
- `clearData()` must clear *all* dependent stores (songs, tags, relationships, playlists) to avoid stale references.

---

## 3. Song Model

Each song stores:
- **Identity**: id, title, artist, album, year, duration, file_path, artwork_url
- **Musical**: bpm, musical_key
- **Genre hierarchy**: one `mainGenre` (House, Techno, Trance, …) + multiple `subgenres` (Groove, Minimal, Deep Tech, Bouncy, Schranz, …). Legacy `genre`/`genres` fields retained for backward compatibility.
- **DJ ratings (0–5)**: danceability, energy, social_acceptance
- **Sound notes (free text)**: drum_notes, element_notes, mixing_notes — describe how the drums/elements sound so the DJ doesn't have to re-listen before mixing.
- **Lyrics**: long-form text, hidden from the table, edited via dedicated dialog.
- **Tags**: many-to-many to centralized Tag objects.
- **Root folder**: derived from `file_path` (folder name inside the library root).
- **Timestamps**: created_at, updated_at.

---

## 4. Library View (Home Screen)

The library is the central hub — everything is managed from here. The sidebar contains only **Library**, **Playlists**, **Sets**, **Settings** (Search/Tags/Relationships pages were removed; the table handles all of it).

### 4.1 Table Layout
- Flat, **dense, multi-column database table** — Lexicon-inspired dark theme with orange/red accents.
- Each track is a single flat row, all metadata in adjacent columns, left-aligned.
- Static SVG waveform image per row (thin closely-packed vertical bars, not animated).
- Play button appears on hover.

### 4.2 Columns
Play/Edit, Preview (waveform), Title, Artist, Album, **Root Folder**, BPM, Key, Main Genre, **Subgenres**, Energy, Danceability ("Dance"), Social, Duration, **Tags**, **Lyrics** (preview), Notes (flex-fills remaining width).

### 4.3 Column Controls
- **Resize**: every column resizable by dragging the right edge of its header.
- **Show/Hide**: column visibility toggles in a Column Settings dialog.
- **Reorder**: drag-and-drop reorder inside the same dialog.
- **Auto-grow**: Tags column auto-widens when more tags added (until user manually resizes).
- Sensible min/default widths so rating columns aren't squished.

### 4.4 Filtering
Per-column filter popovers, sized generously (wider, taller multiselect):
- **Text**: Title, Artist, Album
- **Range**: BPM, Energy, Danceability, Social, Duration
- **Multi-select**: Main Genre, Subgenres, Key, Tags, Root Folder
- Range filters must use empty defaults (no auto-applied 0–200 that hides everything).

### 4.5 Inline Interaction
- Notes field is inline-editable (click → edit → Enter/blur to save).
- Clicking a song title opens the **Relationships dialog**.
- Pencil icon (on row hover) opens the **Edit Song dialog**.

---

## 5. Tags

- Centralized **Tag entities** (id, name, color). Reused across songs — never duplicated.
- Creating a new tag in the selector immediately syncs everywhere (no stale filter options).
- DJ-focused vocabulary by default: *Piano, Strings, Synth Lead, Acid, Arp, Sing-Along, Vocal Chops, Female/Male Vocal, Minimal Drop, Big Room Drop, Peak Time, Warm Up, Closer, Dark, Uplifting, Long Intro, Long Outro, Acapella Section, Clean Mix Point, …*
- Multiple tags on one row display side-by-side (no stacking/wrapping issues).

---

## 6. Genres

- **Main genre + subgenres** model (single main, many sub).
- Predefined examples: House → Groove/Minimal/Deep Tech; Techno → Bouncy/Schranz; etc.
- Fully user-editable via Settings — **no "Reset to Defaults" button**.
- Subgenres displayed as separate column of outlined badges colored after the main genre.

---

## 7. Relationships (Knowledge Graph)

### 7.1 Relationship Types
`remix`, `same_sample`, `cover`, `mashup`, `edit`, `bootleg`, `in_playlist`, `transition`.

### 7.2 Unified Relationships Dialog
One component used from both: (a) clicking a song title, (b) the Edit Song dialog.
- **List view**: existing relationships with delete, inline add form, searchable Combobox for picking the target song.
- **Graph view**: HTML canvas, nodes = songs, edges = color-coded by relationship type.
  - Center/base node always rendered in a neutral color.
  - Song titles visible by default (no hover required).
  - Clicking another node **navigates** — that song becomes the new center, canvas updates instantly (via `key` remount), with back-button history.
  - Dark background + subtle grid, gradient fills, glow, generous spacing so edge colors are readable.
- "In Playlists" section shows which playlists contain the song + position.

---

## 8. Edit Song Dialog

Edits all song properties: title, artist, album, BPM, key, year, main genre, subgenres, energy, danceability, social_acceptance, drum/element/mixing notes. Provides buttons to open the **Lyrics dialog** and **Relationships dialog**.

---

## 9. Playlists
Standard playlists with ordered song positions; smart-playlist scaffolding (`is_smart_playlist`, `search_criteria`) reserved for the future.

---

## 10. Blocks & Sets ("Sets" page)

### 10.1 Blocks
- A **Block** = an ordered sequence of songs glued by transitions (a reusable mini-mix).
- Stored as first-class entities with name, description, color.
- Each block-song has a position and optional `transition_notes` (notes about the transition into the next song).
- Block editor: add/remove/reorder songs, edit transition notes.
- Block card preview: name, song count, total duration, song-chain preview.

### 10.2 Sets
- A **Set** = an ordered sequence of items, where each item is either a **song** or a **block**.
- Each item has `transition_notes` plus optional **alternative_transitions** (branching options to other songs/blocks).
- Set editor surfaces **transition suggestions** from existing `transition` relationships as quick-add buttons.
- Future: visual canvas (Fabric.js) where blocks are draggable nodes connected as a flowchart.

---

## 11. Settings Page

- **Tags management**: add / rename / edit color (20-color palette) / delete with confirmation.
- **Genres & Subgenres management**: add / rename / edit color / delete, collapsible per main genre. No reset button.

---

## 12. File Loading (Desktop)

- "Load Files" page to scan a local directory.
- Filename parsing extracts BPM/key when present.
- In PyWebView: actual audio-metadata extraction via Python (ID3/FLAC tags).

---

## 13. Design System

- Dark professional DJ theme; electric blue/purple originally, then refocused to **Lexicon-style dark + orange/red accents**.
- Compact, data-dense table aesthetic.
- Color-coded BPM badges, key indicators, energy/dance/social rating dots.

---

## 14. Non-Functional Requirements

- **No authentication**, **no cloud**, **no Supabase** — fully local.
- **Backup**: full JSON export/import of the entire library (songs, tags, song_tags, relationships, playlists, playlist_songs, blocks, sets).
- **Clean architecture**: small focused components (table split into `SongTableHeader`, `SongTableRow`, `useColumnConfig` hook, `ColumnSettingsDialog`, etc.); no dead code, no debug logs in committed code, memoized derived state, stable callbacks.
- **Idempotent seed data**; stable IDs across reloads.
- **Performance**: handle ~1000–5000 songs comfortably; memoize filter options; avoid render loops in filter popovers.

---

## 15. Playlist Sync & Library Reconciliation (Workflow)

Connects the DJ database to the user's **SoundCloud playlists** so the library
stays in sync with what they've collected online.

### 15.1 Core workflow
The intended end-to-end flow (as of 2026-09):

1. **Register a SoundCloud playlist** in Klangkurator (paste the playlist URL).
2. **Reconcile** — Klangkurator compares the online playlist against the local
   library and reports, per track, whether it is **already present** or **missing**.
   - Source: the Sonotheca `playlist_status.py` logic (SC API `resolve` +
     `tracks?ids=` batch; see `Repositories/Sonotheca/`).
3. **Import present tracks** into the library (or link them) so they become
   first-class Song entities.
4. **Downloadable missing tracks** → download via Sonotheca
   (`download_single.py` per track, or `playlist_downloader.py` per playlist).
5. Tracks that cannot be downloaded (DRM/premium/no alternative) are left as
   **pending / known-missing** and marked in the UI.

### 15.2 What the DJ does once tracks are imported
For every track in the library (whether from a playlist or not), Klangkurator
supports:
- **Tags** — DJ-centric many-to-many tags.
- **Annotations / notes** — drum notes, element notes, mixing notes (free text).
- **Search** — find tracks by title, artist, tag, note content, genre, BPM, key.
- Ratings, relationships, blocks/sets, etc. (the rest of this spec).

### 15.3 Reconciliation state
Each registered playlist track keeps a sync state so the user always sees what
they have vs. don't:
- `present` — matched to a local/imported song.
- `missing` — not in the local library.
- `blocked` — online-track not downloadable (DRM/premium/no alternative upload).
- `pending_download` — downloadable but not yet fetched.

The exact download/availability mechanics live in the **Sonotheca** repo
(`Repositories/Sonotheca/`); Klangkurator *consumes* those results (CSV/JSON) or
calls the same logic.

---

## 16. Open / Future Work

- Visual Fabric.js canvas editor for Sets (drag blocks, draw connections).
- BPM & key compatibility hints when building blocks/sets.
- Bulk-tag multiple selected songs.
- Persist column order/visibility/widths to `localStorage`.
- "Clear All Filters" button + keyboard shortcuts (Ctrl+F, Esc).
- Inline editing of subgenres in the table.
- Auto-size Subgenres column.
- Python PyWebView backend implementation against the 3-file JSON schema.
- Genre statistics view; genre sidebar filter.

---

*This document is the single source of truth for what the DJ Database System is and must do. Update it whenever scope changes.*
