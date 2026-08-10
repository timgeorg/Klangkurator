---
source: manual
created: 2026-08-09
tags:
  - plan
  - implementation
  - mvp
status: active
---
# Phase 1 — Storage Layer + Data Models

Status: Active
Estimated: 2 days
Prerequisites: Phase 0 complete

## Goal

Build the JSON file storage layer and Pydantic models that exactly match the
existing TypeScript interfaces in `src/lib/storage.ts`. By the end of this
phase, the backend can read, write, and validate all three JSON files.

## Context

The frontend currently uses `src/lib/storage.ts` — a `LocalStorage` class with
33 methods across these entity types:

| Entity | Methods |
|---|---|
| Song | `getSongs`, `addSong`, `updateSong`, `deleteSong` |
| Tag | `getTags`, `addTag`, `updateTag`, `deleteTag` |
| SongTag | `getSongTags`, `addSongTag` |
| SongRelationship | `getSongRelationships`, `addSongRelationship`, `deleteSongRelationship` |
| Playlist | `getPlaylists`, `addPlaylist`, `updatePlaylist`, `deletePlaylist` |
| PlaylistSong | `getPlaylistSongs`, `addPlaylistSong` |
| Block | `getBlocks`, `addBlock`, `updateBlock`, `deleteBlock`, `getBlockWithSongs` |
| DJSet | `getSets`, `addSet`, `updateSet`, `deleteSet` |
| Queries | `getTransitionSuggestions`, `getTagsForSong`, `getSongsForTag`, `getRelatedSongs`, `getPlaylistsForSong` |

The backend must replicate this exact interface so the frontend can switch
from localStorage to HTTP without changing component code.

## Tasks

### 1.1 — Pydantic models (`backend/models/`)

Each model must match the TypeScript interface field names exactly.

#### `song.py`
```python
class Song(BaseModel):
    id: str
    title: str
    artist: str
    album: str | None = None
    bpm: float | None = None
    musical_key: str | None = None
    duration: float | None = None  # seconds
    main_genre: str | None = None      # TS: mainGenre
    subgenres: list[str] = []           # TS: subgenres
    genre: str | None = None            # legacy
    genres: list[str] | None = None     # legacy
    year: int | None = None
    file_path: str
    artwork_url: str | None = None
    danceability: int = 0    # 0-5
    energy: int = 0          # 0-5
    social_acceptance: int = 0  # 0-5
    drum_notes: str | None = None
    element_notes: str | None = None
    mixing_notes: str | None = None
    lyrics: str | None = None
    # NEW fields from requirements
    phase_tags: list[str] = []
    vibe_tags: list[str] = []
    transition_notes: str | None = None
    root_folder: str | None = None
    created_at: str
    updated_at: str
```

**Critical: camelCase → snake_case mapping.** The TS interfaces use
`mainGenre`, `social_acceptance`, `musical_key`. The Pydantic models use
snake_case internally. FastAPI's `response_model_by_alias` or explicit
`Field(alias="mainGenre")` handles the JSON serialization.

Use Pydantic v2 `model_config = ConfigDict(populate_by_name=True)` and
`Field(alias=...)` for every field that differs between TS and Python:

| Python (snake_case) | JSON / TS (camelCase) |
|---|---|
| `main_genre` | `mainGenre` |
| `musical_key` | `musicalKey` (TS uses `musical_key` — check!) |
| `social_acceptance` | `social_acceptance` (same in TS) |
| `file_path` | `file_path` (same) |
| `artwork_url` | `artwork_url` (same) |
| `root_folder` | `root_folder` (same) |
| `phase_tags` | `phase_tags` (same) |
| `vibe_tags` | `vibe_tags` (same) |

Check `src/lib/storage.ts` carefully — most fields are already snake_case
in the TS interfaces. Only `mainGenre` and `subgenres` differ.

#### `tag.py`
```python
class Tag(BaseModel):
    id: str
    name: str
    color: str
    created_at: str
```

#### `relationship.py`
```python
class SongRelationship(BaseModel):
    id: str
    source_song_id: str        # TS: source_song_id
    target_song_id: str        # TS: target_song_id
    relationship_type: str     # TS: relationship_type — enum values: remix, same_sample, cover, mashup, edit, bootleg, in_playlist, transition
    notes: str | None = None
    created_at: str
```

#### `playlist.py`
```python
class Playlist(BaseModel):
    id: str
    name: str
    description: str | None = None
    color: str
    is_smart_playlist: bool
    search_criteria: dict | None = None
    created_at: str
    updated_at: str

class PlaylistSong(BaseModel):
    playlist_id: str
    song_id: str
    position: int
```

#### `block.py`
```python
class BlockSong(BaseModel):
    song_id: str
    position: int
    transition_notes: str | None = None

class Block(BaseModel):
    id: str
    name: str
    description: str | None = None
    color: str
    songs: list[BlockSong] = []
    created_at: str
    updated_at: str
```

#### `set.py`
**This is the new phase-based model** from `16_SET_PLANNING.md`. The current
TS model is flat (`DJSet.items: SetItem[]`). The new model has phases.

For MVP, we support **both** — the old flat model for backward compatibility
and the new phase model. The Set model includes optional `phases`:

```python
class AltTransition(BaseModel):
    ref_id: str
    label: str | None = None

class SetItem(BaseModel):
    id: str
    type: str  # "song" | "block"
    ref_id: str  # song_id or block_id
    position: int
    transition_notes: str | None = None
    alternative_transitions: list[AltTransition] = []

class SetPhase(BaseModel):
    id: str
    name: str
    position: int
    target_duration_min: int | None = None
    notes: str | None = None
    items: list[SetItem] = []

class DJSet(BaseModel):
    id: str
    name: str
    description: str | None = None
    color: str
    # Legacy flat model (backward compat)
    items: list[SetItem] = []  # deprecated, kept for migration
    # New phase-based model
    phases: list[SetPhase] = []
    # New set planning fields
    event_name: str | None = None
    event_date: str | None = None
    target_duration_min: int | None = None
    crates: list[str] = []
    notes: str | None = None
    created_at: str
    updated_at: str
```

### 1.2 — Base store (`backend/storage/base_store.py`)

Generic JSON file store used by all three stores:

```python
class BaseStore:
    def __init__(self, file_path: Path, model_class: type):
        self._file_path = file_path
        self._model_class = model_class
        self._data: dict = {}
        self._load()

    def _load(self):
        """Load JSON from disk. If file doesn't exist, start empty."""
        if self._file_path.exists():
            with open(self._file_path, 'r') as f:
                self._data = json.load(f)
        else:
            self._data = {}

    def _save(self):
        """Atomic write: write to temp file, then rename."""
        tmp = self._file_path.with_suffix('.tmp')
        with open(tmp, 'w') as f:
            json.dump(self._data, f, indent=2, ensure_ascii=False)
        tmp.rename(self._file_path)
```

### 1.3 — Library store (`backend/storage/library_store.py`)

Wraps `library.json` containing songs, tags, song_tags, relationships,
playlists, playlist_songs.

Methods (matching `storage.ts` exactly):
- `get_songs() -> list[Song]`
- `add_song(song_data) -> Song` (generates UUID + timestamps)
- `update_song(id, updates) -> Song | None`
- `delete_song(id) -> bool` (cascades: removes song_tags, relationships, playlist_songs)
- `get_tags() -> list[Tag]`
- `add_tag(tag_data) -> Tag`
- `update_tag(id, updates) -> Tag | None`
- `delete_tag(id) -> bool` (cascades: removes song_tags)
- `get_song_tags() -> list[dict]`
- `add_song_tag(song_id, tag_id) -> void`
- `get_song_relationships() -> list[SongRelationship]`
- `add_song_relationship(rel_data) -> SongRelationship`
- `delete_song_relationship(id) -> bool`
- `get_playlists() -> list[Playlist]`
- `add_playlist(playlist_data) -> Playlist`
- `update_playlist(id, updates) -> Playlist | None`
- `delete_playlist(id) -> bool` (cascades: removes playlist_songs)
- `get_playlist_songs() -> list[PlaylistSong]`
- `add_playlist_song(playlist_id, song_id, position) -> void`

Query methods (computed on demand):
- `get_tags_for_song(song_id) -> list[Tag]`
- `get_songs_for_tag(tag_id) -> list[Song]`
- `get_related_songs(song_id) -> list[dict]` (returns song + relationship + direction)
- `get_playlists_for_song(song_id) -> list[dict]` (returns playlist + position)
- `get_transition_suggestions(song_id) -> list[dict]` (returns songs + notes from transition relationships)

### 1.4 — Blocks store (`backend/storage/blocks_store.py`)

Wraps `blocks.json` containing blocks.

Methods:
- `get_blocks() -> list[Block]`
- `add_block(block_data) -> Block`
- `update_block(id, updates) -> Block | None`
- `delete_block(id) -> bool`
- `get_block_with_songs(block_id) -> dict | None` (joins with library_store for song data)

### 1.5 — Sets store (`backend/storage/sets_store.py`)

Wraps `sets.json` containing sets.

Methods:
- `get_sets() -> list[DJSet]`
- `add_set(set_data) -> DJSet`
- `update_set(id, updates) -> DJSet | None`
- `delete_set(id) -> bool`

### 1.6 — Store initialization

`backend/storage/__init__.py`:
- Singleton store instances
- `get_library_store()`, `get_blocks_store()`, `get_sets_store()`
- On first access, stores load from `~/.klangkurator/` (created by `config.py`)
- If JSON files don't exist, they start empty (`{}`) and are written on first mutation

### 1.7 — UUID generation

Use Python `uuid.uuid4()` → `str(uuid)`. This matches the frontend's
`crypto.randomUUID()` format.

## Deliverable

```bash
# From a Python shell:
from backend.storage import get_library_store
store = get_library_store()
song = store.add_song({
    "title": "Test Track",
    "artist": "Test Artist",
    "file_path": "/music/test.mp3",
    "danceability": 0,
    "energy": 0,
    "social_acceptance": 0,
})
print(song.id)  # UUID string
print(store.get_songs())  # [Song(...)]

# ~/.klangkurator/library.json now contains the song
```

## Key Decisions

- **In-memory + write-through**: stores load the full JSON into memory on
  startup and write back to disk on every mutation. This is fast enough for
  1,000–5,000 songs and avoids read-on-every-request overhead.
- **Atomic writes**: write to `.tmp` file, then `os.rename()`. Prevents
  corruption if the app crashes mid-write.
- **Pydantic v2**: models validate on input. Invalid data raises
  `ValidationError` → FastAPI returns 422 automatically.
- **Field aliases**: `main_genre` in Python serializes as `mainGenre` in JSON
  to match the TS interfaces. Use `Field(alias="mainGenre")` +
  `model_config = ConfigDict(populate_by_name=True)`.

## Risks

- **camelCase mismatch**: if the TS interfaces use `musical_key` (snake_case)
  but we alias it as `musicalKey`, the frontend breaks. Must verify each field
  against `storage.ts` before adding aliases.
- **Set model migration**: existing localStorage sets use the flat `items[]`
  model. The new `phases[]` model is additive — `items` stays for backward
  compat. The frontend will use `phases` for new sets and migrate old ones.