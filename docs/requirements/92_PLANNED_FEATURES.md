# Planned Features (Not Yet Specced)

Status: Active
Last Updated: 2026-08-09
Source: Requirements.md section 15; new ideas from set planning session

## Confirmed Future Work

| ID | Feature | Notes |
|---|---|---|
| PF-1 | Visual Fabric.js canvas editor for Sets | Drag blocks as nodes, draw connections as flowchart |
| PF-2 | BPM & key compatibility hints when building blocks/sets | Show green/yellow/red when adjacent tracks are compatible |
| PF-3 | Bulk-tag multiple selected songs | Select rows → apply tag to all |
| PF-4 | Persist column order/visibility/widths to localStorage | |
| PF-5 | "Clear All Filters" button + keyboard shortcuts (Ctrl+F, Esc) | |
| PF-6 | Inline editing of subgenres in the table | |
| PF-7 | Auto-size Subgenres column | |
| PF-8 | Python PyWebView backend implementation | Against the 3-file JSON schema |
| PF-9 | Smart playlists | is_smart_playlist + search_criteria fields exist in schema, logic not built |
| PF-10 | Full audio metadata extraction via `mutagen` | Phase 2 — requires PyWebView/Python |
| PF-11 | Nested crate folders as tree view | Currently flattened with `/` separator; tree view is future |

## Set Planning Future Work

| ID | Feature | Notes |
|---|---|---|
| PF-20 | Energy curve auto-suggest | Suggest tracks that fill energy gaps in the arc |
| PF-21 | Genre flow auto-suggest | Suggest tracks that bridge genre transitions smoothly |
| PF-22 | Set templates | Save phase structure as a template (e.g. "5-phase sunset set") |
| PF-23 | Duplicate set | Clone an existing set and adjust (confirmed in spec, not yet built) |
| PF-24 | Collaborative set review | Share set with another DJ for feedback (requires export/import, not real-time) |

## Rekordbox Integration (Future)

| ID | Feature | Notes |
|---|---|---|
| PF-30 | Read cue points from Rekordbox | Parse Rekordbox XML/database export, import cue points as song metadata |
| PF-31 | Write cue points to Rekordbox | Export cue points back to Rekordbox XML format for re-import |
| PF-32 | Export set as Rekordbox playlist | Generate Rekordbox-importable playlist XML from a planned set |
| PF-33 | Export set to USB | Export a set as a playlist + audio files structured for USB use on CDJ/XDJ |
| PF-34 | Rekordbox sync (bidirectional) | Detect changes in Rekordbox library and sync back (cue points, playlists, ratings) |

## Transition Mining

| ID | Feature | Notes |
|---|---|---|
| PF-40 | Transition mining from existing sets | Analyze saved sets/blocks and extract transition patterns: "A → B worked, here's how" |
| PF-41 | Transition suggestion engine | Given track A, suggest tracks B that have worked as transitions in the past (from saved transitions + sets) |
| PF-42 | Transition compatibility scoring | Score how well two tracks transition based on BPM, key, energy, genre compatibility |
| PF-43 | Transition library | Dedicated view to browse, search, and manage all known transitions |
| PF-44 | Transition import from DJ software | Parse Rekordbox history/mix recordings to extract transitions that were actually played |

## AI-Assisted Curation

| ID | Feature | Notes |
|---|---|---|
| PF-50 | AI set planning skill | AI workflow that proposes a full set plan given parameters (duration, vibe, crates, event type) — like the Sterling session |
| PF-51 | AI transition suggestions | AI-powered transition suggestions using musical features + transition history |
| PF-52 | Spectral clustering | Cluster tracks by audio similarity (spectral features) for crate discovery |
| PF-53 | AI micro-structure suggestions | AI proposes track ordering within a phase (the "micro-structure" feedback from the planning session) |
| PF-54 | AI vibe analysis | AI analyzes track notes + audio features and suggests phase_tags / vibe_tags |
| PF-55 | Energy arc optimization | AI suggests tracks to fill energy gaps in a set's arc |
| PF-56 | Local LLM inference | All AI runs locally (Ollama / llama-cpp-python) — no cloud, consistent with P9 |

## Browser / Mobile Companion (Future)

| ID | Feature | Notes |
|---|---|---|
| PF-60 | Browser companion | Same frontend running in a browser, talking to FastAPI on localhost or home server |
| PF-61 | Mobile companion (read-only) | Browse library, view notes/tags, plan sets from phone — no audio files on device, metadata and notes only |
| PF-62 | Mobile set planning | Full set planning workflow on mobile — drag-and-drop adapted for touch |
| PF-63 | Remote backend hosting | Deploy FastAPI on a home server / VPS for access outside localhost |