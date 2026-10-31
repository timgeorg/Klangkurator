"""Music locations and the crate registry (issue #11).

A crate used to be a derived string on the song (`root_folder`), so two folders
called "House" in two places collapsed into one crate. A crate is now a
registry entry `{id, name, location_path}` and a song carries its id.

The migration is the load-bearing part, so its proof lives here: the real
library's shape is reproduced as a fixture and the pass is checked for
conservation, a 1:1 name mapping, idempotency and self-healing.
"""

import json
import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.storage import crate_registry as reg
from backend.storage import get_library_store

client = TestClient(app)


def _legacy_library() -> dict:
    """A library in the single-root shape, shaped like the real one.

    Three crates, one of them nested, one file directly in the root, and one
    crate whose files sit **outside** the configured root (the real library has
    exactly that: 92 songs under `/home/tim/Vault/downloads/…`).
    """
    root = "/media/tim/Extreme SSD/#MUSIC"
    return {
        "_config": {"root_path": root},
        "songs": [
            {"id": "s1", "file_path": f"{root}/house/tims-classic-house/a.mp3", "root_folder": "house/tims-classic-house"},
            {"id": "s2", "file_path": f"{root}/house/tims-classic-house/b.mp3", "root_folder": "house/tims-classic-house"},
            {"id": "s3", "file_path": f"{root}/techno/deep/c.mp3", "root_folder": "techno/deep"},
            {"id": "s4", "file_path": f"{root}/loose.mp3", "root_folder": "#MUSIC"},
            {"id": "s5", "file_path": "/home/tim/downloads/classic-techno/d.mp3", "root_folder": "classic-techno"},
        ],
        "tags": [],
        "genres": [],
        "song_tags": [],
        "relationships": [],
        "playlists": [],
        "playlist_songs": [],
    }


@pytest.fixture
def legacy() -> dict:
    """A copy of the legacy library, migrated."""
    data = _legacy_library()
    reg.migrate(data["_config"], data["songs"])
    return data


# ── The migration is safe ───────────────────────────────


def test_migration_keeps_every_song_and_resolves_every_crate(legacy):
    """Conservation: nothing is dropped, and every row points at a real crate.

    This is the proof the real library passed: 1,907 songs in, 1,907 out, and
    not one row whose crate id the registry does not know.
    """
    songs = legacy["songs"]
    crates = reg.crate_lookup(legacy["_config"])

    assert len(songs) == 5
    assert all(song.get("crate_id") for song in songs)
    assert all(song["crate_id"] in crates for song in songs)
    assert not any("root_folder" in song for song in songs)


def test_every_old_name_maps_to_exactly_one_crate(legacy):
    """No old `root_folder` value splits into two crates, none merges."""
    before = _legacy_library()["songs"]
    crates = reg.crate_lookup(legacy["_config"])
    mapped = {}
    for old, new in zip(before, legacy["songs"]):
        mapped.setdefault(old["root_folder"], set()).add(crates[new["crate_id"]]["name"])

    assert mapped == {
        "house/tims-classic-house": {"house/tims-classic-house"},
        "techno/deep": {"techno/deep"},
        "#MUSIC": {"#MUSIC"},
        "classic-techno": {"classic-techno"},
    }


def test_the_crate_names_are_preserved_so_an_upgrade_renames_nothing(legacy):
    """Tim's crates keep the names he knows when the app is upgraded."""
    crates = reg.crate_lookup(legacy["_config"])
    assert sorted(crate["name"] for crate in crates.values()) == [
        "#MUSIC", "classic-techno", "house/tims-classic-house", "techno/deep",
    ]


def test_the_migration_discovers_the_crate_outside_the_root(legacy):
    """A folder that is not under the configured root becomes its own location.

    The real library needed this: the 92 `classic-techno-groove-techno` songs
    live under `/home/tim/Vault/downloads`, not on the music drive.
    """
    locations = sorted(loc["path"] for loc in reg.location_lookup(legacy["_config"]).values())
    assert locations == [
        "/home/tim/downloads/classic-techno",
        "/media/tim/Extreme SSD/#MUSIC",
    ]


def test_the_root_key_is_consumed(legacy):
    """The single-root key is gone, so no state exists where both shapes do."""
    assert reg.LEGACY_ROOT_KEY not in legacy["_config"]


def test_a_second_run_changes_nothing(legacy):
    """Idempotent: a second read finds nothing, so the file is not rewritten."""
    snapshot = json.loads(json.dumps(legacy))
    report = reg.migrate(legacy["_config"], legacy["songs"])

    assert report["changed"] is False
    assert report["songs_migrated"] == 0
    assert legacy == snapshot


@pytest.mark.parametrize(
    "broken",
    [
        pytest.param(None, id="absent"),
        pytest.param("not a list", id="wrong type"),
        pytest.param([None, 3, {"name": ""}, {"name": "x"}], id="junk entries"),
        pytest.param([{"id": "x", "name": "House"}], id="no location"),
    ],
)
def test_a_broken_registry_self_heals_instead_of_raising(legacy, broken):
    """A hand-edited or truncated registry is rebuilt, never fatal."""
    snapshot = json.loads(json.dumps(legacy))
    if broken is None:
        snapshot["_config"].pop(reg.CRATE_KEY, None)
        snapshot["_config"].pop(reg.LOCATION_KEY, None)
    else:
        snapshot["_config"][reg.CRATE_KEY] = broken

    report = reg.migrate(snapshot["_config"], snapshot["songs"])

    crates = reg.crate_lookup(snapshot["_config"])
    assert report["changed"] is True
    assert len(crates) == 4
    assert all(song["crate_id"] in crates for song in snapshot["songs"])


def test_a_row_with_no_path_is_kept_and_not_blanked():
    """No data loss: an unreadable row keeps its old value and is reported."""
    data = _legacy_library()
    data["songs"][0]["file_path"] = ""
    report = reg.migrate(data["_config"], data["songs"])

    kept = data["songs"][0]
    assert len(data["songs"]) == 5
    assert kept["root_folder"] == "house/tims-classic-house"
    assert "crate_id" not in kept
    assert kept["id"] in report["songs_unresolved"]


def test_an_unknown_crate_id_is_re_resolved_from_the_path(legacy):
    """An id the registry lost is repaired from the file, which is the truth."""
    legacy["songs"][0]["crate_id"] = "crate_from_another_machine"
    reg.migrate(legacy["_config"], legacy["songs"])

    crates = reg.crate_lookup(legacy["_config"])
    assert legacy["songs"][0]["crate_id"] in crates
    assert crates[legacy["songs"][0]["crate_id"]]["name"] == "house/tims-classic-house"


# ── Identity ────────────────────────────────────────────


def test_two_crates_with_one_name_stay_two_crates():
    """The point of the registry: a name collision is no longer a bug."""
    config = {"music_locations": [{"path": "/a"}, {"path": "/b"}]}
    songs = [
        {"id": "s1", "file_path": "/a/House/x.mp3", "root_folder": "House"},
        {"id": "s2", "file_path": "/b/House/y.mp3", "root_folder": "House"},
    ]
    # The legacy pass would need a root; give each location its own entry.
    songs[0]["root_folder"] = "House"
    reg.migrate(config, songs)
    crates = reg.crate_lookup(config)

    assert songs[0]["crate_id"] != songs[1]["crate_id"]
    assert len(crates) == 2
    assert {crate["name"] for crate in crates.values()} == {"House"}


def test_the_crate_id_is_derived_from_the_path_not_minted():
    """A re-added location re-resolves its songs, so the id must be stable."""
    assert reg.crate_id("/music", "house") == reg.crate_id("/music", "house")
    assert reg.crate_id("/music", "house") != reg.crate_id("/other", "house")
    assert reg.crate_id("/music", "house") != reg.crate_id("/music", "techno")


def test_a_nested_location_wins_over_its_parent():
    """A crate that is itself a location keeps its own crates."""
    found = reg.location_of(["/music", "/music/house"], "/music/house/deep/x.mp3")
    assert found == "/music/house"


def test_a_file_in_the_location_root_is_a_crate_named_after_it():
    """The rule the scan has always used, now in one place."""
    assert reg.crate_name_for("/media/x/#MUSIC", "/media/x/#MUSIC/a.mp3") == "#MUSIC"
    assert reg.crate_name_for("/media/x/#MUSIC", "/media/x/#MUSIC/house/a.mp3") == "house"


# ── The API ─────────────────────────────────────────────


def _music_tree(tmp_path: Path, name: str = "music") -> Path:
    """A location with two crates and one loose file."""
    root = tmp_path / name
    (root / "house" / "deep").mkdir(parents=True)
    (root / "techno").mkdir(parents=True)
    (root / "loose.mp3").write_bytes(b"")
    (root / "house" / "deep" / "a.mp3").write_bytes(b"")
    (root / "techno" / "b.mp3").write_bytes(b"")
    return root


def test_a_location_is_added_once_and_lists_its_crates(tmp_path):
    """Adding twice changes nothing; the crates list carries ids and counts."""
    root = _music_tree(tmp_path)
    store = get_library_store()

    first = store.add_location(str(root))
    second = store.add_location(str(root))

    assert first["id"] == second["id"]
    assert [loc["path"] for loc in store.get_locations()] == [str(root.resolve())]

    store._data["songs"] = [
        {"id": "s1", "file_path": f"{root}/house/deep/a.mp3"},
        {"id": "s2", "file_path": f"{root}/techno/b.mp3"},
    ]
    store.migrate_crates()
    bodies = client.get("/api/library/crates").json()
    assert {(row["name"], row["track_count"]) for row in bodies} == {
        ("house/deep", 1), ("techno", 1),
    }
    assert all(row["id"].startswith("crate_") for row in bodies)


def test_removing_a_location_flags_its_songs_and_deletes_nothing(tmp_path):
    """The removal rule: flagged missing, never deleted; re-adding restores."""
    root = _music_tree(tmp_path)
    store = get_library_store()
    location = store.add_location(str(root))
    store._data["songs"] = [
        {"id": "s1", "file_path": f"{root}/house/deep/a.mp3"},
        {"id": "s2", "file_path": f"{root}/techno/b.mp3"},
    ]
    store.migrate_crates()
    before = {song["id"]: dict(song) for song in store._data["songs"]}

    result = store.remove_location(location["id"])

    assert result["songs_flagged"] == 2
    assert len(store._data["songs"]) == 2, "removal must not delete a row"
    for song in store._data["songs"]:
        assert song["missing_since"]
        assert song["file_path"] == before[song["id"]]["file_path"]

    store.add_location(str(root))
    for song in store._data["songs"]:
        assert "missing_since" not in song
        assert song["crate_id"] in {crate["id"] for crate in store.get_crates()}


def test_an_absent_location_is_a_no_op_with_a_warning(tmp_path, monkeypatch):
    """A drive that is not mounted must not disturb the other locations."""
    from backend.api import library as library_api

    root = _music_tree(tmp_path)
    store = get_library_store()
    location = store.add_location(str(root))
    store._data["songs"] = [{"id": "s1", "file_path": f"{root}/techno/b.mp3"}]
    store.migrate_crates()
    before = [dict(song) for song in store._data["songs"]]
    # The drive is gone: the folder is unregistered as an existing directory.
    monkeypatch.setattr(library_api, "scan_directory", lambda path: pytest.fail("scanned an absent folder"))
    shutil.rmtree(root)

    res = client.post("/api/library/scan", json={"location_id": location["id"]})

    assert res.status_code == 200
    body = res.json()
    assert body["started"] is False
    assert "not there" in body["warning"]
    assert store._data["songs"] == before


def test_rescanning_a_location_does_not_duplicate_its_songs(tmp_path, monkeypatch):
    """`find_song_by_path` still guards the same file under two locations."""
    from backend.api import library as library_api

    root = _music_tree(tmp_path, "first")
    other = _music_tree(tmp_path, "second")
    store = get_library_store()
    monkeypatch.setattr(library_api, "extract_metadata", lambda path: {"title": Path(path).stem, "artist": "A"})
    monkeypatch.setattr(library_api, "compute_peaks", lambda path: None)
    monkeypatch.setattr(library_api, "extract_artwork", lambda path, song_id: None)

    for file_path in sorted(root.rglob("*.mp3")):
        library_api._import_file(store, root, file_path)
    assert len(store.get_songs()) == 3

    # The very same files, seen through a second location that contains the
    # first: the path is the identity, so nothing is added twice.
    for file_path in sorted(root.rglob("*.mp3")):
        library_api._import_file(store, other, file_path)
    assert len(store.get_songs()) == 3


def test_a_removed_location_leaves_its_songs_in_no_crate(tmp_path):
    """The crate leaves the registry with its location; the songs stay rows.

    A missing song is not "in" a crate that no longer exists: it carries the
    flag instead. What must not happen is the row disappearing or losing the
    data the user typed.
    """
    root = _music_tree(tmp_path)
    store = get_library_store()
    location = store.add_location(str(root))
    store._data["songs"] = [
        {"id": "s1", "file_path": f"{root}/techno/b.mp3", "drum_notes": "kept"}
    ]
    store.migrate_crates()

    store.remove_location(location["id"])

    rows = client.get("/api/library/crates").json()
    assert all(row["name"] != "techno" for row in rows)
    song = store.get_song("s1")
    assert song["drum_notes"] == "kept"
    assert song["missing_since"]


# ── The data-dir guard ──────────────────────────────────


def test_the_data_dir_guard_refuses_a_home_resolved_too_early(tmp_path, monkeypatch):
    """`DATA_DIR` is frozen at import; the guard turns a stale resolve into an error.

    On 2026-10-31 an ad-hoc probe imported `backend` before pointing HOME at a
    scratch folder, so the store it built held the real path and wrote over the
    real library. The guard makes that import order fail loudly instead.
    """
    from backend import config

    monkeypatch.setattr(config, "DATA_DIR", Path("/home/someone/.klangkurator"))
    monkeypatch.setenv(config.SAFE_HOME_ENV, str(tmp_path))

    with pytest.raises(RuntimeError, match="imported before HOME"):
        config.ensure_data_dir()


def test_the_data_dir_guard_allows_the_required_home(tmp_path, monkeypatch):
    """The guard is silent when the resolve did land inside the scratch home."""
    from backend import config

    scratch = tmp_path / ".klangkurator"
    monkeypatch.setattr(config, "DATA_DIR", scratch)
    monkeypatch.setenv(config.SAFE_HOME_ENV, str(tmp_path))

    config.ensure_data_dir()

    assert scratch.is_dir()


# ── Two paths a mutation showed were untested ───────────


def test_a_removed_crate_is_not_resurrected_by_the_next_read():
    """Removal stays removed: the self-heal must leave a flagged song alone.

    Without this, the pass that repairs a lost crate id would rebuild the crate
    of a song whose location the user removed, undoing the removal on the very
    next read.
    """
    data = _legacy_library()
    reg.migrate(data["_config"], data["songs"])
    location = next(
        loc for loc in data["_config"][reg.LOCATION_KEY]
        if loc["path"] == "/media/tim/Extreme SSD/#MUSIC"
    )

    # Remove the location the way the store does: drop its crates, flag its rows.
    victims = {c["id"] for c in reg.crate_lookup(data["_config"]).values()
               if c["location_path"] == location["path"]}
    data["_config"][reg.CRATE_KEY] = [
        c for c in data["_config"][reg.CRATE_KEY] if c["id"] not in victims
    ]
    data["_config"][reg.LOCATION_KEY] = [
        loc for loc in data["_config"][reg.LOCATION_KEY] if loc["id"] != location["id"]
    ]
    for song in data["songs"]:
        if song["crate_id"] in victims:
            song[reg.MISSING_KEY] = "2026-10-31T00:00:00Z"

    before_ids = {c["id"] for c in reg.crate_lookup(data["_config"]).values()}
    reg.migrate(data["_config"], data["songs"])

    after = reg.crate_lookup(data["_config"])
    flagged = [s for s in data["songs"] if s.get(reg.MISSING_KEY)]
    assert flagged, "the fixture must have flagged rows"
    for song in flagged:
        assert song[reg.SONG_KEY] not in {c for c in after if c not in before_ids}, (
            "a flagged song's crate was rebuilt"
        )
    assert not any(c["location_path"] == location["path"] for c in after.values())


def test_a_crate_whose_name_and_folder_disagree_is_reported():
    """A rename is never silent: the report names the old name and the new one."""
    data = {
        "_config": {"root_path": "/music"},
        "songs": [{"id": "s1", "file_path": "/music/House/a.mp3", "root_folder": "Trance"}],
    }
    report = reg.migrate(data["_config"], data["songs"])

    # The file's folder wins, and the change is stated.
    crates = reg.crate_lookup(data["_config"])
    assert crates[data["songs"][0]["crate_id"]]["name"] == "House"
    assert any("Trance" in w and "House" in w for w in report["warnings"])
