# Data Model: blocks.json and sets.json

Status: Active
Last Updated: 2026-08-09
Source: Requirements.md section 10; new set planning workflow

## blocks.json

```json
{
  "blocks": [
    {
      "id": "uuid",
      "name": "Melodic Techno Opener",
      "description": "5-track ambient opening sequence for sunset sets",
      "color": "#F97316",
      "songs": [
        {
          "song_id": "uuid",
          "position": 0,
          "transition_notes": "Start at breakdown, long mix-in"
        },
        {
          "song_id": "uuid",
          "position": 1,
          "transition_notes": null
        }
      ],
      "created_at": "2026-08-08T...",
      "updated_at": "2026-08-08T..."
    }
  ]
}
```

## sets.json

```json
{
  "sets": [
    {
      "id": "uuid",
      "name": "Welzheimer Str Sunset 09.08.2026",
      "event_name": "Laurin's Party",
      "event_date": "2026-08-09",
      "target_duration_min": 120,
      "crates": ["Melodic Techno", "Deep House", "Afro House"],
      "notes": "Sunset set, 2h, friends + drinks vibe",
      "phases": [
        {
          "id": "uuid",
          "name": "Opening",
          "position": 0,
          "target_duration_min": 20,
          "notes": "People arriving, keep it ambient",
          "items": [
            {
              "id": "uuid",
              "type": "song",
              "ref_id": "song-uuid",
              "position": 0,
              "transition_notes": "Start at breakdown in middle",
              "alternative_transitions": []
            },
            {
              "id": "uuid",
              "type": "song",
              "ref_id": "song-uuid",
              "position": 1,
              "transition_notes": "Start at 2:06",
              "alternative_transitions": [
                {
                  "ref_id": "alt-song-uuid",
                  "label": "if crowd is more energetic"
                }
              ]
            }
          ]
        },
        {
          "id": "uuid",
          "name": "Building",
          "position": 1,
          "target_duration_min": 20,
          "notes": null,
          "items": []
        }
      ],
      "created_at": "2026-08-08T...",
      "updated_at": "2026-08-08T..."
    }
  ]
}
```

## Referential Integrity

- SetItems reference songs or blocks by `ref_id`
- If a referenced song is deleted from the library:
  - The SetItem is NOT deleted
  - It shows a "missing track" placeholder with the last known title
  - User can replace or remove it manually
- If a referenced block is deleted:
  - The SetItem is NOT deleted
  - It shows a "missing block" placeholder
  - User can replace or remove it
- Blocks referencing deleted songs show the same placeholder behavior