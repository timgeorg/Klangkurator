"""Song model matching src/lib/storage.ts Song interface."""

from pydantic import BaseModel, Field, ConfigDict


class SongBase(BaseModel):
    """Fields that can be set at creation time (excludes id/timestamps)."""
    title: str
    artist: str
    album: str | None = None
    bpm: float | None = None
    musical_key: str | None = None
    duration: float | None = None
    main_genre: str | None = Field(None, alias="mainGenre")
    subgenres: list[str] = Field(default_factory=list)
    genre: str | None = None        # legacy
    genres: list[str] | None = None  # legacy
    year: int | None = None
    file_path: str
    artwork_url: str | None = None
    danceability: int = 0
    energy: int = 0
    social_acceptance: int = 0
    drum_notes: str | None = None
    element_notes: str | None = None
    mixing_notes: str | None = None
    lyrics: str | None = None
    # Set planning fields
    phase_tags: list[str] = Field(default_factory=list)
    vibe_tags: list[str] = Field(default_factory=list)
    transition_notes: str | None = None
    root_folder: str | None = None

    model_config = ConfigDict(populate_by_name=True)


class SongCreate(SongBase):
    """Create request — no id, no timestamps."""
    pass


class SongUpdate(BaseModel):
    """Update request — all fields optional."""
    title: str | None = None
    artist: str | None = None
    album: str | None = None
    bpm: float | None = None
    musical_key: str | None = None
    duration: float | None = None
    main_genre: str | None = Field(None, alias="mainGenre")
    subgenres: list[str] | None = None
    genre: str | None = None
    genres: list[str] | None = None
    year: int | None = None
    file_path: str | None = None
    artwork_url: str | None = None
    danceability: int | None = None
    energy: int | None = None
    social_acceptance: int | None = None
    drum_notes: str | None = None
    element_notes: str | None = None
    mixing_notes: str | None = None
    lyrics: str | None = None
    phase_tags: list[str] | None = None
    vibe_tags: list[str] | None = None
    transition_notes: str | None = None
    root_folder: str | None = None

    model_config = ConfigDict(populate_by_name=True)


class Song(SongBase):
    """Full song entity with id and timestamps."""
    id: str
    created_at: str
    updated_at: str
