"""Song relationships and the type list the user edits (issue #81).

A relationship row stores the **id** of a type, never its name, so renaming a
type touches no row. The type list lives in `library.json` beside the tags and
the genres (REQ-14-RP), and this module is its single definition: the store
seeds it, the API edits it and the import maps imported rows onto it.
"""

from pydantic import BaseModel

SIDES = ("source", "target")

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


class RelationshipShapeError(ValueError):
    """A relationship row the model refuses (REQ-19-TM); the API answers 422."""


class TypedTrack(BaseModel):
    """A side of a transition that is not a library track (REQ-19-TM VC1-VC4).

    `artist` may be empty; `title` may not. An empty artist is stored as `""`,
    never `null`, so a typed side has one shape in `library.json` and in the
    export (21_DATA_MODEL › Typed sides).
    """

    artist: str = ""
    title: str


def clean_typed_track(value: dict | TypedTrack | None) -> dict | None:
    """A typed side as it is stored, or None when there is none.

    Args:
        value (dict | TypedTrack | None): The proposed side.

    Returns:
        dict | None: `{artist, title}`, both trimmed, or None.

    Raises:
        RelationshipShapeError: The title is blank; a typed side needs one.
    """
    if value is None:
        return None
    track = value.model_dump() if isinstance(value, TypedTrack) else dict(value)
    title = str(track.get("title") or "").strip()
    if not title:
        raise RelationshipShapeError("A typed side needs a title")
    artist = str(track.get("artist") or "").strip()
    return {"artist": artist, "title": title}


def validate_sides(row: dict) -> dict:
    """Enforce one side per end: a song id or a typed track, never both (VC1).

    Args:
        row (dict): A relationship as it is about to be stored.

    Returns:
        dict: The row with its typed sides cleaned and an absent `idea` dropped.

    Raises:
        RelationshipShapeError: A side has both forms or neither, a typed side
            has no title, or one song sits on both ends.
    """
    cleaned = dict(row)
    for side in SIDES:
        song_id = cleaned.get(f"{side}_song_id")
        typed = clean_typed_track(cleaned.get(f"{side}_track"))
        if bool(song_id) == bool(typed):
            raise RelationshipShapeError(
                f"The {side} of a relationship is a song id or a typed track, not both "
                f"and not neither"
            )
        cleaned[f"{side}_song_id"] = song_id or None
        cleaned[f"{side}_track"] = typed
    source, target = cleaned["source_song_id"], cleaned["target_song_id"]
    if source is not None and source == target:
        raise RelationshipShapeError("A transition from a track to itself is not a transition")
    if not cleaned.get("idea"):
        cleaned.pop("idea", None)
    return cleaned


def validate_typed_rules(row: dict) -> None:
    """Typed sides and `idea` belong to the transition type alone (VC1, TI VC5).

    Args:
        row (dict): A relationship whose sides are already validated.

    Raises:
        RelationshipShapeError: Another type carries a typed side or an idea.
    """
    if row.get("relationship_type") == TRANSITION_TYPE_ID:
        return
    if row.get("source_track") or row.get("target_track"):
        raise RelationshipShapeError("Only a transition can join a track that is not in the library")
    if row.get("idea"):
        raise RelationshipShapeError("Only a transition can be an idea")


def typed_track_key(track: dict | None) -> str:
    """The identity two typed sides share (REQ-19-TM VC14).

    Args:
        track (dict | None): A stored typed side, or None.

    Returns:
        str: `artist\\x00title`, lowercased, or "" for no typed side.
    """
    if not track:
        return ""
    artist = str(track.get("artist") or "").strip().casefold()
    title = str(track.get("title") or "").strip().casefold()
    return f"{artist}\u0000{title}"


def side_key(row: dict, side: str) -> str:
    """What a side names: a song id, or a typed side's identity.

    Args:
        row (dict): A relationship.
        side (str): "source" or "target".

    Returns:
        str: `song:<id>` or `typed:<artist\\x00title>`, and "" for no side.
    """
    song_id = row.get(f"{side}_song_id")
    if song_id:
        return f"song:{song_id}"
    typed = typed_track_key(row.get(f"{side}_track"))
    return f"typed:{typed}" if typed else ""



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
#:
#: A side is a song id **or** a typed track, never both (REQ-19-TM VC1). Only
#: the transition type takes a typed side or `idea`; a create on another type
#: simply leaves those fields out.
class SongRelationshipBase(BaseModel):
    source_song_id: str | None = None
    target_song_id: str | None = None
    source_track: TypedTrack | None = None
    target_track: TypedTrack | None = None
    relationship_type: str
    notes: str | None = None
    #: True when the transition is untried yet (REQ-19-TI). Absent means false.
    idea: bool = False


class SongRelationshipCreate(SongRelationshipBase):
    pass


class SongRelationshipUpdate(BaseModel):
    """The fields `PATCH /api/relationships/{id}` may change (REQ-19-TA, TM VC5).

    A field left out is untouched; `notes` set to `null` clears it. `link_side`
    names the end a link replaces, so the typed track there gives way to a song
    id and never the other way round (REQ-19-TM VC6).
    """

    notes: str | None = None
    idea: bool | None = None
    link_side: str | None = None
    song_id: str | None = None


class SongRelationship(SongRelationshipBase):
    id: str
    created_at: str
    #: The type's name as Settings shows it, filled in on a read. Not stored: the
    #: row keeps the id, so a rename rewrites no row (REQ-34-RT VC4).
    type_name: str | None = None
