"""SongRelationship model matching src/lib/storage.ts SongRelationship interface."""

from pydantic import BaseModel


class SongRelationshipBase(BaseModel):
    source_song_id: str
    target_song_id: str
    relationship_type: str  # remix, same_sample, cover, mashup, edit, bootleg, in_playlist, transition
    notes: str | None = None


class SongRelationshipCreate(SongRelationshipBase):
    pass


class SongRelationship(SongRelationshipBase):
    id: str
    created_at: str
