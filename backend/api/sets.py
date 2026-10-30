"""Sets CRUD endpoints."""

from fastapi import APIRouter, HTTPException

from backend.models.set import DJSet, DJSetBase, DJSetCreate, DJSetUpdate
from backend.storage import get_sets_store

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
