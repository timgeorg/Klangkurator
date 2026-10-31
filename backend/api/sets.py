"""Sets CRUD endpoints."""

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from backend.models.set import DJSet, DJSetBase, DJSetCreate, DJSetUpdate
from backend.services.rekordbox_xml import (
    ExportPlaylist,
    ExportTrack,
    build_xml,
    kind_for,
    rating_for,
    size_of,
)
from backend.storage import get_blocks_store, get_library_store, get_sets_store

router = APIRouter(prefix="/api/sets", tags=["sets"])

# Fields a client may clear by sending an explicit null: the optional ones.
# `target_duration_min` matters here — a set is often a pool rather than a
# timed plan, and without this a target could be set once and never removed.
# Required fields and lists ignore a null instead of being blanked.
_CLEARABLE = {
    field.alias or name for name, field in DJSetBase.model_fields.items() if field.default is None
}


@router.get("", response_model=list[DJSet])
def list_sets():
    store = get_sets_store()
    return store.get_sets()


@router.get("/{set_id}", response_model=DJSet)
def get_set(set_id: str):
    store = get_sets_store()
    dj_set = store.get_set(set_id)
    if dj_set is None:
        raise HTTPException(404, "Set not found")
    return dj_set


@router.post("", response_model=DJSet, status_code=201)
def create_set(body: DJSetCreate):
    store = get_sets_store()
    return store.add_set(body.model_dump())


@router.put("/{set_id}", response_model=DJSet)
def update_set(set_id: str, body: DJSetUpdate):
    """Update a set partially.

    Args:
        set_id (str): The set to change.
        body (DJSetUpdate): The fields to change. A field left out is not
            touched; an explicit null clears an optional one (see `_CLEARABLE`).

    Returns:
        DJSet: The set after the update.

    Raises:
        HTTPException: 404 when no set has that id.
    """
    store = get_sets_store()
    raw = body.model_dump(exclude_unset=True)
    updates = {k: v for k, v in raw.items() if v is not None or k in _CLEARABLE}
    dj_set = store.update_set(set_id, updates)
    if dj_set is None:
        raise HTTPException(404, "Set not found")
    return dj_set


@router.delete("/{set_id}", status_code=204)
def delete_set(set_id: str):
    store = get_sets_store()
    if not store.delete_set(set_id):
        raise HTTPException(404, "Set not found")


def _export_track(track_id: int, song: dict, transition_note: str | None = None) -> ExportTrack:
    """One collection entry from a stored song.

    Only what the spec has a slot for is passed on; the writer drops a value it
    cannot express rather than inventing one. The set's transition note comes
    first in `Comments`, because that is what survives of the set planning.
    """
    path = song.get("file_path") or ""
    notes = " · ".join(
        part.strip()
        for part in (
            transition_note,
            song.get("mixing_notes"),
            song.get("drum_notes"),
            song.get("element_notes"),
        )
        if part and part.strip()
    )
    return ExportTrack(
        track_id=track_id,
        name=song.get("title") or "Untitled",
        location=path,
        artist=song.get("artist"),
        genre=song.get("mainGenre") or song.get("main_genre") or song.get("genre"),
        size=size_of(path),
        total_time=int(song["duration"]) if song.get("duration") else None,
        average_bpm=song.get("bpm"),
        tonality=song.get("musical_key"),
        rating=rating_for(song.get("rank")),
        comments=notes or None,
        kind=kind_for(path),
    )


def _set_tracks(dj_set: dict) -> list[tuple[str, str | None]]:
    """The songs a set holds, in its running order, as (song id, transition note).

    The export is the thing a DJ plays, so a block contributes its tracks in place
    and a missing reference is skipped: Rekordbox has no slot for either. A note on
    a block belongs to the block, so it is not put on each of its tracks.
    """
    items = sorted(dj_set.get("items") or [], key=lambda item: item.get("position", 0))
    blocks = {block["id"]: block for block in get_blocks_store().get_blocks()}
    out: list[tuple[str, str | None]] = []
    for item in items:
        ref = item.get("ref_id") or item.get("song_id") or item.get("block_id") or ""
        if item.get("type") == "block":
            block = blocks.get(ref)
            if not block:
                continue
            for entry in sorted(block.get("songs") or [], key=lambda e: e.get("position", 0)):
                song_id = entry.get("song_id") or ""
                if song_id:
                    out.append((song_id, None))
        elif ref:
            out.append((ref, (item.get("transition_notes") or "").strip() or None))
    return out


@router.get("/{set_id}/export/rekordbox")
def export_set_rekordbox(set_id: str):
    """Write the set as a Rekordbox playlist XML file.

    One `NODE` for this set, holding its tracks in the set's running order, and a
    `COLLECTION` with just those tracks. Reading the file back into Rekordbox
    creates a playlist of the same name with the same order.

    Args:
        set_id (str): The set to export.

    Returns:
        Response: The XML document as a download.

    Raises:
        HTTPException: 404 when no set has that id.
    """
    store = get_sets_store()
    dj_set = store.get_set(set_id)
    if dj_set is None:
        raise HTTPException(404, "Set not found")

    library = get_library_store()
    by_id = {song["id"]: song for song in library.get_songs()}

    # TrackID and a playlist's Key are the same number in this file: Rekordbox
    # matches an entry to a collection entry through them, so the app's own ids
    # never leave the app.
    exported: list[ExportTrack] = []
    keys: list[int] = []
    seen: set[str] = set()
    for song_id, note in _set_tracks(dj_set):
        song = by_id.get(song_id)
        if song is None or not song.get("file_path"):
            continue
        # A set may repeat a track; Rekordbox keys must stay unique, so the first
        # occurrence wins and the repeat is dropped rather than written twice.
        if song_id in seen:
            continue
        seen.add(song_id)
        key = len(exported) + 1
        exported.append(_export_track(key, song, note))
        keys.append(key)

    xml = build_xml(exported, [ExportPlaylist(name=dj_set["name"], track_ids=keys)])

    safe_name = "".join(c if c.isalnum() or c in " -_" else "_" for c in dj_set["name"]).strip()
    filename = f"{safe_name or 'set'}.xml"
    return Response(
        content=xml,
        media_type="application/xml",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
