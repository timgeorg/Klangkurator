"""Tags CRUD endpoints."""

from fastapi import APIRouter, HTTPException

from backend.models.tag import Tag, TagCreate, TagUpdate
from backend.models.song import Song
from backend.storage import get_library_store

router = APIRouter(prefix="/api/tags", tags=["tags"])


@router.get("", response_model=list[Tag])
def list_tags():
    store = get_library_store()
    return store.get_tags()


@router.post("", response_model=Tag, status_code=201)
def create_tag(body: TagCreate):
    store = get_library_store()
    return store.add_tag(body.model_dump())


@router.put("/{tag_id}", response_model=Tag)
def update_tag(tag_id: str, body: TagUpdate):
    store = get_library_store()
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    tag = store.update_tag(tag_id, updates)
    if tag is None:
        raise HTTPException(404, "Tag not found")
    return tag


@router.delete("/{tag_id}", status_code=204)
def delete_tag(tag_id: str):
    store = get_library_store()
    if not store.delete_tag(tag_id):
        raise HTTPException(404, "Tag not found")


@router.get("/{tag_id}/songs", response_model=list[Song])
def get_songs_for_tag(tag_id: str):
    store = get_library_store()
    if store.get_tag(tag_id) is None:
        raise HTTPException(404, "Tag not found")
    return store.get_songs_for_tag(tag_id)
