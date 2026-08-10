"""Song relationships CRUD endpoints."""

from fastapi import APIRouter, HTTPException, Query

from backend.models.relationship import SongRelationship, SongRelationshipCreate
from backend.storage import get_library_store

router = APIRouter(prefix="/api/relationships", tags=["relationships"])


@router.get("", response_model=list[SongRelationship])
def list_relationships(song_id: str | None = Query(None)):
    store = get_library_store()
    if song_id:
        return store.get_relationships_for_song(song_id)
    return store.get_relationships()


@router.post("", response_model=SongRelationship, status_code=201)
def create_relationship(body: SongRelationshipCreate):
    store = get_library_store()
    # Validate both songs exist
    if store.get_song(body.source_song_id) is None:
        raise HTTPException(404, "Source song not found")
    if store.get_song(body.target_song_id) is None:
        raise HTTPException(404, "Target song not found")
    return store.add_relationship(body.model_dump())


@router.delete("/{rel_id}", status_code=204)
def delete_relationship(rel_id: str):
    store = get_library_store()
    if not store.delete_relationship(rel_id):
        raise HTTPException(404, "Relationship not found")
