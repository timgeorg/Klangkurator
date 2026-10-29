"""Export/import of Klangkurator-added metadata (issue #10, PF-83).

Covers the behavior contract's backend clauses: envelope shape, identity
matching and precedence, fill-never-clobber, the conflict + resolution flow,
tag identity by name, foreign-uuid protection, other-store skip rule, and the
removal of the old wholesale-replace import (the footgun regression).
"""

from fastapi.testclient import TestClient

from backend.main import app
from backend.storage import get_library_store

client = TestClient(app)


def _song(title="Sequence", artist="Kobosil", file_path="/m/sequence.mp3", **extra):
    body = {"title": title, "artist": artist, "file_path": file_path, **extra}
    res = client.post("/api/songs", json=body)
    assert res.status_code == 201, res.text
    return res.json()


def _tag(name, color="#ff0000"):
    res = client.post("/api/tags", json={"name": name, "color": color})
    assert res.status_code in (200, 201), res.text
    return res.json()


def _envelope(songs=None, tags=None, song_tags=None, **other):
    return {
        "format": "klangkurator-library",
        "version": 1,
        "exported_at": "2026-10-13T00:00:00Z",
        "data": {
            "songs": songs or [],
            "tags": tags or [],
            "song_tags": song_tags or [],
            "song_relationships": other.get("song_relationships", []),
            "playlists": other.get("playlists", []),
            "playlist_songs": other.get("playlist_songs", []),
            "blocks": other.get("blocks", []),
            "sets": other.get("sets", []),
        },
    }


# ── EC-1: export envelope ─────────────────────────────────────

def test_export_has_the_envelope_and_excludes_config():
    _song(energy=3.8)
    res = client.get("/api/export")
    assert res.status_code == 200
    d = res.json()
    assert d["format"] == "klangkurator-library"
    assert d["version"] == 1
    assert "exported_at" in d
    assert set(d["data"].keys()) == {
        "songs", "tags", "genres", "song_tags", "song_relationships",
        "playlists", "playlist_songs", "blocks", "sets",
    }
    assert "_config" not in d["data"]


# ── EC-2: foreign files are rejected ──────────────────────────

def test_preview_rejects_a_foreign_format():
    res = client.post("/api/import/preview", json={"format": "rekordbox", "data": {}})
    assert res.status_code == 422


def test_import_rejects_a_foreign_format():
    res = client.post(
        "/api/import", json={"envelope": {"format": "x", "data": {}}, "resolutions": []}
    )
    assert res.status_code == 422


def test_preview_rejects_an_unsupported_future_version():
    env = _envelope()
    env["version"] = 99
    res = client.post("/api/import/preview", json=env)
    assert res.status_code == 422


# ── MC-2/MC-3: fill-empty + matched tracks keep identity ──────

def test_fill_empty_fills_missing_fields_without_clobbering():
    local = _song(people=3)  # energy missing
    env = _envelope(songs=[{
        "id": "11111111-1111-1111-1111-111111111111",
        "title": local["title"], "artist": local["artist"],
        "file_path": "/other/machine/sequence.mp3",  # moved on disk
        "energy": 3.8, "people": 9,  # 9 is nonsense but non-empty
    }])
    plan = client.post("/api/import/preview", json=env).json()
    assert plan["summary"]["matched"] == 1
    assert plan["summary"]["conflicts"] == 1  # people 3 vs 9 differs
    assert plan["summary"]["filled"] >= 1     # energy was a silent fill
    # no overwrite resolution → local values kept; only the fill applies
    res2 = client.post("/api/import", json={"envelope": env, "resolutions": []})
    assert res2.status_code == 200
    after = client.get(f"/api/songs/{local['id']}").json()
    assert after["energy"] == 3.8          # filled from import
    assert after["people"] == 3            # local kept (no resolution)
    # MC-2: the local path is never overwritten by a moved-file import
    assert after["file_path"] == local["file_path"]


# ── MC-1: match precedence ────────────────────────────────────

def test_path_match_takes_precedence_over_artist_title():
    local = _song()  # /m/sequence.mp3
    env = _envelope(songs=[{
        "id": "22222222-2222-2222-2222-222222222222",
        "title": "Other Title", "artist": "Kobosil",  # different artist+title!
        "file_path": local["file_path"],               # but same path
    }])
    plan = client.post("/api/import/preview", json=env).json()
    assert plan["summary"]["matched"] == 1
    assert plan["summary"]["added"] == 0


def test_moved_file_matches_by_composite_duration_window():
    _song(file_path="/old/sequence.mp3", duration=337.0)
    env = _envelope(songs=[{
        "id": "33333333-3333-3333-3333-333333333333",
        "title": "Sequence", "artist": "Kobosil",
        "file_path": "/new/drive/sequence.mp3",
        "duration": 338.0,  # within ±2 s
    }])
    plan = client.post("/api/import/preview", json=env).json()
    assert plan["summary"]["matched"] == 1
    assert plan["summary"]["added"] == 0


def test_composite_miss_outside_duration_window_falls_to_artist_title():
    _song(file_path="/old/sequence.mp3", duration=337.0)
    env = _envelope(songs=[{
        "id": "34343434-3434-3434-3434-343434343434",
        "title": "Sequence", "artist": "Kobosil",
        "file_path": "/new/sequence.mp3",
        "duration": 350.0,  # >2 s away → plain artist+title still matches
    }])
    plan = client.post("/api/import/preview", json=env).json()
    assert plan["summary"]["matched"] == 1
    assert plan["summary"]["added"] == 0


def test_unknown_track_is_reported_as_added():
    env = _envelope(songs=[{
        "id": "44444444-4444-4444-4444-444444444444",
        "title": "Unknown Track", "artist": "Unknown Artist",
        "file_path": "/nowhere/x.mp3",
    }])
    plan = client.post("/api/import/preview", json=env).json()
    assert plan["summary"]["added"] == 1
    assert plan["summary"]["matched"] == 0


# ── MC-4: conflict popup semantics ────────────────────────────

def test_conflicts_list_carries_local_and_imported_values():
    local = _song(bpm=136.0)
    env = _envelope(songs=[{
        "id": "55555555-5555-5555-5555-555555555555",
        "title": local["title"], "artist": local["artist"],
        "file_path": local["file_path"], "bpm": 138.0,
    }])
    plan = client.post("/api/import/preview", json=env).json()
    assert plan["summary"]["conflicts"] == 1
    c = plan["conflicts"][0]
    assert c["field"] == "bpm"
    assert c["song_id"] == local["id"]
    assert c["song"] == "Sequence — Kobosil"


def test_resolution_overwrite_true_applies_false_keeps():
    local = _song(bpm=136.0)
    other = _song(title="Other", artist="Dold", file_path="/m/o.mp3", bpm=129.0)
    env = _envelope(songs=[
        {"id": "66666666-6666-6666-6666-666666666666",
         "title": local["title"], "artist": local["artist"],
         "file_path": local["file_path"], "bpm": 138.0},
        {"id": "67676767-7676-7676-7676-767676767676",
         "title": other["title"], "artist": other["artist"],
         "file_path": other["file_path"], "bpm": 131.0},
    ])
    resolutions = [
        {"song_id": local["id"], "field": "bpm", "overwrite": True},
        {"song_id": other["id"], "field": "bpm", "overwrite": False},
    ]
    res = client.post("/api/import", json={"envelope": env, "resolutions": resolutions})
    assert res.status_code == 200
    assert res.json()["summary"]["overwrites_applied"] == 1
    assert client.get(f"/api/songs/{local['id']}").json()["bpm"] == 138.0
    assert client.get(f"/api/songs/{other['id']}").json()["bpm"] == 129.0


# ── MC-5: uuid protection ─────────────────────────────────────

def test_added_tracks_get_fresh_uuids_not_the_exported_ones():
    env = _envelope(songs=[{
        "id": "77777777-7777-7777-7777-777777777777",
        "title": "Fresh", "artist": "New", "file_path": "/n/f.mp3",
    }])
    client.post("/api/import", json={"envelope": env, "resolutions": []})
    for s in client.get("/api/songs").json():
        if s["title"] == "Fresh":
            assert s["id"] != "77777777-7777-7777-7777-777777777777"


def test_uuid_collision_never_corrupts_an_unrelated_track():
    """The envelope carries a uuid that ALREADY belongs to a different local
    track (the hazard from the issue). The local song must survive untouched."""
    victim = _song(title="Victim", artist="A", file_path="/v.mp3", energy=4)
    env = _envelope(songs=[{
        "id": victim["id"],  # foreign machine re-used the local uuid!
        "title": "Malicious", "artist": "B", "file_path": "/x.mp3", "energy": 0.5,
    }])
    plan = client.post("/api/import/preview", json=env).json()
    assert plan["summary"]["added"] == 1
    client.post("/api/import", json={"envelope": env, "resolutions": []})
    after = client.get(f"/api/songs/{victim['id']}").json()
    assert after["title"] == "Victim"          # untouched
    assert after["energy"] == 4
    titles = [s["title"] for s in client.get("/api/songs").json()]
    assert "Malicious" in titles               # imported beside it, fresh id
    assert sum(1 for t in titles if t == "Victim") == 1


# ── TC-1/TC-2: tags by name, joins not duplicated ─────────────

def test_tags_match_by_name_and_joins_are_not_duplicated():
    local = _song()
    tag = _tag("Peak time", "#00ff00")
    client.post(f"/api/songs/{local['id']}/tags", json={"tag_id": tag["id"]})
    foreign_id = "99999999-9999-9999-9999-999999999999"
    env = _envelope(
        songs=[{
            "id": "88888888-8888-8888-8888-888888888888",
            "title": local["title"], "artist": local["artist"],
            "file_path": local["file_path"],
        }],
        tags=[
            {"id": foreign_id, "name": "Peak time", "color": "#123456",
             "created_at": "2020-01-01"},
            {"id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "name": "New tag",
             "color": "#00ff00", "created_at": "2020-01-01"},
        ],
        song_tags=[{  # same join the local library already has — must not dup
            "song_id": "88888888-8888-8888-8888-888888888888",
            "tag_id": foreign_id,
        }],
    )
    res = client.post("/api/import", json={"envelope": env, "resolutions": []})
    assert res.status_code == 200
    s = res.json()["summary"]
    assert s["tags_created"] == 1           # only "New tag"
    assert s["joins_added"] == 0            # join already present locally
    names = [t["name"] for t in client.get("/api/tags").json()]
    assert names.count("Peak time") == 1    # matched, not duplicated
    # local tag keeps its identity + color (TC-1: name is the identity)
    kept = next(t for t in client.get("/api/tags").json() if t["name"] == "Peak time")
    assert kept["id"] == tag["id"]
    assert kept["color"] == "#00ff00"


# ── OC-1: other stores ────────────────────────────────────────

def test_other_stores_import_into_empty_and_skip_when_occupied():
    # empty local stores → imported (with song-id remap, nested BlockSong shape)
    local = _song()
    export_song_id = "b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0"
    env = _envelope(
        songs=[{"id": export_song_id,
                "title": local["title"], "artist": local["artist"],
                "file_path": local["file_path"]}],
        blocks=[{"id": "c1c1c1c1-1111-1111-1111-111111111111",
                 "name": "Warmup", "color": "#ff0000",
                 "description": None,
                 "songs": [{"song_id": export_song_id, "position": 0},
                           {"song_id": export_song_id, "position": 1,
                            "transition_notes": "into"}],
                 "position": 0}],
    )
    res = client.post("/api/import", json={"envelope": env, "resolutions": []})
    assert res.status_code == 200
    exported = client.get("/api/export").json()["data"]["blocks"]
    warmup = next((b for b in exported if b.get("name") == "Warmup"), None)
    assert warmup, "block imported into the empty store"
    # the song references were remapped to the LOCAL id
    assert all(bs["song_id"] == local["id"] for bs in warmup["songs"])

    # now occupied local blocks + a second import → skipped + reported
    env2 = _envelope(
        songs=[{"id": "d2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2",
                "title": local["title"], "artist": local["artist"],
                "file_path": local["file_path"]}],
        blocks=[{"id": "e3e3e3e3-3333-3333-3333-333333333333",
                 "name": "Second", "color": "#00ff00",
                 "songs": [], "position": 0}],
    )
    plan = client.post("/api/import/preview", json=env2).json()
    assert plan["summary"]["skipped"].get("blocks") == 1
    client.post("/api/import", json={"envelope": env2, "resolutions": []})
    names = [b.get("name") for b in client.get("/api/export").json()["data"]["blocks"]]
    assert "Second" not in names  # skipped, nothing overwritten


# ── the footgun is gone ───────────────────────────────────────

def test_old_wholesale_replace_is_gone():
    """The pre-#10 POST /api/import with {"songs": [...]} emptied the library.
    A legacy-shaped body is not an envelope → rejected, nothing replaced."""
    _song(title="Keep 1", artist="A", file_path="/k1.mp3")
    _song(title="Keep 2", artist="B", file_path="/k2.mp3")
    res = client.post("/api/import", json={"songs": [], "tags": []})
    assert res.status_code == 422
    songs = client.get("/api/songs").json()
    assert {s["title"] for s in songs} >= {"Keep 1", "Keep 2"}


def test_import_summary_round_trip_counts():
    a = _song()
    env = _envelope(songs=[{
        "id": "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f0f0",
        "title": a["title"], "artist": a["artist"],
        "file_path": a["file_path"],
    }])
    res = client.post("/api/import", json={"envelope": env, "resolutions": []})
    s = res.json()["summary"]
    assert s["matched"] == 1 and s["added"] == 0


def test_a_matched_track_gets_its_main_genre_filled_and_conflicts_on_it():
    """`mainGenre` is a conflict field by its stored key: a matched track with
    none gets it filled, one with another genre gets a conflict to resolve."""
    empty = _song(title="Empty", file_path="/m/empty.mp3")
    house = _song(title="House", file_path="/m/house.mp3", mainGenre="House")
    env = _envelope(songs=[
        {"id": "a", "title": "Empty", "artist": empty["artist"], "file_path": "/m/empty.mp3", "mainGenre": "Techno"},
        {"id": "b", "title": "House", "artist": house["artist"], "file_path": "/m/house.mp3", "mainGenre": "Techno"},
    ])

    plan = client.post("/api/import/preview", json=env).json()
    assert [(c["song_id"], c["field"]) for c in plan["conflicts"]] == [(house["id"], "mainGenre")]

    res = client.post("/api/import", json={
        "envelope": env,
        "resolutions": [{"song_id": house["id"], "field": "mainGenre", "overwrite": True}],
    })
    assert res.status_code == 200
    store = get_library_store()
    assert store.get_song(empty["id"])["mainGenre"] == "Techno"
    assert store.get_song(house["id"])["mainGenre"] == "Techno"


# ── Genres in the envelope (issue #51) ──────────────────


def _envelope_with(data: dict) -> dict:
    """A minimal valid envelope carrying `data`."""
    return {
        "format": "klangkurator-library",
        "version": 1,
        "exported_at": "2026-10-29T00:00:00Z",
        "data": {
            "songs": [], "tags": [], "song_tags": [], "song_relationships": [],
            "playlists": [], "playlist_songs": [], "blocks": [], "sets": [],
            **data,
        },
    }


def test_the_export_carries_genres():
    """Genres are library vocabulary, so a backup includes them (NFR-2)."""
    client.put("/api/genres", json=[{"name": "Techno", "color": "#6B5BD6", "subgenres": ["Peak Time"]}])

    exported = client.get("/api/export").json()["data"]["genres"]

    assert exported == [{"name": "Techno", "color": "#6B5BD6", "subgenres": ["Peak Time"]}]


def test_importing_genres_adds_the_missing_ones():
    """A library without them gains them; nothing is replaced."""
    client.put("/api/genres", json=[{"name": "House", "color": "#4E9A2A", "subgenres": []}])
    envelope = _envelope_with({
        "genres": [
            {"name": "Techno", "color": "#6B5BD6", "subgenres": ["Peak Time"]},
        ],
    })

    body = client.post("/api/import", json={"envelope": envelope, "resolutions": []}).json()

    assert body["summary"]["genres_added"] == 1
    names = [g["name"] for g in client.get("/api/genres").json()]
    assert names == ["House", "Techno"]


def test_an_existing_genre_keeps_its_colour_and_gains_subgenres():
    """Default local wins: the user's colour is not overwritten."""
    client.put("/api/genres", json=[{"name": "Techno", "color": "#111111", "subgenres": ["Peak Time"]}])
    envelope = _envelope_with({
        "genres": [
            {"name": "techno", "color": "#999999", "subgenres": ["peak time", "Hard"]},
        ],
    })

    client.post("/api/import", json={"envelope": envelope, "resolutions": []})

    genres = client.get("/api/genres").json()
    assert len(genres) == 1
    assert genres[0]["color"] == "#111111"
    assert genres[0]["subgenres"] == ["Peak Time", "Hard"]


def test_an_envelope_without_genres_still_imports():
    """Exports made before this change have no `genres` key."""
    envelope = _envelope_with({"songs": [{
        "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "title": "Old", "artist": "A", "file_path": "/m/old.mp3",
    }]})

    body = client.post("/api/import", json={"envelope": envelope, "resolutions": []}).json()

    assert body["valid"] is True
    assert body["summary"]["genres_added"] == 0
