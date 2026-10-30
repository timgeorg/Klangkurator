"""Songs CRUD endpoints."""

import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from backend.config import SUPPORTED_AUDIO_EXTENSIONS
from backend.models.song import Song, SongBase, SongCreate, SongUpdate
from backend.models.tag import Tag
from backend.scanner.metadata import file_facts
from backend.storage import get_library_store

router = APIRouter(prefix="/api/songs", tags=["songs"])


@router.get("", response_model=list[Song])
def list_songs(search: str | None = Query(None), slim: bool = Query(False)):
    """List every song, optionally without the waveform envelope.

    The peaks are 200 floats per track — 62–71 % of a listing across the
    measurements on record — which is most of the payload for a caller that cannot draw
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


# ── Audio variants (issue #65, [[18_AUDIO_VARIANTS]]) ─────

def _variant_from_path(file_path: str, variant_id: str | None = None) -> dict:
    """A variant payload for `file_path`, described by the file itself.

    Args:
        file_path (str): The file to attach.
        variant_id (str | None): A known id, else a fresh one is minted.

    Returns:
        dict: `{id, file_path, format, duration, bitrate, sample_rate,
        bit_depth, size_bytes, added_at}`.

    Raises:
        HTTPException: 404 when the file is not on this machine, 415 when it is
            not an audio format the scan would take.
    """
    p = Path(file_path).expanduser()
    if not p.is_file():
        raise HTTPException(404, f"Audio file not found: {file_path}")
    if p.suffix.lower() not in SUPPORTED_AUDIO_EXTENSIONS:
        raise HTTPException(415, f"Not an audio file: {p.name}")
    return {
        **file_facts(str(p)),
        "id": variant_id or str(uuid.uuid4()),
        "file_path": str(p),
        "added_at": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/{song_id}/variants", response_model=Song, status_code=201)
def attach_variant(song_id: str, body: dict):
    """Attach another file of the same recording to a track (AC-1, AC-2).

    Adds no song row: the track keeps its id, ratings, notes, tags and set
    entries, and the file joins `audio_variants` (INV-14).

    Args:
        song_id (str): The track.
        body (dict): `{file_path}` — the file to attach.

    Returns:
        Song: The updated track.

    Raises:
        HTTPException: 404 for an unknown track or a missing file, 415 for a
            non-audio file, 409 when the file already belongs to another track.
    """
    store = get_library_store()
    song = store.get_song(song_id)
    if song is None:
        raise HTTPException(404, "Song not found")
    file_path = body.get("file_path")
    if not file_path:
        raise HTTPException(422, "An attach needs a file_path")
    owner = store.find_song_by_any_path(str(file_path))
    if owner is not None and owner["id"] != song_id:
        raise HTTPException(409, f"That file already belongs to “{owner['title']}”")
    updated = store.add_variant(song_id, _variant_from_path(str(file_path)))
    if updated is None:
        raise HTTPException(404, "Song not found")
    return updated


@router.post("/{song_id}/variants/{variant_id}/primary", response_model=Song)
def make_variant_primary(song_id: str, variant_id: str):
    """Promote a variant to the track's primary file (AC-7, AC-8).

    The paths swap and nothing else changes. The demoted file is read for its
    own format facts before the swap, so the resulting row describes both files
    correctly and a second call returns to the starting state.

    Args:
        song_id (str): The track.
        variant_id (str): The variant to promote.

    Returns:
        Song: The updated track.

    Raises:
        HTTPException: 404 for an unknown track or variant, 404 when the
            variant's file is gone (there is nothing to play), 415 when the
            current primary can no longer be read as audio.
    """
    store = get_library_store()
    song = store.get_song(song_id)
    if song is None:
        raise HTTPException(404, "Song not found")
    variant = next((v for v in song.get("audio_variants") or [] if v.get("id") == variant_id), None)
    if variant is None:
        raise HTTPException(404, "Variant not found")
    facts = file_facts(variant["file_path"])
    if facts["size_bytes"] is None:
        raise HTTPException(404, f"Audio file not found: {variant['file_path']}")
    demoted = _variant_from_path(song["file_path"])
    updated = store.make_primary(song_id, variant_id, {k: v for k, v in demoted.items() if k != "added_at"})
    if updated is None:
        raise HTTPException(404, "Variant not found")
    return updated


@router.delete("/{song_id}/variants/{variant_id}", response_model=Song)
def detach_variant(song_id: str, variant_id: str):
    """Take a variant off a track. The file stays on disk (AC-18, AC-19, INV-15).

    Args:
        song_id (str): The track.
        variant_id (str): The variant to remove.

    Returns:
        Song: The track, intact, without that variant.

    Raises:
        HTTPException: 404 for an unknown track or variant.
    """
    store = get_library_store()
    updated = store.remove_variant(song_id, variant_id)
    if updated is None:
        raise HTTPException(404, "Variant not found")
    return updated


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
