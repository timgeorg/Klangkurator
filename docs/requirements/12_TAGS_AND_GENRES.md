# Tags And Genres

Status: Active
Last Updated: 2026-08-09
Source: Requirements.md sections 5, 6

## Tags

### Tag Entity
| Field | Type | Description |
|---|---|---|
| `id` | string (UUID) | Stable, assigned once |
| `name` | string | Unique tag name |
| `color` | string | Color from 20-color palette |

### Behavior
- Tags are **centralized** — reused across songs, never duplicated
- Creating a new tag in the tag selector immediately syncs everywhere
  (no stale filter options)
- Multiple tags on one song display side-by-side (no stacking/wrapping issues)
- Deleting a tag removes it from all songs (with confirmation dialog)

### Default DJ-Focused Vocabulary
Piano, Strings, Synth Lead, Acid, Arp, Sing-Along, Vocal Chops, Female Vocal,
Male Vocal, Minimal Drop, Big Room Drop, Peak Time, Warm Up, Closer, Dark,
Uplifting, Long Intro, Long Outro, Acapella Section, Clean Mix Point

## Genres

### Model
- **Main genre + subgenres**: one main genre per song, multiple subgenres
- Predefined examples:
  - House → Groove, Minimal, Deep Tech, Bouncy
  - Techno → Bouncy, Schranz
  - Trance → (user-defined)
- Fully user-editable via Settings — **no "Reset to Defaults" button**

### Display
- Subgenres shown as separate column of outlined badges
- Badge color follows the main genre's color
- Main genre is a single-select in the edit dialog
- Subgenres are a multi-select