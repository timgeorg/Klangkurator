"""Sets CRUD endpoints."""

from fastapi import APIRouter, HTTPException

from backend.models.set import DJSet, DJSetCreate, DJSetUpdate
from backend.storage import get_sets_store

router = APIRouter(prefix="/api/sets", tags=["sets"])


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
    store = get_sets_store()
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    dj_set = store.update_set(set_id, updates)
    if dj_set is None:
        raise HTTPException(404, "Set not found")
    return dj_set


@router.delete("/{set_id}", status_code=204)
def delete_set(set_id: str):
    store = get_sets_store()
    if not store.delete_set(set_id):
        raise HTTPException(404, "Set not found")
