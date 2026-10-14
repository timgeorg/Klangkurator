"""Misc endpoints — flat data access, playlists, export/import."""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from backend.services.import_merge import (
    ENVELOPE_FORMAT, ENVELOPE_VERSION, apply_import, plan_import,
)
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


# ── Export / Import (issue #10, PF-83; NFR-2) ─────────────

@router.get("/api/export")
def export_data():
    """The whole store as a versioned envelope. `_config` (root path) is
    machine-local and excluded."""
    library = get_library_store()
    return {
        "format": ENVELOPE_FORMAT,
        "version": ENVELOPE_VERSION,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "data": {
            "songs": library.get_songs(),
            "tags": library.get_tags(),
            "song_tags": library.get_song_tags(),
            "song_relationships": library.get_relationships(),
            "playlists": library.get_playlists(),
            "playlist_songs": library.get_playlist_songs(),
            "blocks": get_blocks_store().get_blocks(),
            "sets": get_sets_store().get_sets(),
        },
    }


@router.post("/api/import/preview")
def import_preview(envelope: dict):
    """Read-only import plan: match summary + the conflict list the dialog
    resolves (MC-4). Writes nothing."""
    plan = plan_import(
        envelope, get_library_store(), get_blocks_store(), get_sets_store()
    )
    if not plan.get("valid"):
        raise HTTPException(422, plan.get("error", "Invalid export file"))
    plan.pop("_plan", None)  # internals stay internal
    return plan


@router.post("/api/import")
def import_data(body: dict):
    """Merge-import (issue #10). Replaces the old wholesale-replace behaviour,
    which assigned each incoming array wholesale — it matched nothing and
    destroyed the target library. Body = {envelope, resolutions:
    [{song_id, field, overwrite}]}; an absent resolution means the local value
    wins."""
    envelope = body.get("envelope")
    resolutions = body.get("resolutions") or []
    result = apply_import(
        envelope, resolutions, get_library_store(), get_blocks_store(),
        get_sets_store(),
    )
    if not result.get("valid"):
        raise HTTPException(422, result.get("error", "Invalid export file"))
    return result
