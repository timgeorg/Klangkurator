"""Song model matching src/lib/storage.ts Song interface."""

from pathlib import Path

from pydantic import BaseModel, Field, ConfigDict, model_validator


#: Song keys the model no longer has (issue #48: `people` replaced both). Rows
#: saved before keep them; nothing reads them, and the export leaves them out.
RETIRED_SONG_KEYS = frozenset({"danceability", "social_acceptance"})


class AudioVariant(BaseModel):
    """Another file of the same recording (issue #65, [[18_AUDIO_VARIANTS]]).

    A variant carries no BPM, key, rating, note, tag or relationship: those
    belong to the track, once. Its format facts are stored at attach time so a
    listing never probes a 36 MB `.wav` for every row.

    `missing` is derived on every read from the file's presence on this
    machine. It is never written to library.json — a stored flag would be
    stale the moment the file moved, and the flag is machine truth.
    """

    id: str
    file_path: str
    format: str
    duration: float | None = None
    bitrate: int | None = None
    sample_rate: int | None = None
    bit_depth: int | None = None
    size_bytes: int | None = None
    added_at: str
    #: A tempo an earlier analysis or the file's own TBPM tag read for *this*
    #: file, when one was recorded. It is never the track's BPM — that stays on
    #: the row — and nothing acts on it. The re-analyze popup shows it beside
    #: the primary's value so a half-tempo disagreement is visible, and the user
    #: decides (AC-13, AC-14).
    bpm_reading: float | None = None
    #: Derived, never stored.
    missing: bool = False

    @model_validator(mode="after")
    def _derive_missing(self) -> "AudioVariant":
        """Mark the variant when its file is not on this machine."""
        self.missing = not Path(self.file_path).is_file()
        return self


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
    # The 0–5 ratings take one decimal (issue #7, #48); rank stays a whole number.
    energy: float = 0
    people: float = 0
    rank: int = 0
    drum_notes: str | None = None
    element_notes: str | None = None
    mixing_notes: str | None = None
    lyrics: str | None = None
    # Set planning fields
    phase_tags: list[str] = Field(default_factory=list)
    vibe_tags: list[str] = Field(default_factory=list)
    transition_notes: str | None = None
    root_folder: str | None = None
    waveform_peaks: list[float] | None = None
    #: Other files of the same recording. `file_path` stays the primary; these
    #: never become rows of their own (INV-14).
    audio_variants: list[AudioVariant] = Field(default_factory=list)

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
    energy: float | None = None
    people: float | None = None
    rank: int | None = None
    drum_notes: str | None = None
    element_notes: str | None = None
    mixing_notes: str | None = None
    lyrics: str | None = None
    phase_tags: list[str] | None = None
    vibe_tags: list[str] | None = None
    transition_notes: str | None = None
    root_folder: str | None = None
    waveform_peaks: list[float] | None = None
    audio_variants: list[AudioVariant] | None = None

    model_config = ConfigDict(populate_by_name=True)


class Song(SongBase):
    """Full song entity with id and timestamps."""
    id: str
    created_at: str
    updated_at: str
    #: Derived, never stored: the primary's file is not on this machine, so
    #: playback falls back to a variant and the player names it (AC-9, AC-10).
    primary_missing: bool = False

    @model_validator(mode="after")
    def _derive_primary_missing(self) -> "Song":
        """Flag a row whose primary file has gone missing."""
        self.primary_missing = bool(self.file_path) and not Path(self.file_path).is_file()
        return self
