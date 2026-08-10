"""Misc endpoints — flat data access, playlists, import."""

from fastapi import APIRouter, HTTPException

from backend.storage import get_library_store, get_blocks_store, get_sets_store

router = APIRouter(tags=["misc"])


@router.get("/api/song-tags")
def get_all_song_tags():
    return get_library_store().get_song_tags()


@router.get("/api/playlist-songs")
def get_all_playlist_songs():
    return get_library_store().get_playlist_songs()


# ── Playlists ──────────────────────────────────────────────

@router.get("/api/playlists")
def get_playlists():
    return get_library_store().get_playlists()


@router.post("/api/playlists", status_code=201)
def create_playlist(body: dict):
    return get_library_store().add_playlist(body)


@router.put("/api/playlists/{playlist_id}")
def update_playlist(playlist_id: str, body: dict):
    result = get_library_store().update_playlist(playlist_id, body)
    if result is None:
        raise HTTPException(404, "Playlist not found")
    return result


@router.delete("/api/playlists/{playlist_id}", status_code=204)
def delete_playlist(playlist_id: str):
    if not get_library_store().delete_playlist(playlist_id):
        raise HTTPException(404, "Playlist not found")


@router.post("/api/playlists/{playlist_id}/songs", status_code=201)
def add_playlist_song(playlist_id: str, body: dict):
    return get_library_store().add_playlist_song(
        playlist_id,
        body["song_id"],
        body.get("position"),
    )


@router.delete("/api/playlists/{playlist_id}/songs/{song_id}")
def remove_playlist_song(playlist_id: str, song_id: str):
    if not get_library_store().remove_playlist_song(playlist_id, song_id):
        raise HTTPException(404, "Playlist song not found")


# ── Import ─────────────────────────────────────────────────

@router.post("/api/import")
def import_data(body: dict):
    library = get_library_store()
    blocks = get_blocks_store()
    sets = get_sets_store()

    if "songs" in body:
        library._data["songs"] = body["songs"]
    if "tags" in body:
        library._data["tags"] = body["tags"]
    if "song_tags" in body:
        library._data["song_tags"] = body["song_tags"]
    if "song_relationships" in body:
        library._data["relationships"] = body["song_relationships"]
    if "playlists" in body:
        library._data["playlists"] = body["playlists"]
    if "playlist_songs" in body:
        library._data["playlist_songs"] = body["playlist_songs"]
    if "blocks" in body:
        blocks._data["blocks"] = body["blocks"]
    if "sets" in body:
        sets._data["sets"] = body["sets"]

    library._save_fn()
    blocks._save_fn()
    sets._save_fn()

    return {"status": "ok"}
