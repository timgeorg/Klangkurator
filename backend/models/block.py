"""Block model matching src/lib/storage.ts Block and BlockSong interfaces."""

from pydantic import BaseModel


class BlockSong(BaseModel):
    song_id: str
    position: int
    transition_notes: str | None = None


class BlockBase(BaseModel):
    name: str
    description: str | None = None
    color: str
    songs: list[BlockSong] = []


class BlockCreate(BlockBase):
    pass


class BlockUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    color: str | None = None
    songs: list[BlockSong] | None = None


class Block(BlockBase):
    id: str
    created_at: str
    updated_at: str
