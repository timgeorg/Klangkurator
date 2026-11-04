"""Transitions the user saves, with a typed side or as an idea (issue #82).

The page's rules that live in the store: a side is a song id or a typed track,
never both; typed sides and `idea` belong to the transition type alone; no
self-pair; a typed pair is the same track when its artist and title match, case
ignored; a link replaces a typed side and refuses a self-pair or a restatement;
and an export/import round trip keeps a typed side.

REQ-19-TA VC4, VC7, VC8; REQ-19-TM VC1-VC3, VC6, VC9, VC12, VC14-VC16;
REQ-19-TI VC1, VC2, VC5, VC6, VC8.
"""

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.storage import get_library_store

client = TestClient(app)


def _song(title="A", artist="X", file_path="/m/a.mp3"):
    res = client.post("/api/songs", json={"title": title, "artist": artist, "file_path": file_path})
    assert res.status_code == 201, res.text
    return res.json()


def _typed(artist, title):
    return {"artist": artist, "title": title}


def _transition(source, target, **extra):
    """A POST body for a transition, with each side a song dict or a typed side."""
    def side(value, end):
        if value.get("id"):
            return {f"{end}_song_id": value["id"]}
        return {f"{end}_track": value}

    return client.post("/api/relationships", json={
        **side(source, "source"),
        **side(target, "target"),
        "relationship_type": "transition",
        **extra,
    })


def _stored():
    res = client.get("/api/relationships")
    assert res.status_code == 200, res.text
    return res.json()


# ── One form per side (REQ-19-TM VC1) ───────────────────


def test_a_side_is_a_song_id_or_a_typed_track():
    """VC1, VC3: both forms of a side are accepted, and both can be typed."""
    song = _song()

    library_side = _transition(song, _typed("Tate McRae", "Housewife"))
    both_typed = _transition(_typed("tatemcrae", "housewife"), _typed("hannah montana", "best of both worlds"))

    assert library_side.status_code == 201, library_side.text
    assert both_typed.status_code == 201, both_typed.text
    assert library_side.json()["source_song_id"] == song["id"]
    assert library_side.json()["target_track"] == {"artist": "Tate McRae", "title": "Housewife"}


def test_a_side_with_both_forms_is_refused():
    """VC1: never both."""
    song = _song()
    res = client.post("/api/relationships", json={
        "source_song_id": song["id"],
        "source_track": _typed("a", "b"),
        "target_track": _typed("c", "d"),
        "relationship_type": "transition",
    })

    assert res.status_code == 422
    assert "not both" in res.json()["detail"]


def test_a_side_with_neither_form_is_refused():
    """VC1: never neither."""
    res = client.post("/api/relationships", json={
        "target_track": _typed("c", "d"),
        "relationship_type": "transition",
    })

    assert res.status_code == 422
    assert "not both" in res.json()["detail"]


def test_a_typed_side_needs_a_title():
    """VC2: the artist is optional, the title is not."""
    res = _transition(_typed("tatemcrae", "   "), _typed("", "best of both worlds"))
    assert res.status_code == 422
    assert "title" in res.json()["detail"]

    no_artist = _transition(_typed("", "housewife"), _typed("hannah montana", "best of both worlds"))
    assert no_artist.status_code == 201, no_artist.text
    assert no_artist.json()["source_track"] == {"artist": "", "title": "housewife"}


# ── Typed sides belong to the transition type (VC1, TI VC5) ──


def test_only_a_transition_takes_a_typed_side():
    """A typed side on another type is refused."""
    res = client.post("/api/relationships", json={
        "source_track": _typed("a", "b"),
        "target_track": _typed("c", "d"),
        "relationship_type": "same_vibe",
    })

    assert res.status_code == 422
    assert "transition" in res.json()["detail"]


def test_only_a_transition_can_be_an_idea():
    """REQ-19-TI VC5: an idea is a transition."""
    first, second = _song("A", "X", "/m/a.mp3"), _song("B", "Y", "/m/b.mp3")
    res = client.post("/api/relationships", json={
        "source_song_id": first["id"],
        "target_song_id": second["id"],
        "relationship_type": "same_sample",
        "idea": True,
    })

    assert res.status_code == 422
    assert "idea" in res.json()["detail"]


def test_a_new_transition_is_not_an_idea_unless_asked():
    """REQ-19-TI VC2: off for a new transition."""
    first, second = _song("A", "X", "/m/a.mp3"), _song("B", "Y", "/m/b.mp3")

    plain = _transition(first, second)
    idea = _transition(first, _typed("c", "d"), idea=True)

    assert plain.status_code == 201 and plain.json()["idea"] is False
    assert idea.json()["idea"] is True


# ── The pairs the store refuses (VC15, VC16, REQ-19-TA VC7/VC8) ──


def test_a_transition_from_a_track_to_itself_is_refused():
    """REQ-19-TA VC7: one song on both ends."""
    song = _song()
    res = _transition(song, song)

    assert res.status_code == 422
    assert "itself" in res.json()["detail"]


def test_a_duplicate_transition_is_refused():
    """REQ-19-TA VC8, REQ-14-RD VC8: the same pair, the same way round."""
    first, second = _song("A", "X", "/m/a.mp3"), _song("B", "Y", "/m/b.mp3")
    assert _transition(first, second).status_code == 201

    again = _transition(first, second)
    assert again.status_code == 409
    assert "exists" in again.json()["detail"]


def test_a_typed_pair_is_the_same_track_case_ignored():
    """REQ-19-TM VC14: two typed sides match on artist and title, case ignored."""
    assert _transition(_typed("Tate McRae", "Housewife"), _typed("", "Best")).status_code == 201

    again = _transition(_typed("tate mcrae", "HOUSEWIFE"), _typed("", "best"))
    assert again.status_code == 409


def test_the_other_direction_of_a_typed_pair_is_its_own_row():
    """REQ-19-TL VC7: A → B and B → A are two rows."""
    assert _transition(_typed("a", "one"), _typed("b", "two")).status_code == 201
    assert _transition(_typed("b", "two"), _typed("a", "one")).status_code == 201
    assert len([row for row in _stored() if row["relationship_type"] == "transition"]) == 2


def test_a_library_song_never_matches_a_typed_side():
    """REQ-19-TM VC13: the app links no typed side by itself, so the two are apart."""
    song = _song("Housewife", "Tate McRae")
    assert _transition(song, _typed("", "Best")).status_code == 201

    same_text = _transition(_typed("Tate McRae", "Housewife"), _typed("", "Best"))
    assert same_text.status_code == 201


# ── The link (REQ-19-TM VC5, VC6, VC15, VC16) ───────────


def _one_typed_transition():
    res = _transition(_typed("tatemcrae", "housewife"), _typed("hannah montana", "best of both worlds"))
    assert res.status_code == 201, res.text
    return res.json()


def test_a_link_writes_the_song_id_in_place_of_the_typed_track():
    """VC6: the row shows the track, and the typed text is gone."""
    row = _one_typed_transition()
    song = _song("Housewife", "Tate McRae")

    res = client.patch(f"/api/relationships/{row['id']}", json={"link_side": "source", "song_id": song["id"]})

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["source_song_id"] == song["id"]
    assert body["source_track"] is None
    assert body["target_track"] == {"artist": "hannah montana", "title": "best of both worlds"}


def test_a_link_to_an_unknown_song_is_refused():
    """The library has no such track."""
    row = _one_typed_transition()
    res = client.patch(f"/api/relationships/{row['id']}", json={"link_side": "source", "song_id": "nope"})

    assert res.status_code == 422
    assert "not in the library" in res.json()["detail"]


def test_a_link_that_makes_a_self_pair_is_refused():
    """VC15."""
    row = _one_typed_transition()
    song = _song("Housewife", "Tate McRae")
    client.patch(f"/api/relationships/{row['id']}", json={"link_side": "source", "song_id": song["id"]})

    res = client.patch(f"/api/relationships/{row['id']}", json={"link_side": "target", "song_id": song["id"]})
    assert res.status_code == 422
    assert "itself" in res.json()["detail"]


def test_a_link_that_states_an_existing_transition_is_refused():
    """VC16, REQ-14-RD VC8."""
    first, second = _song("A", "X", "/m/a.mp3"), _song("B", "Y", "/m/b.mp3")
    assert _transition(first, second).status_code == 201
    row = _one_typed_transition()

    res = client.patch(f"/api/relationships/{row['id']}", json={"link_side": "source", "song_id": first["id"]})
    second_link = client.patch(f"/api/relationships/{row['id']}", json={"link_side": "target", "song_id": second["id"]})

    assert res.status_code == 200
    assert second_link.status_code == 409
    assert "exists" in second_link.json()["detail"]


def test_a_side_that_is_already_a_track_cannot_be_linked_again():
    """The link replaces a typed side, never an id."""
    first, second = _song("A", "X", "/m/a.mp3"), _song("B", "Y", "/m/b.mp3")
    row = _transition(first, second).json()

    res = client.patch(f"/api/relationships/{row['id']}", json={"link_side": "source", "song_id": second["id"]})
    assert res.status_code == 422
    assert "already a library track" in res.json()["detail"]


# ── Editing a note and the idea mark (REQ-19-TA VC9, TI VC1/VC3) ──


def test_the_note_and_the_idea_mark_change_in_place():
    """VC9, TI VC1: the row keeps its id, its type and its two sides."""
    first, second = _song("A", "X", "/m/a.mp3"), _song("B", "Y", "/m/b.mp3")
    row = _transition(first, second, notes="old").json()

    res = client.patch(f"/api/relationships/{row['id']}", json={"notes": "new", "idea": True})

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["id"] == row["id"]
    assert body["notes"] == "new"
    assert body["idea"] is True
    assert (body["source_song_id"], body["target_song_id"]) == (first["id"], second["id"])


def test_the_idea_mark_can_be_turned_off():
    """TI VC3: the mark is a state, not a one-way flag."""
    first, second = _song("A", "X", "/m/a.mp3"), _song("B", "Y", "/m/b.mp3")
    row = _transition(first, second, idea=True).json()

    res = client.patch(f"/api/relationships/{row['id']}", json={"idea": False})

    assert res.status_code == 200
    assert res.json()["idea"] is False


def test_a_patch_leaves_the_fields_it_does_not_name():
    """A field left out is untouched."""
    first, second = _song("A", "X", "/m/a.mp3"), _song("B", "Y", "/m/b.mp3")
    row = _transition(first, second, notes="keep me", idea=True).json()

    res = client.patch(f"/api/relationships/{row['id']}", json={"notes": "changed"})

    assert res.json()["idea"] is True


def test_a_patch_on_an_unknown_relationship_is_a_404():
    res = client.patch("/api/relationships/nope", json={"notes": "x"})
    assert res.status_code == 404


# ── What the readers do with a typed side (VC7, VC9, VC10, TI VC6, VC8) ──


def test_the_typed_transition_is_listed_for_its_library_side():
    """VC7: a transition that joins a track and a typed side lists on that track."""
    song = _song("Housewife", "Tate McRae")
    row = _transition(song, _typed("hannah montana", "best of both worlds")).json()

    res = client.get("/api/relationships", params={"song_id": song["id"]})

    assert [entry["id"] for entry in res.json()] == [row["id"]]
    assert res.json()[0]["target_track"]["title"] == "best of both worlds"


def test_a_typed_target_is_not_a_transition_suggestion():
    """VC9: there is no track to add."""
    song = _song("Housewife", "Tate McRae")
    _transition(song, _typed("hannah montana", "best of both worlds"))

    res = client.get(f"/api/songs/{song['id']}/transition-suggestions")

    assert res.status_code == 200
    assert res.json() == []


def test_a_transition_to_a_library_track_is_a_suggestion_with_its_idea_mark():
    """TI VC6: the set editor shows the mark."""
    first, second = _song("A", "X", "/m/a.mp3"), _song("B", "Y", "/m/b.mp3")
    _transition(first, second, notes="works", idea=True)

    rows = client.get(f"/api/songs/{first['id']}/transition-suggestions").json()

    assert [(row["song"]["id"], row["notes"], row["idea"]) for row in rows] == [(second["id"], "works", True)]


def test_deleting_a_linked_song_deletes_its_transition():
    """INV-6: a song's deletion still takes its relationships."""
    song = _song("Housewife", "Tate McRae")
    _transition(song, _typed("hannah montana", "best of both worlds"))

    assert client.delete(f"/api/songs/{song['id']}").status_code in (200, 204)

    assert _stored() == []


# ── Export and import keep a typed side (VC11, VC12) ────


def _envelope(data):
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


def test_the_export_carries_a_typed_side():
    """VC11."""
    _transition(_typed("tatemcrae", "housewife"), _typed("hannah montana", "best of both worlds"), idea=True)

    exported = client.get("/api/export").json()["data"]["song_relationships"]

    assert exported[0]["source_track"] == {"artist": "tatemcrae", "title": "housewife"}
    assert exported[0]["target_track"]["title"] == "best of both worlds"
    assert exported[0]["idea"] is True


def test_an_import_keeps_a_typed_side():
    """VC12: a typed side survives into a library that has no relationships."""
    envelope = _envelope({"song_relationships": [{
        "id": "rel-1",
        "source_song_id": None,
        "source_track": {"artist": "tatemcrae", "title": "housewife"},
        "target_song_id": None,
        "target_track": {"artist": "hannah montana", "title": "best of both worlds"},
        "relationship_type": "transition",
        "idea": True,
        "notes": "fits really well",
        "created_at": "2026-11-04T00:00:00Z",
    }]})

    preview = client.post("/api/import/preview", json=envelope)
    assert preview.status_code == 200, preview.text
    assert client.post("/api/import", json={"envelope": envelope}).status_code == 200

    rows = _stored()
    assert len(rows) == 1
    assert rows[0]["source_track"] == {"artist": "tatemcrae", "title": "housewife"}
    assert rows[0]["target_track"] == {"artist": "hannah montana", "title": "best of both worlds"}
    assert rows[0]["idea"] is True


def test_an_import_drops_a_side_that_names_nothing():
    """A row with neither form on a side names no track, so it is dropped."""
    envelope = _envelope({"song_relationships": [{
        "id": "rel-1",
        "source_song_id": None,
        "target_track": {"artist": "a", "title": "b"},
        "relationship_type": "transition",
        "created_at": "2026-11-04T00:00:00Z",
    }]})

    assert client.post("/api/import/preview", json=envelope).status_code == 200
    client.post("/api/import", json={"envelope": envelope})

    assert _stored() == []


def test_a_typed_side_survives_the_store_reload():
    """The row is written to library.json as it stands, so a restart keeps it."""
    _transition(_typed("tatemcrae", "housewife"), _typed("hannah montana", "best of both worlds"))

    stored = get_library_store().get_relationships()

    assert stored[0]["source_track"] == {"artist": "tatemcrae", "title": "housewife"}
    assert "idea" not in stored[0]
