# Data Model Overview

Status: Active
Last Updated: 2026-08-09
Source: Requirements.md sections 2.3, 3, 10

## Entities

```
┌─────────┐     ┌─────────┐     ┌──────────────┐     ┌─────────┐
│  Song   │─────│  Tag    │     │ Relationship │     │ Playlist│
│         │ N:N │         │     │  (graph)     │     │         │
└────┬────┘     └─────────┘     └──────────────┘     └─────────┘
     │ 1:N
     │
┌────┴────┐     ┌─────────┐     ┌─────────┐
│  Block  │─────│  Set    │     │SetPhase │
│         │     │         │     │         │
└─────────┘     └────┬────┘     └────┬────┘
                     │ 1:N           │ 1:N
                     │               │
                     │          ┌────┴────┐
                     └──────────│SetItem  │
                                │(song or │
                                │ block)  │
                                └─────────┘
```

## Entity Relationships

| From | To | Type | Description |
|---|---|---|---|
| Song | Tag | N:N | Songs have multiple tags; tags are shared |
| Song | Song | N:N (self) | Via Relationship entity (remix, transition, etc.) |
| Song | Playlist | N:N | Via PlaylistSong join with position |
| Block | Song | N:N (ordered) | Via BlockSong with position + transition notes |
| Set | SetPhase | 1:N | A set has ordered phases |
| SetPhase | SetItem | 1:N | A phase has ordered items (songs or blocks) |
| SetItem | Song | N:1 | If type=song |
| SetItem | Block | N:1 | If type=block |
| SetItem | Song | N:N | Via alternative_transitions (branching options) |

## Storage Files (Phase 2)

```
library/
├── library.json   # songs[], tags[], relationships[], playlists[]
├── blocks.json    # blocks[]
└── sets.json      # sets[]
```

All three files are loaded fully at startup. Changes are written back
to the relevant file on save. No per-entity files — the entire dataset
fits in memory (~1,000–5,000 songs).

## The fourth file (built 2026-10-29, issue #51)

`~/.klangkurator/` holds four data files, not three:

| File | Holds |
|---|---|
| `library.json` | songs, tags, **genres**, song_tags, relationships, playlists, playlist_songs, `_config` |
| `blocks.json` | blocks |
| `sets.json` | sets |
| `settings.json` | the UI preferences: column layout, map inputs and layers, theme, covers, player dock, volume, crate-tab collapse |

`settings.json` is separate because a preference change must not rewrite the
multi-megabyte library. Every file is written atomically, and an unreadable one
is preserved as `<name>.corrupt-<timestamp>.json` rather than being replaced by
the empty state that follows a read error.
