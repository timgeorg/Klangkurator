"""Playlist model matching src/lib/storage.ts Playlist and PlaylistSong interfaces."""

from pydantic import BaseModel


class PlaylistBase(BaseModel):
    name: str
    description: str | None = None
    color: str
    is_smart_playlist: bool = False
    search_criteria: dict | None = None


class PlaylistCreate(PlaylistBase):
    pass


class PlaylistUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    color: str | None = None
    is_smart_playlist: bool | None = None
    search_criteria: dict | None = None


class Playlist(PlaylistBase):
    id: str
    created_at: str
    updated_at: str


class PlaylistSong(BaseModel):
    playlist_id: str
    song_id: str
    position: int
