# Klangkurator Requirements Index

Status: Active
Last Updated: 2026-08-09 (v2 — Rekordbox integration, transition mining, AI roadmap)

## Purpose

This folder is the canonical product requirements source, split by domain to
reduce drift and improve navigability. It supersedes the monolithic
`Requirements.md` at the repo root (kept for historical reference).

## Core

- [01_VISION_AND_PRINCIPLES.md](01_VISION_AND_PRINCIPLES.md) — product vision, design principles, target user
- [02_SYSTEM_CONTEXT.md](02_SYSTEM_CONTEXT.md) — runtime architecture, data service abstraction, PyWebView plan
- [90_NFRS.md](90_NFRS.md) — non-functional requirements (performance, portability, backup)
- [91_INVARIANTS.md](91_INVARIANTS.md) — constraints and data-integrity invariants
- [92_PLANNED_FEATURES.md](92_PLANNED_FEATURES.md) — future work: Rekordbox integration, transition mining, AI-assisted curation
- [93_OUT_OF_SCOPE.md](93_OUT_OF_SCOPE.md) — explicit non-goals (no Rekordbox replacement, no cloud AI)
- [99_CHANGELOG.md](99_CHANGELOG.md) — requirement changes by date

## Architecture & Planning

- [30_REKORDBOX_INTEGRATION.md](30_REKORDBOX_INTEGRATION.md) — Rekordbox read/write: cue points, playlists, USB export
- [31_TRANSITION_MINING.md](31_TRANSITION_MINING.md) — transition mining, suggestion engine, transition library
- [32_AI_CURATION.md](32_AI_CURATION.md) — AI-assisted curation: set planning, transition suggestions, spectral clustering

## Masterplan

- [../ROAD_TO_MVP.md](../ROAD_TO_MVP.md) — masterplan: 6 phases from current frontend to MVP backend (~12 days)

## Feature Domains

- [10_LIBRARY_AND_FILE_LOADING.md](10_LIBRARY_AND_FILE_LOADING.md) — root folder selection, file scanning, metadata extraction
- [11_SONG_MODEL.md](11_SONG_MODEL.md) — song entity: identity, musical properties, ratings, notes, tags
- [12_TAGS_AND_GENRES.md](12_TAGS_AND_GENRES.md) — centralized tags, genre hierarchy, color management
- [13_LIBRARY_VIEW.md](13_LIBRARY_VIEW.md) — table layout, columns, filtering, inline editing
- [14_RELATIONSHIPS.md](14_RELATIONSHIPS.md) — knowledge graph, relationship types, graph view
- [15_BLOCKS.md](15_BLOCKS.md) — reusable mini-mixes (ordered songs + transition notes)
- [16_SET_PLANNING.md](16_SET_PLANNING.md) — set planning workflow: crate selection, sorting, phase-based set building
- [17_SETTINGS.md](17_SETTINGS.md) — tags/genres management, backup/export, preferences

## Data Contract

- [20_DATA_MODEL_OVERVIEW.md](20_DATA_MODEL_OVERVIEW.md) — entities and their relationships
- [21_DATA_MODEL_LIBRARY_JSON.md](21_DATA_MODEL_LIBRARY_JSON.md) — library.json schema (songs, tags, relationships)
- [22_DATA_MODEL_BLOCKS_AND_SETS.md](22_DATA_MODEL_BLOCKS_AND_SETS_JSON.md) — blocks.json and sets.json schemas