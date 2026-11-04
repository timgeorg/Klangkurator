"""Relationship types the user edits (issue #81).

The type list is library vocabulary, like the genres, so its proof lives here:
the migration that gives every old row a type without rewriting one, the rules
that keep a pair mutual and one colour, the refusals that keep one fact from
showing twice, the deletion that converts or drops rows, and the export/import
round trip that remaps ids by name.

REQ-14-RT VC1-VC14, REQ-14-RD VC1-VC19, REQ-14-RP VC1-VC7, REQ-14-RM VC1-VC11.
"""

import json
import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.models.relationship import TRANSITION_TYPE_ID
from backend.storage import get_library_store

client = TestClient(app)


def _song(title="A", file_path="/m/a.mp3"):
    res = client.post("/api/songs", json={"title": title, "artist": "X", "file_path": file_path})
    assert res.status_code == 201, res.text
    return res.json()


def _types():
    res = client.get("/api/relationship-types")
    assert res.status_code == 200, res.text
    return res.json()


def _type_ids():
    return [entry["id"] for entry in _types()]


def _type_named(name):
    return next(entry for entry in _types() if entry["name"] == name)


def _link(source, target, type_id, notes=None):
    return client.post("/api/relationships", json={
        "source_song_id": source["id"],
        "target_song_id": target["id"],
        "relationship_type": type_id,
        "notes": notes,
    })


# ── The defaults (REQ-14-RT VC1) ────────────────────────


def test_a_fresh_library_shows_the_six_default_types():
    """VC1: the six names and the opposite pair are Tim's."""
    types = {entry["name"]: entry for entry in _types()}

    assert list(types) == [
        "is remix of", "is original of", "same sample",
        "works as mashup", "transition", "same vibe",
    ]
    assert types["is remix of"]["opposite_id"] == types["is original of"]["id"]
    assert types["is original of"]["opposite_id"] == types["is remix of"]["id"]
    assert types["same sample"]["both_ways"] is True
    assert types["works as mashup"]["both_ways"] is True
    assert types["same vibe"]["both_ways"] is True
    assert types["transition"]["both_ways"] is False
    assert types["transition"]["opposite_id"] is None


def test_the_pair_shares_one_colour():
    """REQ-14-RD VC10: a type and its opposite are one line."""
    remix = _type_named("is remix of")
    original = _type_named("is original of")

    assert remix["color"] == original["color"]


# ── The list in library.json (REQ-14-RP VC1, VC2) ───────


def test_the_type_list_lives_in_the_library_file():
    """VC1: beside the tags and the genres, so it travels with the library."""
    from backend.storage import get_library_store as store

    store().get_relationship_types()  # seeds on the read
    data = store()._data
    assert len(data["relationship_types"]) == 6
    assert data["relationship_types"][0]["id"] == "remix"


# ── Adding, renaming, colouring (REQ-14-RT VC2-VC7) ──────


def test_a_type_can_be_added_and_needs_a_name():
    """VC2: the app requires a name."""
    assert client.post("/api/relationship-types", json={"name": "   "}).status_code == 422
    assert client.post("/api/relationship-types", json={}).status_code == 422

    res = client.post("/api/relationship-types", json={"name": "is a bootleg of", "color": "#B3684A"})
    assert res.status_code == 201, res.text
    created = res.json()

    assert created["id"] not in {"remix", "original", "same_sample", "transition"}
    assert _type_named("is a bootleg of")["both_ways"] is False


def test_a_duplicate_name_is_refused_ignoring_case():
    """VC3: the comparison ignores case."""
    res = client.post("/api/relationship-types", json={"name": "Same Sample"})

    assert res.status_code == 409
    assert "same sample" in res.json()["detail"]


def test_a_rename_shows_on_every_relationship_at_once():
    """VC4: a row keeps the id, so no row changes."""
    a, b = _song("A", "/m/a.mp3"), _song("B", "/m/b.mp3")
    rel = _link(a, b, "remix").json()

    assert client.patch("/api/relationship-types/remix", json={"name": "is a rework of"}).status_code == 200

    rows = client.get("/api/relationships").json()
    assert [row["type_name"] for row in rows if row["id"] == rel["id"]] == ["is a rework of"]
    assert get_library_store().get_relationships()[0]["relationship_type"] == "remix"


def test_the_colour_of_one_type_changes_its_opposite_too():
    """REQ-14-RD VC10: a pair shares one colour."""
    client.patch("/api/relationship-types/remix", json={"color": "#C8102E"})

    assert _type_named("is remix of")["color"] == "#C8102E"
    assert _type_named("is original of")["color"] == "#C8102E"


def test_a_type_can_be_marked_both_ways_and_back():
    """VC6: the user sets the mark, and it clears a pair (REQ-14-RD VC13)."""
    client.patch("/api/relationship-types/remix", json={"both_ways": True})

    remix = _type_named("is remix of")
    original = _type_named("is original of")
    assert remix["both_ways"] is True
    assert remix["opposite_id"] is None
    assert original["opposite_id"] is None

    client.patch("/api/relationship-types/remix", json={"both_ways": False, "opposite_id": "original"})
    assert _type_named("is remix of")["opposite_id"] == "original"


def test_the_use_count_follows_the_rows():
    """VC7: Settings shows how many relationships use each type."""
    a, b = _song("A", "/m/a.mp3"), _song("B", "/m/b.mp3")
    _link(a, b, "remix")

    by_name = {entry["name"]: entry["uses"] for entry in _types()}
    assert by_name["is remix of"] == 1
    assert by_name["same vibe"] == 0


# ── Deleting (REQ-14-RT VC8, VC9, VC13) ─────────────────


def test_deleting_a_type_without_an_opposite_deletes_its_relationships():
    """VC9."""
    a, b = _song("A", "/m/a.mp3"), _song("B", "/m/b.mp3")
    _link(a, b, "same_vibe")

    body = client.delete("/api/relationship-types/same_vibe").json()

    assert body == {"id": "same_vibe", "converted": 0, "deleted": 1}
    assert client.get("/api/relationships").json() == []
    assert "same_vibe" not in _type_ids()


def test_deleting_a_type_with_an_opposite_converts_its_rows_and_swaps_the_sides():
    """VC13: the fact still reads true from the other side."""
    a, b = _song("A", "/m/a.mp3"), _song("B", "/m/b.mp3")
    rel = _link(a, b, "remix", notes="kept").json()

    body = client.delete("/api/relationship-types/remix").json()

    assert body == {"id": "remix", "converted": 1, "deleted": 0}
    row = client.get("/api/relationships").json()[0]
    assert row["id"] == rel["id"]
    assert row["relationship_type"] == "original"
    assert (row["source_song_id"], row["target_song_id"]) == (b["id"], a["id"])
    assert row["notes"] == "kept"
    assert row["type_name"] == "is original of"


def test_the_transition_type_cannot_be_deleted():
    """VC11, INV-26: whichever client asks."""
    res = client.delete(f"/api/relationship-types/{TRANSITION_TYPE_ID}")

    assert res.status_code == 422
    assert TRANSITION_TYPE_ID in _type_ids()


# ── The transition type keeps its shape (REQ-14-RT VC14, INV-26) ──


def test_the_transition_type_takes_only_a_name_and_a_colour():
    """VC14."""
    assert client.patch("/api/relationship-types/transition", json={"name": "transitions into"}).status_code == 200
    assert client.patch("/api/relationship-types/transition", json={"color": "#1E8C8C"}).status_code == 200

    assert client.patch("/api/relationship-types/transition", json={"both_ways": True}).status_code == 422
    assert client.patch("/api/relationship-types/transition", json={"opposite_id": "remix"}).status_code == 422

    transition = next(entry for entry in _types() if entry["id"] == TRANSITION_TYPE_ID)
    assert transition["name"] == "transitions into"
    assert transition["color"] == "#1E8C8C"
    assert transition["both_ways"] is False
    assert transition["opposite_id"] is None


# ── The opposite pair (REQ-14-RD VC1, VC2, VC14, VC15) ──


def test_naming_b_as_the_opposite_of_a_also_names_a_on_b():
    """VC2: the pair is mutual."""
    a = client.post("/api/relationship-types", json={"name": "is an edit of", "color": "#4E9A2A"}).json()
    b = client.post("/api/relationship-types", json={"name": "is edited by", "color": "#4E9A2A"}).json()

    client.patch(f"/api/relationship-types/{a['id']}", json={"opposite_id": b["id"]})

    assert _type_named("is an edit of")["opposite_id"] == b["id"]
    assert _type_named("is edited by")["opposite_id"] == a["id"]


def test_a_pair_takes_the_colour_of_the_type_the_user_edits():
    """VC15."""
    a = client.post("/api/relationship-types", json={"name": "is a cover of", "color": "#2F6BD8"}).json()
    b = client.post("/api/relationship-types", json={"name": "is covered by", "color": "#2F6BD8"}).json()

    client.patch(f"/api/relationship-types/{a['id']}", json={"opposite_id": b["id"], "color": "#7B3F8C"})

    assert _type_named("is a cover of")["color"] == "#7B3F8C"
    assert _type_named("is covered by")["color"] == "#7B3F8C"


def test_a_new_opposite_clears_the_old_one():
    """VC14: B and C were a pair; naming B as A's opposite frees C."""
    a = client.post("/api/relationship-types", json={"name": "A", "color": "#111111"}).json()
    b = client.post("/api/relationship-types", json={"name": "B", "color": "#111111"}).json()
    c = client.post("/api/relationship-types", json={"name": "C", "color": "#111111"}).json()
    client.patch(f"/api/relationship-types/{b['id']}", json={"opposite_id": c["id"]})

    client.patch(f"/api/relationship-types/{a['id']}", json={"opposite_id": b["id"]})

    assert _type_named("A")["opposite_id"] == b["id"]
    assert _type_named("B")["opposite_id"] == a["id"]
    assert _type_named("C")["opposite_id"] is None


def test_a_both_ways_type_cannot_be_an_opposite():
    """VC1 says the opposite is a one-way type; the app holds to it."""
    res = client.patch("/api/relationship-types/remix", json={"opposite_id": "same_sample"})

    assert res.status_code == 422
    assert "reads both ways" in res.json()["detail"]


# ── One fact, one row (REQ-14-RD VC8, VC9, INV-27) ──────


def test_the_same_pair_and_type_the_same_way_is_refused():
    """VC8: a notice says the relationship exists."""
    a, b = _song("A", "/m/a.mp3"), _song("B", "/m/b.mp3")
    assert _link(a, b, "remix").status_code == 201

    res = _link(a, b, "remix")

    assert res.status_code == 409
    assert len(client.get("/api/relationships").json()) == 1


def test_the_opposite_type_the_other_way_is_refused():
    """VC9: "is original of A" on B is the fact already stored."""
    a, b = _song("A", "/m/a.mp3"), _song("B", "/m/b.mp3")
    assert _link(a, b, "remix").status_code == 201

    res = _link(b, a, "original")

    assert res.status_code == 409


def test_a_both_ways_type_is_refused_either_way_round():
    """VC9."""
    a, b = _song("A", "/m/a.mp3"), _song("B", "/m/b.mp3")
    assert _link(a, b, "same_vibe").status_code == 201

    assert _link(b, a, "same_vibe").status_code == 409


def test_the_other_way_round_of_a_one_way_type_is_kept():
    """A→B and B→A of a one-way type are two facts, not one."""
    a, b = _song("A", "/m/a.mp3"), _song("B", "/m/b.mp3")
    assert _link(a, b, "transition").status_code == 201
    assert _link(b, a, "transition").status_code == 201

    assert len(client.get("/api/relationships").json()) == 2


def test_an_unknown_type_is_refused():
    """INV-27: no relationship names a type outside the list."""
    a, b = _song("A", "/m/a.mp3"), _song("B", "/m/b.mp3")

    res = _link(a, b, "made_up")

    assert res.status_code == 422
    assert "made_up" in res.json()["detail"]
    assert client.get("/api/relationships").json() == []


# ── Every row reads its type's name (REQ-34-RT VC4) ─────


def test_each_row_names_its_type_as_settings_shows_it():
    """REQ-34-RT VC4."""
    a, b = _song("A", "/m/a.mp3"), _song("B", "/m/b.mp3")
    _link(a, b, "remix")
    client.patch("/api/relationship-types/remix", json={"name": "is a rework of"})

    assert client.get("/api/relationships").json()[0]["type_name"] == "is a rework of"


# ── The migration (REQ-14-RM VC1-VC11) ───────────────────


def _legacy_library() -> dict:
    """A library in the shape the app wrote before this change.

    It holds Tim's two `remix` rows plus one of each old type and one value the
    old union never named, so every branch of the migration is exercised.
    """
    return {
        "_config": {},
        "songs": [
            {"id": "s1", "title": "A", "artist": "X", "file_path": "/m/a.mp3"},
            {"id": "s2", "title": "B", "artist": "X", "file_path": "/m/b.mp3"},
            {"id": "s3", "title": "C", "artist": "X", "file_path": "/m/c.mp3"},
        ],
        "tags": [],
        "genres": [],
        "song_tags": [],
        "relationships": [
            {"id": "r1", "source_song_id": "s1", "target_song_id": "s2",
             "relationship_type": "remix", "notes": "Remix of same song",
             "created_at": "2026-10-30T15:10:43+00:00"},
            {"id": "r2", "source_song_id": "s2", "target_song_id": "s3",
             "relationship_type": "same_sample", "notes": None,
             "created_at": "2026-10-30T15:17:55+00:00"},
            {"id": "r3", "source_song_id": "s3", "target_song_id": "s1",
             "relationship_type": "transition", "notes": "echo out",
             "created_at": "2026-10-31T09:00:00+00:00"},
            {"id": "r4", "source_song_id": "s1", "target_song_id": "s3",
             "relationship_type": "cover", "notes": None,
             "created_at": "2026-10-31T09:01:00+00:00"},
            {"id": "r5", "source_song_id": "s2", "target_song_id": "s1",
             "relationship_type": "bootleg", "notes": None,
             "created_at": "2026-10-31T09:02:00+00:00"},
            {"id": "r6", "source_song_id": "s3", "target_song_id": "s2",
             "relationship_type": "vibes", "notes": None,
             "created_at": "2026-10-31T09:03:00+00:00"},
        ],
        "playlists": [],
        "playlist_songs": [],
    }


@pytest.fixture
def legacy_library(tmp_path, monkeypatch):
    """A throwaway data folder holding the legacy file, read by a fresh store."""
    import backend.storage as storage

    data_dir = tmp_path / "klangkurator"
    data_dir.mkdir()
    path = data_dir / "library.json"
    path.write_text(json.dumps(_legacy_library()), encoding="utf-8")

    monkeypatch.setattr(storage, "LIBRARY_FILE", path)
    monkeypatch.setattr(storage, "_library_store", None)
    store = storage.get_library_store()
    return store, path


def test_the_migration_gives_every_row_a_type_and_drops_none(legacy_library):
    """VC1: each stored relationship has a type from the list."""
    store, _path = legacy_library
    known = {entry["id"] for entry in store.get_relationship_types()}

    rows = store.get_relationships()

    assert len(rows) == 6
    assert all(row["relationship_type"] in known for row in rows)


def test_the_old_ids_keep_their_meaning(legacy_library):
    """VC2, VC3, VC4: remix, same_sample and transition read as before."""
    store, _path = legacy_library
    names = {entry["id"]: entry["name"] for entry in store.get_relationship_types()}

    assert names["remix"] == "is remix of"
    assert names["same_sample"] == "same sample"
    assert names["transition"] == "transition"

    rows = {row["id"]: row for row in store.get_relationships()}
    assert (rows["r1"]["source_song_id"], rows["r1"]["target_song_id"]) == ("s1", "s2")
    assert (rows["r3"]["source_song_id"], rows["r3"]["target_song_id"]) == ("s3", "s1")


def test_an_old_type_keeps_a_type_of_its_own_with_its_old_label(legacy_library):
    """VC5, VC10, VC11: the old value is the id, the old label the name."""
    store, _path = legacy_library
    types = {entry["id"]: entry for entry in store.get_relationship_types()}

    assert types["cover"]["name"] == "Cover"
    assert types["cover"]["color"] == "#2F6BD8"
    assert types["bootleg"]["name"] == "Bootleg"
    assert types["bootleg"]["color"] == "#B3684A"
    # A value the old union never named keeps the value, and takes the fallback.
    assert types["vibes"]["name"] == "vibes"
    assert types["vibes"]["color"] == "#A1A2B3"


def test_an_old_type_is_added_only_when_a_row_uses_it(legacy_library):
    """VC6."""
    store, _path = legacy_library
    ids = {entry["id"] for entry in store.get_relationship_types()}

    assert "edit" not in ids
    assert "mashup" not in ids
    assert "in_playlist" not in ids


def test_the_migration_keeps_notes_and_creation_dates(legacy_library):
    """VC7."""
    store, _path = legacy_library
    rows = {row["id"]: row for row in store.get_relationships()}

    assert rows["r1"]["notes"] == "Remix of same song"
    assert rows["r1"]["created_at"] == "2026-10-30T15:10:43+00:00"
    assert rows["r4"]["created_at"] == "2026-10-31T09:01:00+00:00"


def test_a_second_load_writes_nothing(legacy_library):
    """VC8: the pass is idempotent, so the file is not rewritten."""
    store, path = legacy_library
    store.get_relationship_types()
    store.get_relationships()
    first = path.read_text(encoding="utf-8")
    stamp = path.stat().st_mtime_ns

    import backend.storage as storage

    storage._library_store = None
    again = storage.get_library_store()
    again.get_relationship_types()

    assert again.get_relationships() == store.get_relationships()
    assert path.read_text(encoding="utf-8") == first
    assert path.stat().st_mtime_ns == stamp


# ── The backup (REQ-14-RP VC4-VC7) ──────────────────────


def _envelope(data: dict) -> dict:
    return {
        "format": "klangkurator-library",
        "version": 1,
        "exported_at": "2026-11-04T00:00:00Z",
        "data": {
            "songs": [], "tags": [], "song_tags": [], "song_relationships": [],
            "playlists": [], "playlist_songs": [], "blocks": [], "sets": [],
            **data,
        },
    }


def test_the_export_carries_the_type_list():
    """VC4."""
    exported = client.get("/api/export").json()["data"]["relationship_types"]

    assert [entry["id"] for entry in exported][:3] == ["remix", "original", "same_sample"]
    assert exported[0]["name"] == "is remix of"


def test_an_import_adds_a_type_the_library_lacks():
    """VC5: the match is by name and ignores case."""
    envelope = _envelope({"relationship_types": [
        {"id": "theirs", "name": "IS A BOOTLEG OF", "color": "#B3684A", "both_ways": False, "opposite_id": None},
    ]})

    body = client.post("/api/import", json={"envelope": envelope, "resolutions": []}).json()

    assert body["summary"]["relationship_types_added"] == 1
    assert _type_named("IS A BOOTLEG OF")["color"] == "#B3684A"


def test_an_import_keeps_the_local_settings_of_a_type_both_have():
    """VC6: colour, both-ways mark and opposite stay local."""
    client.patch("/api/relationship-types/same_vibe", json={"color": "#1E8C8C"})
    envelope = _envelope({"relationship_types": [
        {"id": "theirs", "name": "Same Vibe", "color": "#999999", "both_ways": False, "opposite_id": "remix"},
    ]})

    client.post("/api/import", json={"envelope": envelope, "resolutions": []})

    vibe = _type_named("same vibe")
    assert vibe["color"] == "#1E8C8C"
    assert vibe["both_ways"] is True
    assert vibe["opposite_id"] is None


def test_an_import_remaps_the_type_id_of_a_row_by_name():
    """VC7: a row keeps the name of its type across two different ids."""
    envelope = _envelope({
        "songs": [
            {"id": "t1", "title": "Imported A", "artist": "Y", "file_path": "/m/ia.mp3"},
            {"id": "t2", "title": "Imported B", "artist": "Y", "file_path": "/m/ib.mp3"},
        ],
        "relationship_types": [
            {"id": "their_vibe", "name": "same vibe", "color": "#1E8C8C", "both_ways": True, "opposite_id": None},
        ],
        "song_relationships": [
            {"id": "rx", "source_song_id": "t1", "target_song_id": "t2",
             "relationship_type": "their_vibe", "notes": "n", "created_at": "2026-11-01T00:00:00Z"},
        ],
    })

    client.post("/api/import", json={"envelope": envelope, "resolutions": []})

    row = client.get("/api/relationships").json()[0]
    assert row["relationship_type"] == "same_vibe"
    assert row["type_name"] == "same vibe"


def test_an_old_envelope_without_types_maps_its_values_like_the_load():
    """REQ-14-RM VC9."""
    envelope = _envelope({
        "songs": [
            {"id": "t1", "title": "Old A", "artist": "Y", "file_path": "/m/oa.mp3"},
            {"id": "t2", "title": "Old B", "artist": "Y", "file_path": "/m/ob.mp3"},
        ],
        "song_relationships": [
            {"id": "rz", "source_song_id": "t1", "target_song_id": "t2",
             "relationship_type": "cover", "notes": None, "created_at": "2026-11-01T00:00:00Z"},
        ],
    })

    body = client.post("/api/import", json={"envelope": envelope, "resolutions": []}).json()

    assert body["valid"] is True
    row = client.get("/api/relationships").json()[0]
    assert row["relationship_type"] == "cover"
    assert row["type_name"] == "Cover"
