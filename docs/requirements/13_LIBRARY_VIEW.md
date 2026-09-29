# Library View

Status: Active
Last Updated: 2026-09-24
Source: Requirements.md sections 4, 8

## Overview

The library is the central hub. Sidebar contains: **Library**, **Playlists**,
**Sets**, **Settings**. Search/Tags/Relationships pages were removed — the
table handles all of it.

## Empty-Library Redirect

- Opening the Library view with **zero songs** auto-redirects to the Load
  Files page (the import entry point) — an empty table is a dead end, so
  the app routes the user to where loading actually happens
- Load Files shows the already-configured root folder (if any) and the
  picker/scan actions; no redirect once the library has ≥ 1 song

## Table Layout

- Flat, **dense, multi-column database table** — Lexicon-inspired dark theme
  with orange/red accents
- Each track is a single flat row, all metadata in adjacent columns, left-aligned
- Static SVG waveform per row (thin closely-packed vertical bars, not animated)
- Play button appears on hover

## Columns

| Column | Type | Notes |
|---|---|---|
| Play/Edit | action | Play button on hover, pencil for edit |
| Preview | waveform | Static SVG bars |
| Title | text | Click opens Relationships dialog |
| Artist | text | |
| Album | text | |
| Root Folder | text | Derived from file path |
| BPM | number | Color-coded badge |
| Key | text | Key indicator |
| Main Genre | badge | |
| Subgenres | badges | Outlined, colored after main genre |
| Energy | rating (0–5) | Dots |
| Dance | rating (0–5) | Dots |
| Social | rating (0–5) | Dots |
| Duration | time | mm:ss (minutes unpadded) |
| Tags | badges | Side-by-side, auto-grow |
| Lyrics | preview | First ~30 chars, click to open full |
| Notes | text | Flex-fills remaining width, inline-editable |

## Column Controls

- **Resize**: drag right edge of header
- **Show/Hide**: column visibility toggles in Column Settings dialog
- **Reorder**: drag-and-drop inside Column Settings dialog
- **Auto-grow**: Tags column auto-widens when more tags added
- Sensible min/default widths so rating columns aren't squished

## Filtering

Per-column filter popovers (generous size, wider/taller multiselect):

| Column | Filter Type |
|---|---|
| Title, Artist, Album | Text search |
| BPM, Energy, Dance, Social, Duration | Range (empty defaults — no auto-applied 0–200) |
| Main Genre, Subgenres, Key, Tags, Root Folder | Multi-select |

Additional filters for set planning:
- **Phase Tags** — multi-select (`opening`, `building`, `sunset`, `peak`, `closing`)
- **Vibe Tags** — multi-select (`dark`, `uplifting`, `tearjerker`, `banger`, etc.)

## Inline Interaction

- Notes field: click → edit → Enter/blur to save (no dialog)
- Clicking song title → opens Relationships dialog
- Pencil icon (row hover) → opens Edit Song dialog