"""Library store — wraps library.json (songs, tags, genres, relationships, playlists)."""

import logging
import uuid
from datetime import datetime, timezone

from backend.models.relationship import (
    TRANSITION_TYPE_ID,
    DuplicateRelationship,
    RelationshipTypeConflict,
    RelationshipTypeError,
    RelationshipTypeNotFound,
    UnknownRelationshipType,
    default_types,
    legacy_type,
)
from backend.storage import crate_registry

logger = logging.getLogger(__name__)


def _new_id() -> str:
    return str(uuid.uuid4())


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clean_variants(variants) -> list[dict]:
    """Variant payloads as they are stored: no derived key.

    `missing` is computed from the filesystem on every read (issue #65). A
    stored copy would go stale the moment a file moved, so it never reaches
    library.json — and through it neither the export nor an import.
    """
    if not isinstance(variants, list):
        return []
    return [{k: v for k, v in dict(v).items() if k != "missing"} for v in variants]


def _with_clean_variants(row: dict) -> dict:
    """A song row or update with its variant list stripped of derived keys."""
    if "audio_variants" not in row:
        return row
    return {**row, "audio_variants": _clean_variants(row["audio_variants"])}


class LibraryStore:
    """CRUD for songs, tags, genres, song_tags, relationships, playlists, playlist_songs.

    Data is kept in memory and written back to library.json on every mutation.
    """

    def __init__(self, base_store):
        self._file = base_store._file_path
        self._data = base_store._data
        self._save_fn = base_store._save
        self._lock = base_store._lock

        # Ensure all top-level keys exist
        for key in ("songs", "tags", "genres", "song_tags", "relationships",
                    "playlists", "playlist_songs"):
            if key not in self._data:
                self._data[key] = []

        self._migrate_crates()
        self._migrate_relationship_types()

    def _migrate_crates(self) -> dict:
        """Bring the crate registry and the song rows up to date on read.

        The one-time pass the multi-location model needs (issue #11): a file
        written by the single-root model holds `root_folder` strings and a
        single `root_path`, and becomes a crate registry with `crate_id`s. The
        pass is idempotent, so a second read changes nothing and writes nothing.

        It also heals a registry that went missing or was hand-edited, which is
        why it runs on **every** read rather than behind a version flag: the
        song rows and the registry can only ever be in the one shape.

        Returns:
            dict: The pass's report — counters and any warning it logged.
        """
        config = self._data.get("_config")
        if not isinstance(config, dict):
            config = {}
            self._data["_config"] = config
        report = crate_registry.migrate(config, self._data["songs"])
        for warning in report["warnings"]:
            logger.warning("Crate registry: %s", warning)
        if report["changed"]:
            logger.info(
                "Crate registry updated: %d songs migrated, %d crates over %d music "
                "locations, %d rows left unresolved",
                report["songs_migrated"], report["crates"], report["locations"],
                len(report["songs_unresolved"]),
            )
            self._save_fn()
        return report

    def migrate_crates(self) -> dict:
        """Run the crate-registry pass again and report what it did.

        Read does it already; this is the seam a caller uses to see the report,
        and the seam the tests exercise.

        Returns:
            dict: The pass's report.
        """
        with self._lock:
            return self._migrate_crates()

    # ── Relationship types (issue #81) ─────────────────────

    def _migrate_relationship_types(self) -> bool:
        """Seed the type list on first read and keep it true to the rows.

        A library written before this change has no `relationship_types` key. It
        gets the six defaults, plus one type for each other value one of its
        relationship rows uses (REQ-14-RM VC5, VC10) — never a type nothing
        refers to (VC6). The pass is idempotent: once the key is there, nothing
        changes, so a second read writes nothing (VC8).

        Returns:
            bool: Whether the file was written.
        """
        # An empty list is seeded like an absent one: the transition type cannot
        # be deleted (INV-26), so a list without it can only be a file that was
        # hand-edited or a store that was reset. Seeding heals it, as the crate
        # registry pass does (issue #11).
        types = self._data.get("relationship_types")
        if isinstance(types, list) and types:
            return False

        types = default_types()
        known = {entry["id"] for entry in types}
        for row in self._data["relationships"]:
            value = row.get("relationship_type")
            if value and value not in known:
                types.append(legacy_type(value))
                known.add(value)
        self._data["relationship_types"] = types
        self._save_fn()
        logger.info(
            "Relationship types seeded: %d types for %d relationships",
            len(types), len(self._data["relationships"]),
        )
        return True

    def _type_by_id(self, type_id: str) -> dict | None:
        """The stored type with this id, or None.

        Seeds first: every path that resolves a type goes through here, so a
        list that was hand-edited to empty is healed before it can make a
        relationship look type-less (INV-26).

        Args:
            type_id (str): The id a relationship row stores.

        Returns:
            dict | None: The stored type.
        """
        self._type_list()
        for entry in self._data["relationship_types"]:
            if entry.get("id") == type_id:
                return entry
        return None

    def _require_type(self, type_id: str) -> dict:
        """The stored type with this id.

        Raises:
            RelationshipTypeNotFound: No type has the id.
        """
        entry = self._type_by_id(type_id)
        if entry is None:
            raise RelationshipTypeNotFound(type_id)
        return entry

    def _type_list(self) -> list[dict]:
        """The type list, seeded first and read under the save lock.

        Seeding happens here, not only in the constructor, so a list that was
        reset or hand-edited to empty is healed rather than left without a
        transition type (INV-26).

        Returns:
            list[dict]: The live list.
        """
        with self._lock:
            self._migrate_relationship_types()
        return self._data["relationship_types"]

    def get_relationship_types(self) -> list[dict]:
        """The type list, in the order Settings shows it.

        Returns:
            list[dict]: One `{id, name, color, both_ways, opposite_id}` per type.
        """
        return self._type_list()

    def get_relationship_type(self, type_id: str) -> dict | None:
        """One type by id, or None."""
        return self._type_by_id(type_id)

    def type_name(self, type_id: str) -> str | None:
        """The name Settings shows for a type id, or None for an unknown id.

        Args:
            type_id (str): The id a relationship row stores.

        Returns:
            str | None: The type's name.
        """
        entry = self._type_by_id(type_id)
        return entry["name"] if entry else None

    def relationship_type_uses(self) -> dict[str, int]:
        """How many relationships use each type id (REQ-14-RT VC7).

        Returns:
            dict[str, int]: Use counts by type id; a type with no row is absent.
        """
        counts: dict[str, int] = {}
        for row in self._data["relationships"]:
            value = row.get("relationship_type")
            counts[value] = counts.get(value, 0) + 1
        return counts

    def add_relationship_type(self, data: dict) -> dict:
        """Add a type to the end of the list.

        Args:
            data (dict): `{name, color, both_ways, opposite_id}`; `id` is made
                here when it is absent.

        Returns:
            dict: The stored type.

        Raises:
            RelationshipTypeError: The name is blank or a mark contradicts the
                pair.
            RelationshipTypeConflict: Another type holds the name, case ignored.
        """
        self._type_list()
        name = _clean_type_name(data.get("name"))
        _refuse_duplicate_name(self._data["relationship_types"], name, None)
        both_ways = bool(data.get("both_ways"))
        opposite_id = data.get("opposite_id") or None
        if both_ways and opposite_id:
            raise RelationshipTypeError("A type that reads both ways has no opposite")

        opposite = self._require_type(opposite_id) if opposite_id else None
        if opposite is not None and (opposite.get("both_ways") or opposite.get("id") == TRANSITION_TYPE_ID):
            raise RelationshipTypeError(
                f"“{opposite['name']}” reads both ways and cannot take an opposite"
            )

        color = data.get("color")
        entry = {
            "id": str(data.get("id") or _new_id()),
            "name": name,
            "color": color if isinstance(color, str) else None,
            "both_ways": both_ways,
            "opposite_id": opposite_id,
        }
        self._data["relationship_types"].append(entry)
        if opposite is not None:
            self._link_pair(entry, opposite, color)
        self._save_fn()
        logger.info("Relationship type added: %s (%s)", entry["name"], entry["id"])
        return entry

    def update_relationship_type(self, type_id: str, updates: dict) -> dict:
        """Change the fields named, keeping a pair mutual and one colour.

        A rename keeps every row's id, so each relationship of the type shows
        the new name at once (REQ-14-RT VC4). Naming a new opposite also names
        this type as the other one's opposite and clears any opposite that one
        had before (REQ-14-RD VC2, VC14). Marking a paired type both-ways clears
        the pair of both types (VC13).

        Args:
            type_id (str): The type to change.
            updates (dict): Any of `name`, `color`, `both_ways`, `opposite_id`.

        Returns:
            dict: The stored type.

        Raises:
            RelationshipTypeNotFound: No type has the id.
            RelationshipTypeError: The transition type would lose its shape, or
                a mark contradicts the pair (INV-26).
            RelationshipTypeConflict: Another type holds the name.
        """
        self._type_list()
        entry = self._require_type(type_id)
        name = _clean_type_name(updates.get("name", entry["name"]))
        _refuse_duplicate_name(self._data["relationship_types"], name, entry["id"])

        if entry["id"] == TRANSITION_TYPE_ID:
            _refuse_transition_resize(updates, entry)
            _apply_type_fields(entry, name, updates)
            self._save_fn()
            logger.info("Transition type updated: %s", entry["name"])
            return entry

        self._apply_pair_edit(entry, name, updates)
        self._save_fn()
        logger.info("Relationship type updated: %s (%s)", entry["name"], entry["id"])
        return entry

    def _apply_pair_edit(self, entry: dict, name: str, updates: dict) -> None:
        """Write a non-transition type's fields, then settle its pair.

        Args:
            entry (dict): The stored type.
            name (str): The name it takes.
            updates (dict): The fields the caller sent.

        Raises:
            RelationshipTypeError: A mark contradicts the pair, or the named
                opposite cannot take one.
        """
        both_ways = bool(updates.get("both_ways", entry["both_ways"]))
        opposite_id = updates.get("opposite_id", entry["opposite_id"]) or None
        if both_ways and opposite_id:
            if "opposite_id" in updates:
                raise RelationshipTypeError("A type that reads both ways has no opposite")
            # The mark wins, so the pair goes, on both sides (REQ-14-RD VC13).
            self._clear_pair(entry)
            opposite_id = None

        _apply_type_fields(entry, name, updates)
        entry["both_ways"] = both_ways
        entry["opposite_id"] = opposite_id if opposite_id != entry["id"] else None
        if entry["opposite_id"] is None:
            return
        opposite = self._require_type(entry["opposite_id"])
        if opposite.get("both_ways") or opposite["id"] == TRANSITION_TYPE_ID:
            raise RelationshipTypeError(
                f"“{opposite['name']}” reads both ways and cannot take an opposite"
            )
        self._link_pair(entry, opposite, entry.get("color"))

    def set_relationship_types(self, types: list[dict]) -> list[dict]:
        """Replace the type list, refusing a list that would break the app.

        The seam an import uses. A type the list lacks is not deleted from the
        rows: the caller converts or drops them first, so no relationship is
        left naming an unknown type (INV-27).

        Args:
            types (list[dict]): The new list.

        Returns:
            list[dict]: The stored list.

        Raises:
            ValueError: A type is malformed, an id repeats, a name repeats, an
                opposite names no type, or the transition type would lose its
                shape (INV-26).
        """
        _validate_relationship_types(types)
        self._data["relationship_types"] = types
        self._save_fn()
        logger.info("Relationship types written: %d", len(types))
        return self._data["relationship_types"]

    def _clear_pair(self, entry: dict) -> None:
        """Take the opposite link off a type and off the type that named it.

        Args:
            entry (dict): The type whose link goes.
        """
        former = self._type_by_id(entry.get("opposite_id")) if entry.get("opposite_id") else None
        if former is not None and former.get("opposite_id") == entry["id"]:
            former["opposite_id"] = None
        entry["opposite_id"] = None

    def _link_pair(self, entry: dict, opposite: dict, color: str | None) -> None:
        """Make two types each other's opposite, one colour, one former partner off.

        Args:
            entry (dict): The type the user just named.
            opposite (dict): Its new opposite.
            color (str | None): The colour the pair takes (REQ-14-RD VC15).
        """
        previous = opposite.get("opposite_id")
        if previous and previous != entry["id"]:
            stale = self._type_by_id(previous)
            if stale is not None and stale.get("opposite_id") == opposite["id"]:
                stale["opposite_id"] = None
        opposite["opposite_id"] = entry["id"]
        opposite["both_ways"] = False
        entry["both_ways"] = False
        pair_color = color if color is not None else entry.get("color")
        entry["color"] = pair_color
        opposite["color"] = pair_color

    def delete_relationship_type(self, type_id: str) -> dict:
        """Delete a type, keeping or converting its relationships.

        A type with an opposite hands its rows to that opposite with source and
        target swapped, so the fact still reads true (REQ-14-RT VC13). A type
        without one takes its rows with it (VC9). The transition type is refused
        whichever client asks (VC11, INV-26).

        Args:
            type_id (str): The type to delete.

        Returns:
            dict: `{id, converted, deleted}` — how many rows changed type and how
            many were removed.

        Raises:
            RelationshipTypeNotFound: No type has the id.
            RelationshipTypeError: The type is the transition type.
        """
        self._type_list()
        entry = self._require_type(type_id)
        if entry["id"] == TRANSITION_TYPE_ID:
            raise RelationshipTypeError(
                "The transition type cannot be deleted: the Transitions page, the "
                "set editor and the map find transitions by its id"
            )
        opposite = self._type_by_id(entry.get("opposite_id")) if entry.get("opposite_id") else None

        converted = deleted = 0
        kept: list[dict] = []
        for row in self._data["relationships"]:
            if row.get("relationship_type") != entry["id"]:
                kept.append(row)
                continue
            if opposite is None:
                deleted += 1
                continue
            converted += 1
            kept.append({
                **row,
                "source_song_id": row["target_song_id"],
                "target_song_id": row["source_song_id"],
                "relationship_type": opposite["id"],
            })
        self._data["relationships"] = kept
        self._data["relationship_types"] = [
            other for other in self._data["relationship_types"] if other["id"] != entry["id"]
        ]
        if opposite is not None and opposite.get("opposite_id") == entry["id"]:
            opposite["opposite_id"] = None
        self._save_fn()
        logger.info(
            "Relationship type deleted: %s (%d converted, %d deleted)",
            entry["name"], converted, deleted,
        )
        return {"id": entry["id"], "converted": converted, "deleted": deleted}

    # ── Songs ──────────────────────────────────────────────

    def get_songs(self) -> list[dict]:
        return self._data["songs"]

    def get_song(self, song_id: str) -> dict | None:
        for s in self._data["songs"]:
            if s["id"] == song_id:
                return s
        return None

    def add_song(self, song_data: dict) -> dict:
        song = {
            **_with_clean_variants(song_data),
            "id": _new_id(),
            "created_at": _now(),
            "updated_at": _now(),
        }
        self._data["songs"].append(song)
        self._save_fn()
        return song

    def update_song(self, song_id: str, updates: dict) -> dict | None:
        # Under the save lock: a save running in another thread never
        # serialises a song while it changes.
        clean = _with_clean_variants(updates)
        with self._lock:
            for s in self._data["songs"]:
                if s["id"] == song_id:
                    s.update(clean)
                    s["updated_at"] = _now()
                    self._save_fn()
                    return s
        return None

    def delete_song(self, song_id: str) -> bool:
        before = len(self._data["songs"])
        self._data["songs"] = [s for s in self._data["songs"] if s["id"] != song_id]
        if len(self._data["songs"]) == before:
            return False

        # Cascade: remove song_tags, relationships, playlist_songs
        self._data["song_tags"] = [st for st in self._data["song_tags"] if st["song_id"] != song_id]
        self._data["relationships"] = [
            r for r in self._data["relationships"]
            if r["source_song_id"] != song_id and r["target_song_id"] != song_id
        ]
        self._data["playlist_songs"] = [ps for ps in self._data["playlist_songs"] if ps["song_id"] != song_id]
        self._save_fn()
        return True

    def find_song_by_path(self, file_path: str) -> dict | None:
        for s in self._data["songs"]:
            if s["file_path"] == file_path:
                return s
        return None

    def find_song_by_any_path(self, file_path: str) -> dict | None:
        """The track that holds `file_path`, as its primary or as a variant.

        The scan asks this before it adds a row: a file that is already a
        variant of a track is not a new track (INV-14).

        Args:
            file_path (str): The absolute path to look for.

        Returns:
            dict | None: The owning song, or None.
        """
        for s in self._data["songs"]:
            if s.get("file_path") == file_path:
                return s
            for v in s.get("audio_variants") or []:
                if v.get("file_path") == file_path:
                    return s
        return None

    # ── Audio variants (issue #65, [[18_AUDIO_VARIANTS]]) ──

    def add_variant(self, song_id: str, variant: dict) -> dict | None:
        """Attach one more file to a track; the track keeps every other field.

        Args:
            song_id (str): The track.
            variant (dict): The variant, already carrying its format facts.

        Returns:
            dict | None: The updated song, or None for an unknown id.
        """
        song = self.get_song(song_id)
        if song is None:
            return None
        existing = list(song.get("audio_variants") or [])
        if any(v.get("file_path") == variant.get("file_path") for v in existing):
            return song
        return self.update_song(song_id, {"audio_variants": [*existing, variant]})

    def remove_variant(self, song_id: str, variant_id: str) -> dict | None:
        """Detach a variant from a track. The audio file stays on disk.

        Args:
            song_id (str): The track.
            variant_id (str): The variant to take off.

        Returns:
            dict | None: The updated song, or None when the track or the
            variant is unknown.
        """
        song = self.get_song(song_id)
        if song is None:
            return None
        variants = list(song.get("audio_variants") or [])
        kept = [v for v in variants if v.get("id") != variant_id]
        if len(kept) == len(variants):
            return None
        return self.update_song(song_id, {"audio_variants": kept})

    def make_primary(self, song_id: str, variant_id: str, demoted_facts: dict) -> dict | None:
        """Swap a variant with the primary. Only the paths change.

        The old primary becomes a variant described by `demoted_facts`, so a
        second *Make primary* returns to exactly the row the first one started
        from. BPM, key, ratings, notes and tags are untouched (AC-7).

        Args:
            song_id (str): The track.
            variant_id (str): The variant to promote.
            demoted_facts (dict): What the caller read from the current
                primary's file (`format`, `duration`, `bitrate`,
                `sample_rate`, `bit_depth`, `size_bytes`).

        Returns:
            dict | None: The updated song, or None for an unknown track or
            variant.
        """
        song = self.get_song(song_id)
        if song is None:
            return None
        variants = list(song.get("audio_variants") or [])
        promoted = next((v for v in variants if v.get("id") == variant_id), None)
        if promoted is None:
            return None
        demoted = {
            **demoted_facts,
            "id": _new_id(),
            "file_path": song["file_path"],
            "added_at": song.get("created_at") or _now(),
        }
        rest = [v for v in variants if v.get("id") != variant_id]
        return self.update_song(
            song_id,
            {
                "file_path": promoted["file_path"],
                "audio_variants": [*rest, _clean_variants([demoted])[0]],
            },
        )

    def find_song_by_artist_title(self, artist: str, title: str) -> dict | None:
        for s in self._data["songs"]:
            if s["artist"] == artist and s["title"] == title:
                return s
        return None

    # ── Tags ───────────────────────────────────────────────

    def get_tags(self) -> list[dict]:
        return self._data["tags"]

    def get_tag(self, tag_id: str) -> dict | None:
        for t in self._data["tags"]:
            if t["id"] == tag_id:
                return t
        return None

    def add_tag(self, tag_data: dict) -> dict:
        tag = {
            **tag_data,
            "id": _new_id(),
            "created_at": _now(),
        }
        self._data["tags"].append(tag)
        self._save_fn()
        return tag

    def update_tag(self, tag_id: str, updates: dict) -> dict | None:
        for t in self._data["tags"]:
            if t["id"] == tag_id:
                t.update(updates)
                self._save_fn()
                return t
        return None

    def delete_tag(self, tag_id: str) -> bool:
        before = len(self._data["tags"])
        self._data["tags"] = [t for t in self._data["tags"] if t["id"] != tag_id]
        if len(self._data["tags"]) == before:
            return False
        # Cascade
        self._data["song_tags"] = [st for st in self._data["song_tags"] if st["tag_id"] != tag_id]
        self._save_fn()
        return True

    # ── Song-Tags ──────────────────────────────────────────

    def get_song_tags(self) -> list[dict]:
        return self._data["song_tags"]

    def add_song_tag(self, song_id: str, tag_id: str) -> None:
        # Avoid duplicates
        for st in self._data["song_tags"]:
            if st["song_id"] == song_id and st["tag_id"] == tag_id:
                return
        self._data["song_tags"].append({"song_id": song_id, "tag_id": tag_id})
        self._save_fn()

    def remove_song_tag(self, song_id: str, tag_id: str) -> bool:
        before = len(self._data["song_tags"])
        self._data["song_tags"] = [
            st for st in self._data["song_tags"]
            if not (st["song_id"] == song_id and st["tag_id"] == tag_id)
        ]
        if len(self._data["song_tags"]) == before:
            return False
        self._save_fn()
        return True

    # ── Relationships ──────────────────────────────────────

    # ── Genres (issue #51: library content, so they travel with the export) ──

    def get_genres(self) -> list[dict]:
        """The genre list, each `{name, color, subgenres}`.

        Returns:
            list[dict]: The stored genres, in the user's order.
        """
        return self._data["genres"]

    def set_genres(self, genres: list[dict]) -> list[dict]:
        """Replace the genre list, refusing a malformed one.

        Args:
            genres (list[dict]): The new list.

        Returns:
            list[dict]: The stored list.

        Raises:
            ValueError: A genre is malformed, or a name repeats.
        """
        _validate_genres(genres)
        self._data["genres"] = genres
        self._save_fn()
        logger.info("Genres written: %d", len(genres))
        return self._data["genres"]

    def get_relationships(self) -> list[dict]:
        return self._data["relationships"]

    def add_relationship(self, rel_data: dict) -> dict:
        """Store one relationship, refusing an unknown type or a restatement.

        The refusal of a restatement is what keeps one fact from showing twice
        in opposite clothes: the same pair and type the same way round, the
        opposite type the other way round, or a both-ways type either way round
        (REQ-14-RD VC8, VC9). A type and its opposite also merge their two rows
        into the one the user stated, because the reading is symmetric.

        Args:
            rel_data (dict): `{source_song_id, target_song_id,
                relationship_type, notes}`; `relationship_type` is a type id.

        Returns:
            dict: The stored row.

        Raises:
            UnknownRelationshipType: No type in the list has the id (INV-27).
            DuplicateRelationship: The library states this relationship already.
        """
        rel_type = rel_data.get("relationship_type")
        entry = self._type_by_id(rel_type) if rel_type else None
        if entry is None:
            raise UnknownRelationshipType(str(rel_type))
        existing = self._find_restatement(rel_data, entry)
        if existing is not None:
            raise DuplicateRelationship(existing["id"])

        rel = {
            **rel_data,
            "id": _new_id(),
            "created_at": _now(),
        }
        self._data["relationships"].append(rel)
        self._save_fn()
        logger.info(
            "Relationship added: %s → %s (%s)",
            rel["source_song_id"], rel["target_song_id"], entry["name"],
        )
        return rel

    def _find_restatement(self, rel_data: dict, entry: dict) -> dict | None:
        """The stored row that already states this relationship, if any.

        Args:
            rel_data (dict): The relationship about to be stored.
            entry (dict): Its type.

        Returns:
            dict | None: The row that states the same fact.
        """
        source = rel_data["source_song_id"]
        target = rel_data["target_song_id"]
        type_id = entry["id"]
        opposite_id = entry.get("opposite_id")
        for row in self._data["relationships"]:
            same_way = row["source_song_id"] == source and row["target_song_id"] == target
            reverse_way = row["source_song_id"] == target and row["target_song_id"] == source
            if not (same_way or reverse_way):
                continue
            stored_type = row.get("relationship_type")
            # The same type the same way round, or in either direction when it
            # reads both ways (VC8, VC9).
            if stored_type == type_id and (same_way or entry.get("both_ways")):
                return row
            # The opposite type the other way round states the same fact (VC9).
            if opposite_id and stored_type == opposite_id and reverse_way:
                return row
        return None

    def delete_relationship(self, rel_id: str) -> bool:
        before = len(self._data["relationships"])
        self._data["relationships"] = [r for r in self._data["relationships"] if r["id"] != rel_id]
        if len(self._data["relationships"]) == before:
            return False
        self._save_fn()
        return True

    def get_relationships_for_song(self, song_id: str) -> list[dict]:
        return [
            r for r in self._data["relationships"]
            if r["source_song_id"] == song_id or r["target_song_id"] == song_id
        ]

    # ── Playlists ──────────────────────────────────────────

    def get_playlists(self) -> list[dict]:
        return self._data["playlists"]

    def get_playlist(self, playlist_id: str) -> dict | None:
        for p in self._data["playlists"]:
            if p["id"] == playlist_id:
                return p
        return None

    def add_playlist(self, playlist_data: dict) -> dict:
        playlist = {
            **playlist_data,
            "id": _new_id(),
            "created_at": _now(),
            "updated_at": _now(),
        }
        self._data["playlists"].append(playlist)
        self._save_fn()
        return playlist

    def update_playlist(self, playlist_id: str, updates: dict) -> dict | None:
        for p in self._data["playlists"]:
            if p["id"] == playlist_id:
                p.update(updates)
                p["updated_at"] = _now()
                self._save_fn()
                return p
        return None

    def delete_playlist(self, playlist_id: str) -> bool:
        before = len(self._data["playlists"])
        self._data["playlists"] = [p for p in self._data["playlists"] if p["id"] != playlist_id]
        if len(self._data["playlists"]) == before:
            return False
        self._data["playlist_songs"] = [ps for ps in self._data["playlist_songs"] if ps["playlist_id"] != playlist_id]
        self._save_fn()
        return True

    # ── Playlist-Songs ─────────────────────────────────────

    def get_playlist_songs(self) -> list[dict]:
        return self._data["playlist_songs"]

    def add_playlist_song(self, playlist_id: str, song_id: str, position: int | None = None) -> dict:
        if position is None:
            # Append at end
            max_pos = max(
                (ps["position"] for ps in self._data["playlist_songs"] if ps["playlist_id"] == playlist_id),
                default=-1,
            )
            position = max_pos + 1
        ps = {"playlist_id": playlist_id, "song_id": song_id, "position": position}
        self._data["playlist_songs"].append(ps)
        self._save_fn()
        return ps

    def remove_playlist_song(self, playlist_id: str, song_id: str) -> bool:
        before = len(self._data["playlist_songs"])
        self._data["playlist_songs"] = [
            ps for ps in self._data["playlist_songs"]
            if not (ps["playlist_id"] == playlist_id and ps["song_id"] == song_id)
        ]
        if len(self._data["playlist_songs"]) == before:
            return False
        self._save_fn()
        return True

    # ── Queries ────────────────────────────────────────────

    def get_tags_for_song(self, song_id: str) -> list[dict]:
        tag_ids = {st["tag_id"] for st in self._data["song_tags"] if st["song_id"] == song_id}
        return [t for t in self._data["tags"] if t["id"] in tag_ids]

    def get_songs_for_tag(self, tag_id: str) -> list[dict]:
        song_ids = {st["song_id"] for st in self._data["song_tags"] if st["tag_id"] == tag_id}
        return [s for s in self._data["songs"] if s["id"] in song_ids]

    def get_related_songs(self, song_id: str) -> list[dict]:
        results = []
        for r in self._data["relationships"]:
            if r["source_song_id"] == song_id:
                target = self.get_song(r["target_song_id"])
                if target:
                    results.append({"song": target, "relationship": r, "direction": "source"})
            elif r["target_song_id"] == song_id:
                source = self.get_song(r["source_song_id"])
                if source:
                    results.append({"song": source, "relationship": r, "direction": "target"})
        return results

    def get_transition_suggestions(self, song_id: str) -> list[dict]:
        suggestions = []
        for r in self._data["relationships"]:
            if r["source_song_id"] == song_id and r["relationship_type"] == "transition":
                target = self.get_song(r["target_song_id"])
                if target:
                    suggestions.append({"song": target, "notes": r.get("notes")})
        return suggestions

    def get_playlists_for_song(self, song_id: str) -> list[dict]:
        results = []
        for ps in self._data["playlist_songs"]:
            if ps["song_id"] == song_id:
                playlist = self.get_playlist(ps["playlist_id"])
                if playlist:
                    results.append({"playlist": playlist, "position": ps["position"]})
        return results

    # ── Config ─────────────────────────────────────────────

    def get_config(self, key: str, default=None):
        """Read a config value from library.json."""
        config = self._data.get("_config", {})
        return config.get(key, default)

    def set_config(self, key: str, value) -> None:
        """Write a config value to library.json."""
        if "_config" not in self._data:
            self._data["_config"] = {}
        self._data["_config"][key] = value
        self._save_fn()

    # ── Music locations and crates (issue #11) ─────────────
    # A music location is a folder scanned like a root. A crate is a folder
    # inside one, with an id, a name and the location that holds it. Both live
    # in `_config`, so they travel with the library and survive a restart.

    def get_locations(self) -> list[dict]:
        """The music locations, each `{id, path}` in path order.

        Returns:
            list[dict]: The stored locations.
        """
        return list(crate_registry.location_lookup(self._data.get("_config", {})).values())

    def get_crates(self) -> list[dict]:
        """The crates, each `{id, name, location_path}`, in name order.

        Returns:
            list[dict]: The stored crates.
        """
        crates = crate_registry.crate_lookup(self._data.get("_config", {}))
        return sorted(crates.values(), key=lambda c: (c["name"].casefold(), c["location_path"]))

    def add_location(self, path: str) -> dict:
        """Register a music location and adopt the crates already under it.

        A location that is already registered is returned unchanged, so a
        repeated add (a retry, a second tab) changes nothing.

        Args:
            path (str): The folder to scan as a music location.

        Returns:
            dict: `{id, path, added_crates}` — how many crates the location
            brought with it.
        """
        normalized = crate_registry.normalize_path(path)
        # Register against the current shape: a location added to a file that
        # still holds `root_folder` strings must see the crates it adopts.
        self._migrate_crates()
        config = self._data.setdefault("_config", {})
        locations = crate_registry.location_lookup(config)
        crates = crate_registry.crate_lookup(config)

        location = locations.get(crate_registry.location_id(normalized))
        if location is None:
            location = {"id": crate_registry.location_id(normalized), "path": normalized}
            locations[location["id"]] = location
        # Songs already in the library are adopted by path — the same rule a
        # rescan uses. This is what makes re-adding a removed location bring
        # its songs back, and it is safe to repeat: the file path is the
        # identity, so a second add finds the same crate.
        added = self._adopt_orphans(normalized, crates)
        self._write_registry(locations, crates)
        return {**location, "added_crates": added}

    def _adopt_orphans(self, location_path: str, crates: dict) -> int:
        """Point songs that sit under a location at the crates of that location.

        Args:
            location_path (str): The location just added.
            crates (dict): The crate registry, updated in place.

        Returns:
            int: How many crates the adoption created or reused.
        """
        added = 0
        for song in self._data["songs"]:
            file_path = song.get("file_path")
            if not isinstance(file_path, str) or not file_path:
                continue
            if crate_registry.location_of([location_path], file_path) is None:
                continue
            name = crate_registry.crate_name_for(location_path, file_path)
            crate = crate_registry.crate_id(location_path, name)
            if crate not in crates:
                crates[crate] = {"id": crate, "name": name, "location_path": location_path}
                added += 1
            if song.get(crate_registry.SONG_KEY) != crate:
                song[crate_registry.SONG_KEY] = crate
            # The flag clears whenever the location holds the file again, not
            # only when the id changed: crate ids are derived from the path, so
            # a re-added location restores the very same id and a "did it
            # change" test would leave the song flagged missing forever.
            song.pop(crate_registry.MISSING_KEY, None)
        return added

    def remove_location(self, location_id: str) -> dict | None:
        """Unregister a music location and flag its songs as missing.

        Nothing is deleted: the songs, their notes, tags and ratings stay, and
        each gets `missing_since`. Re-adding the location re-resolves them by
        path, because the crate ids are derived from the path.

        Args:
            location_id (str): The location to remove.

        Returns:
            dict | None: `{id, path, songs_flagged, crates_removed}`, or None
            when no location carries that id.
        """
        self._migrate_crates()
        config = self._data.setdefault("_config", {})
        locations = crate_registry.location_lookup(config)
        crates = crate_registry.crate_lookup(config)
        location = locations.pop(location_id, None)
        if location is None:
            return None

        removed = {
            key for key, crate in crates.items()
            if crate["location_path"] == location["path"]
        }
        for key in removed:
            crates.pop(key, None)

        flagged = 0
        stamp = _now()
        for song in self._data["songs"]:
            if song.get(crate_registry.SONG_KEY) in removed:
                song[crate_registry.MISSING_KEY] = stamp
                flagged += 1
        self._write_registry(locations, crates)
        return {**location, "songs_flagged": flagged, "crates_removed": len(removed)}

    def crates_of_location(self, location_id: str) -> list[dict]:
        """The crates one music location holds.

        Args:
            location_id (str): The location's id.

        Returns:
            list[dict]: The crates, in name order; empty for an unknown id.
        """
        location = crate_registry.location_lookup(self._data.get("_config", {})).get(location_id)
        if location is None:
            return []
        return [crate for crate in self.get_crates() if crate["location_path"] == location["path"]]

    def _write_registry(self, locations: dict, crates: dict) -> None:
        """Persist the two registries in their stored order.

        Args:
            locations (dict): Locations by id.
            crates (dict): Crates by id.
        """
        config = self._data.setdefault("_config", {})
        config[crate_registry.LOCATION_KEY] = [
            locations[key] for key in sorted(locations, key=lambda k: locations[k]["path"])
        ]
        config[crate_registry.CRATE_KEY] = [
            crates[key]
            for key in sorted(crates, key=lambda k: (crates[k]["name"].casefold(), crates[k]["location_path"]))
        ]
        self._save_fn()


def _validate_relationship_types(types) -> None:
    """Refuse a type list that would break the picker, the legends or the map.

    Args:
        types: The proposed list.

    Raises:
        ValueError: It is not a list of `{id, name, color, both_ways,
            opposite_id}`, an id or a name repeats, an opposite names no type
            or itself, a both-ways type carries an opposite, a pair is not
            mutual, or the transition type is not the one-way type INV-26
            requires.
    """
    if not isinstance(types, list):
        raise ValueError("Relationship types must be a list")
    _validate_type_entries(types)
    by_id = {entry["id"]: entry for entry in types}
    for entry in types:
        _validate_type_pair(entry, by_id)
    _validate_transition_type(by_id.get(TRANSITION_TYPE_ID))


def _validate_type_entries(types: list) -> None:
    """Each entry is well formed, and no id or name repeats.

    Args:
        types (list): The proposed list.

    Raises:
        ValueError: An entry is malformed, or an id or a name repeats.
    """
    ids: set[str] = set()
    names: set[str] = set()
    for entry in types:
        if not isinstance(entry, dict):
            raise ValueError("Each relationship type must be an object")
        type_id = entry.get("id")
        name = entry.get("name")
        if not isinstance(type_id, str) or not type_id.strip():
            raise ValueError("A relationship type needs an id")
        if not isinstance(name, str) or not name.strip():
            raise ValueError(f"Relationship type “{type_id}” needs a non-empty name")
        color = entry.get("color")
        if color is not None and not isinstance(color, str):
            raise ValueError(f"Relationship type “{name}” needs a colour or null")
        if type_id in ids:
            raise ValueError(f"Duplicate relationship type id: {type_id}")
        if name.strip().casefold() in names:
            raise ValueError(f"Duplicate relationship type name: {name}")
        ids.add(type_id)
        names.add(name.strip().casefold())


def _validate_type_pair(entry: dict, by_id: dict) -> None:
    """One entry's opposite link holds, on both sides.

    Args:
        entry (dict): The type to check.
        by_id (dict): The list's types by id.

    Raises:
        ValueError: A both-ways type carries an opposite, the opposite is
            absent, itself, both-ways, not mutual, or a different colour.
    """
    both_ways = bool(entry.get("both_ways"))
    opposite_id = entry.get("opposite_id")
    if both_ways and opposite_id:
        raise ValueError(f"“{entry['name']}” reads both ways and cannot have an opposite")
    if opposite_id is None:
        return
    opposite = by_id.get(opposite_id)
    if opposite is None:
        raise ValueError(f"“{entry['name']}” names an opposite that is not in the list")
    if opposite_id == entry["id"]:
        raise ValueError(f"“{entry['name']}” cannot be its own opposite")
    if opposite.get("both_ways"):
        raise ValueError(f"“{opposite['name']}” reads both ways and cannot be an opposite")
    if opposite.get("opposite_id") != entry["id"]:
        raise ValueError(f"“{entry['name']}” and “{opposite['name']}” are not mutual opposites")
    if opposite.get("color") != entry.get("color"):
        raise ValueError(f"“{entry['name']}” and “{opposite['name']}” must share one colour")


def _validate_transition_type(transition: dict | None) -> None:
    """The transition type is in the list, one-way and without an opposite.

    Args:
        transition (dict | None): The entry with the fixed transition id.

    Raises:
        ValueError: It is absent, or it is not the one-way type INV-26 requires.
    """
    if transition is None:
        raise ValueError("The transition type must be in the list (INV-26)")
    if transition.get("both_ways") or transition.get("opposite_id"):
        raise ValueError("The transition type always reads one way and has no opposite")


def _apply_type_fields(entry: dict, name: str, updates: dict) -> None:
    """Write the name and, when sent, the colour a type takes.

    Args:
        entry (dict): The stored type.
        name (str): The name it takes.
        updates (dict): The fields the caller sent; `color` is optional.
    """
    entry["name"] = name
    if "color" in updates:
        entry["color"] = updates["color"] if isinstance(updates["color"], str) else None


def _clean_type_name(name) -> str:
    """A relationship type's name, trimmed.

    Args:
        name: The proposed name.

    Returns:
        str: The name without surrounding space.

    Raises:
        RelationshipTypeError: The name is blank or not text.
    """
    if not isinstance(name, str) or not name.strip():
        raise RelationshipTypeError("A relationship type needs a non-empty name")
    return name.strip()


def _refuse_duplicate_name(types: list[dict], name: str, own_id: str | None) -> None:
    """Refuse a name another type already holds, ignoring case (REQ-14-RT VC3).

    Args:
        types (list[dict]): The type list.
        name (str): The proposed name.
        own_id (str | None): The type being renamed, so its own name passes.

    Raises:
        RelationshipTypeConflict: Another type holds the name.
    """
    key = name.casefold()
    for entry in types:
        if entry.get("id") != own_id and str(entry.get("name", "")).strip().casefold() == key:
            raise RelationshipTypeConflict(
                f"A relationship type named “{entry['name']}” already exists"
            )


def _refuse_transition_resize(updates: dict, entry: dict) -> None:
    """Refuse any edit to the transition type beyond its name and colour.

    The Transitions page, the set editor and the map find transitions by this
    id, so it must stay one-way and without an opposite (INV-26).

    Args:
        updates (dict): The fields the caller sent.
        entry (dict): The stored transition type.

    Raises:
        RelationshipTypeError: A mark or an opposite was sent, or a value would
            change one.
    """
    if "both_ways" in updates and bool(updates["both_ways"]) != bool(entry["both_ways"]):
        raise RelationshipTypeError(
            "The transition type always reads one way; only its name and colour change"
        )
    if "opposite_id" in updates and (updates["opposite_id"] or None) != entry.get("opposite_id"):
        raise RelationshipTypeError(
            "The transition type has no opposite; only its name and colour change"
        )


def _validate_genres(genres) -> None:
    """Refuse a genre list that would break the Settings page.

    Args:
        genres: The proposed list.

    Raises:
        ValueError: It is not a list of `{name, color, subgenres}`, a name is
            blank, or two names match case-insensitively.
    """
    if not isinstance(genres, list):
        raise ValueError("Genres must be a list")
    seen: set[str] = set()
    for genre in genres:
        if not isinstance(genre, dict):
            raise ValueError("Each genre must be an object")
        name = genre.get("name")
        if not isinstance(name, str) or not name.strip():
            raise ValueError("A genre needs a non-empty name")
        if not isinstance(genre.get("color"), str):
            raise ValueError(f"Genre “{name}” needs a colour")
        subgenres = genre.get("subgenres", [])
        if not isinstance(subgenres, list) or not all(isinstance(s, str) for s in subgenres):
            raise ValueError(f"Genre “{name}” needs a list of subgenres")
        key = name.strip().casefold()
        if key in seen:
            raise ValueError(f"Duplicate genre name: {name}")
        seen.add(key)
