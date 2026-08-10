# Data Model: library.json

Status: Active
Last Updated: 2026-08-09
Source: Requirements.md sections 2.3, 3, 5, 7

## Schema

```json
{
  "songs": [
    {
      "id": "uuid",
      "title": "Beyond Beliefs",
      "artist": "Ben Böhmer",
      "album": "Beyond Beliefs",
      "year": 2021,
      "duration": 312,
      "file_path": "/music/Melodic Techno/Ben Böhmer - Beyond Beliefs.mp3",
      "artwork_url": null,
      "bpm": 124,
      "musical_key": "Am",
      "mainGenre": "Melodic Techno",
      "subgenres": ["Organic", "Atmospheric"],
      "genre": "Melodic Techno",
      "genres": ["Melodic Techno", "Organic"],
      "danceability": 3,
      "energy": 2,
      "social_acceptance": 2,
      "drum_notes": "Soft four-on-the-floor, organic percussion",
      "element_notes": "Warm pads, piano lead at breakdown",
      "mixing_notes": "Start at breakdown in middle for opening sets",
      "phase_tags": ["opening", "building"],
      "vibe_tags": ["atmospheric", "uplifting"],
      "transition_notes": "Long mix-in works, 16-bar intro blends under outgoing track",
      "tags": [
        { "tag_id": "uuid", "name": "Piano", "color": "#..." }
      ],
      "root_folder": "Melodic Techno",
      "lyrics": null,
      "created_at": "2026-08-08T...",
      "updated_at": "2026-08-08T..."
    }
  ],
  "tags": [
    {
      "id": "uuid",
      "name": "Piano",
      "color": "#3B82F6"
    }
  ],
  "relationships": [
    {
      "id": "uuid",
      "from_song_id": "uuid",
      "to_song_id": "uuid",
      "type": "transition",
      "notes": "Mix A's outro into B's intro at 124 BPM"
    }
  ],
  "playlists": [
    {
      "id": "uuid",
      "name": "Tim's Melodic Techno Chill",
      "songs": [
        { "song_id": "uuid", "position": 0 }
      ]
    }
  ]
}
```

## Data Integrity

- Song IDs are UUIDs assigned once on first creation, never regenerated
- Tag IDs are UUIDs assigned once on first creation
- Relationships reference song IDs — if a song is deleted, its relationships
  are deleted too (cascade)
- `root_folder` is derived from `file_path` at import time and stored denormalized
  for fast filtering (not re-derived on every query)
- Legacy `genre` and `genres` fields are kept for backward compatibility but
  not edited — new edits write to `mainGenre` and `subgenres`