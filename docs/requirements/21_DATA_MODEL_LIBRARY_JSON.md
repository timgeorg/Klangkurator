# Data Model: library.json

Status: Active
Last Updated: 2026-10-31
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
      "energy": 2,
      "people": 3,
      "drum_notes": "Soft four-on-the-floor, organic percussion",
      "element_notes": "Warm pads, piano lead at breakdown",
      "mixing_notes": "Start at breakdown in middle for opening sets",
      "phase_tags": ["opening", "building"],
      "vibe_tags": ["atmospheric", "uplifting"],
      "transition_notes": "Long mix-in works, 16-bar intro blends under outgoing track",
      "tags": [
        { "tag_id": "uuid", "name": "Piano", "color": "#..." }
      ],
      "crate_id": "crate_1f2e3d4c5b6a7980",
      "missing_since": null,
      "lyrics": null,
      "audio_variants": [
        {
          "id": "uuid",
          "file_path": "/music/Melodic Techno/Ben Böhmer - Beyond Beliefs.wav",
          "format": "wav",
          "duration": 312.004,
          "bitrate": null,
          "sample_rate": 44100,
          "bit_depth": 24,
          "size_bytes": 55040000,
          "added_at": "2026-10-30T15:00:00Z",
          "bpm_reading": null
        }
      ],
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
  ],
  "_config": {
    "music_locations": [
      { "id": "loc_9a8b7c6d5e4f3021", "path": "/media/tim/Extreme SSD/#MUSIC" }
    ],
    "crates": [
      {
        "id": "crate_1f2e3d4c5b6a7980",
        "name": "house/tims-classic-house",
        "location_path": "/media/tim/Extreme SSD/#MUSIC"
      }
    ]
  }
}
```

## Data Integrity

- Song IDs are UUIDs assigned once on first creation, never regenerated
- Tag IDs are UUIDs assigned once on first creation
- Relationships reference song IDs — if a song is deleted, its relationships
  are deleted too (cascade)
  for fast filtering (not re-derived on every query)
- `audio_variants` holds the other files of the same recording. `file_path` is
  the primary, and a variant never becomes a row of its own (INV-14,
  [[18_AUDIO_VARIANTS]]). The list is absent on a single-file track rather than
  stored as `[]`.
- `audio_variants[].missing` and the song's `primary_missing` are **derived on
  every read** from the file system. They are never written to this file: a
  stored flag goes stale when a file moves, and the fact belongs to the machine.
- `audio_variants[].bpm_reading` is advisory. It records a tempo an earlier
  analysis or the file's own TBPM tag read for that file, and nothing acts on
  it. The track's `bpm` stays the only tempo the library uses.
- `crate_id` names a crate in the registry below. The scan derives it from
  `file_path` and stores it, so a filter never re-derives it
- The app resolves a crate **name** through the registry at display time, so
  the stored value is an id and never a name
- Legacy `genre` and `genres` fields are kept for backward compatibility; the
  edit dialog mirrors them from `mainGenre` and `subgenres` on save (and
  clears them with the main genre), so older readers stay consistent
- Song updates (`PUT /api/songs/{id}`) are partial: a field left out is not
  touched; an explicit `null` clears an optional field (album, BPM, key,
  genre, year, notes, lyrics, …); required fields (title, artist, file path)
  and list fields ignore `null` (since 2026-10-08; before, every `null` was
  dropped, so an emptied field could never be cleared)

## `genres` (added 2026-10-29, issue #51)

```json
"genres": [
  { "name": "Techno", "color": "#6B5BD6", "subgenres": ["Peak Time", "Hard"] }
]
```

The genre vocabulary, beside `tags` and for the same reason: it is library
content, so it travels with the library and joins the export. Written through
`PUT /api/genres`; a blank name or a duplicate (case-insensitive) is refused.

## `_config.music_locations` and `_config.crates` (issue #11)

```json
"_config": {
  "music_locations": [
    { "id": "loc_9a8b7c6d5e4f3021", "path": "/media/tim/Extreme SSD/#MUSIC" },
    { "id": "loc_551baf157bb86fac", "path": "/home/tim/Vault/downloads/classic-techno-groove-techno" }
  ],
  "crates": [
    { "id": "crate_1f2e3d4c5b6a7980", "name": "house/tims-classic-house",
      "location_path": "/media/tim/Extreme SSD/#MUSIC" }
  ]
}
```

A **music location** is a folder the app scans as a root. A **crate** is a
folder inside one, at any depth, and its `name` is its path below the
location. Both are real entities, not strings derived from a song.

- `id` is a digest of the entity's path, not a random uuid. The app computes
  the same id on every run and on every machine, so a re-added location
  re-resolves its songs. `crate_id` is a digest of `(location_path, name)`
- `name` is display data. Two crates may share a name when their
  `location_path` differs, and the ids keep them apart
- `_config` is machine-local and stays out of an export. The registry names
  no song, and the paths it holds mean nothing on another machine
- There is **one** copy of the location list. The old `_config.root_path` is
  gone, and the migration consumes it

## `audio_variants` (proposed 2026-10-30)

```json
"songs": [
  {
    "id": "uuid",
    "file_path": "/music/house/x/Track (Remix).mp3",
    "audio_variants": [
      {
        "id": "uuid",
        "file_path": "/music/house/x/Track (Remix).wav",
        "format": "wav",
        "duration": 204.545,
        "bitrate": null,
        "sample_rate": 44100,
        "bit_depth": 24,
        "size_bytes": 36158234,
        "added_at": "2026-10-30T15:00:00Z"
      }
    ]
  }
]
```

The primary audio file stays in `file_path`, so every reader that already
exists (audio, waveform, export, the Rekordbox path handoff) is untouched. A
variant holds only what differs between the files — never BPM, key, ratings,
notes, tags or relationships; those belong to the track. Format facts are
stored because probing every row on every listing is not affordable for `.wav`
files of 30 MB and more. Full rules in [[18_AUDIO_VARIANTS]].
