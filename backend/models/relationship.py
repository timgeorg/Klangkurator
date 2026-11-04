"""Song relationships and the type list the user edits (issue #81).

A relationship row stores the **id** of a type, never its name, so renaming a
type touches no row. The type list lives in `library.json` beside the tags and
the genres (REQ-14-RP), and this module is its single definition: the store
seeds it, the API edits it and the import maps imported rows onto it.
"""

from pydantic import BaseModel

#: The transition type's id. The Transitions page, the set editor and the map
#: find transitions by this id, never by the name, so the user may rename it
#: (INV-26).
TRANSITION_TYPE_ID = "transition"

#: The palette's fallback (src/lib/palette.ts), for a type with no colour of its
#: own (REQ-14-RM VC11).
FALLBACK_COLOR = "#A1A2B3"

#: The six types a library without a stored list gets (REQ-14-RT VC1).
#:
#: `remix`, `same_sample` and `transition` reuse the old ids, so the update
#: rewrites no relationship row (REQ-14-RM). `works_as_mashup` and `same_vibe`
#: take the old colours of `mashup` and `edit`; `transition` keeps `null`, which
#: draws in the foreground colour.
DEFAULT_RELATIONSHIP_TYPES: tuple[dict, ...] = (
    {"id": "remix", "name": "is remix of", "color": "#6B5BD6", "both_ways": False, "opposite_id": "original"},
    {"id": "original", "name": "is original of", "color": "#6B5BD6", "both_ways": False, "opposite_id": "remix"},
    {"id": "same_sample", "name": "same sample", "color": "#C9A227", "both_ways": True, "opposite_id": None},
    {"id": "works_as_mashup", "name": "works as mashup", "color": "#E0607E", "both_ways": True, "opposite_id": None},
    {"id": TRANSITION_TYPE_ID, "name": TRANSITION_TYPE_ID, "color": None, "both_ways": False, "opposite_id": None},
    {"id": "same_vibe", "name": "same vibe", "color": "#4E9A2A", "both_ways": True, "opposite_id": None},
)

#: The labels the old fixed types had (REQ-14-RM VC5). A value outside this
#: table and outside the defaults takes the value as its name (VC10).
LEGACY_TYPE_NAMES: dict[str, str] = {
    "cover": "Cover",
    "edit": "Edit",
    "bootleg": "Bootleg",
    "mashup": "Mashup",
    "in_playlist": "In playlist",
}

#: The old fixed line colours (src/lib/relationshipStyle.ts), so an old row keeps
#: the line the user knows (REQ-14-RM VC11).
LEGACY_TYPE_COLORS: dict[str, str] = {
    "cover": "#2F6BD8",
    "edit": "#4E9A2A",
    "bootleg": "#B3684A",
    "mashup": "#E0607E",
    "in_playlist": "#6D7480",
}


class RelationshipTypeError(ValueError):
    """A type edit the app refuses; the API answers 422."""


class RelationshipTypeNotFound(LookupError):
    """The type id is not in the list; the API answers 404."""


class RelationshipTypeConflict(ValueError):
    """Another type already holds the name; the API answers 409."""


class UnknownRelationshipType(ValueError):
    """The id is not in the type list (INV-27); the API answers 422."""


class DuplicateRelationship(ValueError):
    """The library states this relationship already (REQ-14-RD); the API 409s."""


def default_types() -> list[dict]:
    """A fresh copy of the six defaults, safe to store and change.

    Returns:
        list[dict]: The default types, in the order Settings lists them.
    """
    return [dict(entry) for entry in DEFAULT_RELATIONSHIP_TYPES]


def legacy_type(value: str) -> dict:
    """The type an old relationship value becomes (REQ-14-RM VC5, VC10, VC11).

    Args:
        value (str): An old `relationship_type` the default list does not cover.

    Returns:
        dict: The type, with the old value as its id, the old label as its name
        and the old line colour, else the palette's fallback.
    """
    return {
        "id": value,
        "name": LEGACY_TYPE_NAMES.get(value, value),
        "color": LEGACY_TYPE_COLORS.get(value, FALLBACK_COLOR),
        "both_ways": False,
        "opposite_id": None,
    }


#: A relationship row. `relationship_type` holds the **id** of a type in the
#: list (INV-27); a rename changes the type's name and never this value.
class SongRelationshipBase(BaseModel):
    source_song_id: str
    target_song_id: str
    relationship_type: str
    notes: str | None = None


class SongRelationshipCreate(SongRelationshipBase):
    pass


class SongRelationship(SongRelationshipBase):
    id: str
    created_at: str
    #: The type's name as Settings shows it, filled in on a read. Not stored: the
    #: row keeps the id, so a rename rewrites no row (REQ-34-RT VC4).
    type_name: str | None = None
