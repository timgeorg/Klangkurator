"""Song relationships and the relationship types the user edits (issue #81).

Two resources: a relationship row, which holds the id of a type, and the type
list itself. A read of either fills in what the other one knows, so a client
never has to join them by hand.
"""

import logging

from fastapi import APIRouter, HTTPException, Query

from backend.models.relationship import (
    DuplicateRelationship,
    RelationshipShapeError,
    RelationshipTypeConflict,
    RelationshipTypeError,
    RelationshipTypeNotFound,
    SongRelationship,
    SongRelationshipCreate,
    SongRelationshipUpdate,
    UnknownRelationshipType,
)
from backend.storage import get_library_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["relationships"])


def _with_type_name(store, row: dict) -> dict:
    """A relationship row with the name of its type, as Settings shows it.

    The name is added on the way out and never stored: the row keeps the id, so
    a rename rewrites no row (REQ-34-RT VC4).

    Args:
        store: The library store.
        row (dict): A stored relationship.

    Returns:
        dict: The row plus `type_name`, or None when the type is gone.
    """
    return {**row, "type_name": store.type_name(row.get("relationship_type", ""))}


@router.get("/relationships", response_model=list[SongRelationship])
def list_relationships(song_id: str | None = Query(None)):
    """Relationships, optionally only the ones touching a track.

    Args:
        song_id (str | None): Keep only relationships with this track.

    Returns:
        list[dict]: The rows, each with `type_name` filled in. A typed side comes
        back as `source_track` / `target_track` with no id beside it
        (REQ-19-TM VC10).
    """
    store = get_library_store()
    rows = store.get_relationships_for_song(song_id) if song_id else store.get_relationships()
    return [_with_type_name(store, row) for row in rows]


@router.post("/relationships", response_model=SongRelationship, status_code=201)
def create_relationship(body: SongRelationshipCreate):
    """Store a relationship.

    Args:
        body (SongRelationshipCreate): The relationship to store. A side is a
            song id or a typed track, never both (REQ-19-TM VC1).

    Returns:
        dict: The stored row, with its type's name.

    Raises:
        HTTPException: 404 for a song the library does not have, 422 for a type
            id outside the list or a row the model refuses, 409 for a
            relationship the library already states.
    """
    store = get_library_store()
    for field in ("source", "target"):
        song_id = getattr(body, f"{field}_song_id")
        if song_id and store.get_song(song_id) is None:
            raise HTTPException(404, f"{field.capitalize()} song not found")
    try:
        row = store.add_relationship(body.model_dump(exclude_none=True))
    except UnknownRelationshipType:
        raise HTTPException(
            422,
            f"Unknown relationship type “{body.relationship_type}”. "
            f"Add it in Settings first.",
        )
    except RelationshipShapeError as exc:
        raise HTTPException(422, str(exc))
    except DuplicateRelationship:
        raise HTTPException(409, "This relationship already exists")
    logger.info("Relationship created: %s", row["id"])
    return _with_type_name(store, row)


@router.patch("/relationships/{rel_id}", response_model=SongRelationship)
def update_relationship(rel_id: str, body: SongRelationshipUpdate):
    """Change a relationship's notes, its idea mark, or link a typed side.

    A link writes the song id in place of the typed track of `link_side`; it
    never creates a typed side and never links one by itself (REQ-19-TM VC13).

    Args:
        rel_id (str): The relationship to change.
        body (SongRelationshipUpdate): The fields to change.

    Returns:
        dict: The stored row, with its type's name.

    Raises:
        HTTPException: 404 for an unknown relationship, 422 for a refused link
            or idea, 409 for a link that would state an existing relationship.
    """
    store = get_library_store()
    changes = body.model_dump(exclude_unset=True)
    try:
        row = store.update_relationship(rel_id, changes)
    except RelationshipShapeError as exc:
        raise HTTPException(422, str(exc))
    except DuplicateRelationship:
        raise HTTPException(409, "This relationship already exists")
    if row is None:
        raise HTTPException(404, "Relationship not found")
    logger.info("Relationship updated: %s", rel_id)
    return _with_type_name(store, row)


@router.delete("/relationships/{rel_id}", status_code=204)
def delete_relationship(rel_id: str):
    """Delete one relationship."""
    store = get_library_store()
    if not store.delete_relationship(rel_id):
        raise HTTPException(404, "Relationship not found")


# ── The type list (REQ-14-RT) ────────────────────────────


@router.get("/relationship-types")
def list_relationship_types():
    """The type list, in the order Settings shows it, with its use counts.

    Returns:
        list[dict]: One `{id, name, color, both_ways, opposite_id, uses}` per
        type. `uses` is how many relationships the type has (REQ-14-RT VC7).
    """
    store = get_library_store()
    counts = store.relationship_type_uses()
    return [
        {**entry, "uses": counts.get(entry["id"], 0)}
        for entry in store.get_relationship_types()
    ]


@router.post("/relationship-types", status_code=201)
def create_relationship_type(body: dict):
    """Add a type.

    Args:
        body (dict): `{name, color, both_ways, opposite_id}`.

    Returns:
        dict: The stored type.

    Raises:
        HTTPException: 422 for a blank name or a contradictory mark; 409 for a
            name another type holds, case ignored.
    """
    try:
        return get_library_store().add_relationship_type(body)
    except RelationshipTypeConflict as exc:
        raise HTTPException(409, str(exc))
    except (RelationshipTypeError, RelationshipTypeNotFound) as exc:
        raise HTTPException(422, str(exc))


@router.patch("/relationship-types/{type_id}")
def update_relationship_type(type_id: str, body: dict):
    """Change a type's name, colour, both-ways mark or opposite.

    Args:
        type_id (str): The type to change.
        body (dict): The fields to change.

    Returns:
        dict: The stored type.

    Raises:
        HTTPException: 404 for an unknown id; 422 for a refused edit; 409 for a
            duplicate name.
    """
    try:
        return get_library_store().update_relationship_type(type_id, body)
    except RelationshipTypeNotFound:
        raise HTTPException(404, "Relationship type not found")
    except RelationshipTypeConflict as exc:
        raise HTTPException(409, str(exc))
    except RelationshipTypeError as exc:
        raise HTTPException(422, str(exc))


@router.delete("/relationship-types/{type_id}")
def delete_relationship_type(type_id: str):
    """Delete a type, converting its rows to its opposite or deleting them.

    Args:
        type_id (str): The type to delete.

    Returns:
        dict: `{id, converted, deleted}`.

    Raises:
        HTTPException: 404 for an unknown id; 422 for the transition type, which
            cannot be deleted (INV-26).
    """
    try:
        return get_library_store().delete_relationship_type(type_id)
    except RelationshipTypeNotFound:
        raise HTTPException(404, "Relationship type not found")
    except RelationshipTypeError as exc:
        raise HTTPException(422, str(exc))
