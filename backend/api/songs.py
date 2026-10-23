"""Songs CRUD endpoints."""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from backend.models.song import Song, SongBase, SongCreate, SongUpdate
from backend.models.tag import Tag
from backend.storage import get_library_store

router = APIRouter(prefix="/api/songs", tags=["songs"])


@router.get("", response_model=list[Song])
def list_songs(search: str | None = Query(None), slim: bool = Query(False)):
    """List every song, optionally without the waveform envelope.

    The envelope is 200 floats per track — 62 % of a listing at 499 tracks and
    67 % at 1,907 — which is most of the payload for a caller that cannot draw
    a waveform (REQ-10-SL). `slim=true` is a projection, not pagination: the
    app's own client keeps the default full rows.

    Args:
        search (str | None): Case-insensitive filter over title, artist,
            genres, key and album.
        slim (bool): Drop `waveform_peaks` from every row.

    Returns:
        list[Song] | JSONResponse: the rows, or the slim projection of them.
    """
    store = get_library_store()
    songs = store.get_songs()
    if search:
        songs = [song for song in songs if _matches_search(song, search.lower())]
    if not slim:
        return songs
    # Validate first, then drop the envelope: the response model is what fills
    # defaults a legacy row lacks (rank, phase_tags, vibe_tags), so stripping
    # the raw dicts would hand back a narrower row than the full listing.
    return JSONResponse([
        Song.model_validate(song).model_dump(by_alias=True, exclude={"waveform_peaks"})
        for song in songs
    ])


def _matches_search(song: dict, needle: str) -> bool:
    """Whether a song carries `needle` in any field the listing searches.

    Args:
        song (dict): A stored song.
        needle (str): The search text, already lowercased.

    Returns:
        bool: True on a hit in title, artist, genres, genre, key or album.
    """
    haystack = [
        song.get("title") or "",
        song.get("artist") or "",
        song.get("genre") or "",
        song.get("musical_key") or "",
        song.get("album") or "",
        *(song.get("genres") or []),
    ]
    return any(needle in str(value).lower() for value in haystack)


@router.get("/{song_id}", response_model=Song)
def get_song(song_id: str):
    store = get_library_store()
    song = store.get_song(song_id)
    if song is None:
        raise HTTPException(404, "Song not found")
    return song


@router.post("", response_model=Song, status_code=201)
def create_song(body: SongCreate):
    store = get_library_store()
    data = body.model_dump(by_alias=True, exclude_unset=False)
    return store.add_song(data)


# Fields a client may clear by sending an explicit null: the optional ones
# (default None). Required fields and lists ignore a null instead of being
# blanked. Fields left out of the request are never touched.
_CLEARABLE = {
    field.alias or name for name, field in SongBase.model_fields.items() if field.default is None
}


@router.put("/{song_id}", response_model=Song)
def update_song(song_id: str, body: SongUpdate):
    store = get_library_store()
    updates = body.model_dump(by_alias=True, exclude_unset=True)
    updates = {k: v for k, v in updates.items() if v is not None or k in _CLEARABLE}
    song = store.update_song(song_id, updates)
    if song is None:
        raise HTTPException(404, "Song not found")
    return song


@router.delete("/{song_id}", status_code=204)
def delete_song(song_id: str):
    store = get_library_store()
    if not store.delete_song(song_id):
        raise HTTPException(404, "Song not found")


# ── Song-Tag associations ─────────────────────────────────

@router.get("/{song_id}/tags", response_model=list[Tag])
def get_song_tags(song_id: str):
    store = get_library_store()
    if store.get_song(song_id) is None:
        raise HTTPException(404, "Song not found")
    return store.get_tags_for_song(song_id)


@router.post("/{song_id}/tags", status_code=201)
def add_song_tag(song_id: str, body: dict):
    store = get_library_store()
    if store.get_song(song_id) is None:
        raise HTTPException(404, "Song not found")
    tag_id = body.get("tag_id")
    if not tag_id or store.get_tag(tag_id) is None:
        raise HTTPException(404, "Tag not found")
    store.add_song_tag(song_id, tag_id)
    return {"status": "ok"}


@router.delete("/{song_id}/tags/{tag_id}")
def remove_song_tag(song_id: str, tag_id: str):
    store = get_library_store()
    if not store.remove_song_tag(song_id, tag_id):
        raise HTTPException(404, "Song-tag association not found")
    return {"status": "ok"}


# ── Related / transition suggestions ──────────────────────

@router.get("/{song_id}/related")
def get_related_songs(song_id: str):
    store = get_library_store()
    if store.get_song(song_id) is None:
        raise HTTPException(404, "Song not found")
    return store.get_related_songs(song_id)


@router.get("/{song_id}/transition-suggestions")
def get_transition_suggestions(song_id: str):
    store = get_library_store()
    if store.get_song(song_id) is None:
        raise HTTPException(404, "Song not found")
    return store.get_transition_suggestions(song_id)


@router.get("/{song_id}/playlists")
def get_playlists_for_song(song_id: str):
    store = get_library_store()
    if store.get_song(song_id) is None:
        raise HTTPException(404, "Song not found")
    return store.get_playlists_for_song(song_id)
