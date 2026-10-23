# Song Model

Status: Active
Last Updated: 2026-10-23
Source: Requirements.md section 3

## Song Entity

Each song stores:

### Identity
| Field | Type | Description |
|---|---|---|
| `id` | string (UUID) | Assigned once on first creation, never regenerated |
| `title` | string | Track title |
| `artist` | string | Primary artist |
| `album` | string? | Album name (optional) |
| `year` | number? | Release year |
| `duration` | number? | Duration in seconds |
| `file_path` | string | Absolute or root-relative path to the audio file |
| `artwork_url` | string? | Embedded artwork extracted to data URI or file path |

### Musical
| Field | Type | Description |
|---|---|---|
| `bpm` | number? | Beats per minute |
| `musical_key` | string? | Musical key (e.g. `Am`, `C#`, `7A` — Camelot or standard). Analysis and the Edit dialog write the short standard form (`Am`, `F#`); a key in another notation from file tags is kept as it is |

### Genre Hierarchy
| Field | Type | Description |
|---|---|---|
| `mainGenre` | string? | One main genre (House, Techno, Trance, …) |
| `subgenres` | string[] | Multiple subgenres (Groove, Minimal, Deep Tech, Bouncy, …) |
| `genre` | string? | Legacy field — retained for backward compatibility |
| `genres` | string[]? | Legacy field — retained for backward compatibility |

### DJ Ratings (0–5 scale)
| Field | Type | Description |
|---|---|---|
| `energy` | number (0–5, one decimal) | Energy level |
| `people` | number (0–5, one decimal) | How well the track works on people: danceable and crowd-pleasing in one. Labelled **People** |

`0` means unrated for both, and a song row without `people` reads as 0.
**People replaces `danceability` and `social_acceptance`** (issue #48, PF-87 —
built 2026-10-23): the two measured the same thing. No compatibility: nothing migrates,
aliases or reads the old fields. Their values are dropped (Tim: *"just drop
everything, I'll re-add those ratings"*); old keys still sitting in an existing
`library.json` are ignored — never shown, never written.

### Track Rank (1–5 stars)
| Field | Type | Description |
|---|---|---|
| `rank` | number (1–5) | A per-track quality score, whole stars only. Independent of the two ratings above — they say what a track *does*, the rank says *how good* it is. `0` means unranked (the default) |

### Sound Notes (free text — the core asset)
| Field | Type | Description |
|---|---|---|
| `drum_notes` | string | How the drums sound — so the DJ doesn't have to re-listen before mixing |
| `element_notes` | string | Key elements: synths, vocals, breaks, drops |
| `mixing_notes` | string | Mixing notes: good mix-in points, tricky transitions, EQ tips |

### Set Planning Notes (new)
| Field | Type | Description |
|---|---|---|
| `phase_tags` | string[] | Which set phases this track fits: `opening`, `building`, `sunset`, `peak`, `closing`, `warmup`, `cooldown` |
| `vibe_tags` | string[] | Free-form vibe descriptors: `dark`, `uplifting`, `tearjerker`, `banger`, `groovy`, `atmospheric`, `sexy` |
| `transition_notes` | string? | General notes about transitions into/out of this track |

### Other
| Field | Type | Description |
|---|---|---|
| `tags` | TagRef[] | Many-to-many to centralized Tag objects |
| `root_folder` | string | Derived from `file_path` — folder name inside library root |
| `lyrics` | string? | Long-form lyrics text, edited via dedicated dialog |
| `created_at` | ISO timestamp | First import time |
| `updated_at` | ISO timestamp | Last modification time |

## Design Note: Notes Are The Core Asset

The most important fields are the free-text notes. The entire tool exists so
that the DJ can write down what they know about a track and never have to
re-listen to it before a gig. Notes must be:

- **Fast to edit** — inline editing in the table, no dialog required for notes
- **Searchable** — full-text search across all note fields
- **Visible in set planning** — notes appear alongside the track in the set
  builder, so the DJ can see "dark, long intro, clean mix point at 2:06"
  while deciding what to play next