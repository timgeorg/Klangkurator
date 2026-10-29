"""Preferences in settings.json and genres in library.json (issue #51).

Settings used to live only in the browser: they did not travel with the library,
vanished when site data was cleared, and the desktop window could not keep them
at all. They are files now, and an unreadable data file is preserved instead of
being overwritten.
"""

import json
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.storage import get_library_store, get_settings_store

client = TestClient(app)

SETTINGS_PATH = Path(os.environ["HOME"]) / ".klangkurator" / "settings.json"


@pytest.fixture(autouse=True)
def _empty_settings(tmp_path, monkeypatch):
    """A fresh preferences document for every test, without touching the real one."""
    path = tmp_path / "settings.json"
    monkeypatch.setattr("backend.config.SETTINGS_FILE", path)

    from backend.storage import settings_store as module
    from backend.storage.base_store import BaseStore

    monkeypatch.setattr(
        "backend.storage._settings_store", module.SettingsStore(BaseStore(path)), raising=False
    )
    yield path
    # The singleton is global: drop it so the next test builds its own.
    monkeypatch.setattr("backend.storage._settings_store", None, raising=False)


# ── The document ────────────────────────────────────────


def test_an_absent_file_reads_as_an_empty_document(_empty_settings):
    """A fresh install has no preferences yet; that is not an error."""
    assert client.get("/api/settings").json() == {}


def test_a_put_merges_shallowly_and_returns_the_document(_empty_settings):
    """Only the named keys change; the rest keep their values."""
    client.put("/api/settings", json={"theme": "paper", "volume": 0.4})

    res = client.put("/api/settings", json={"covers": "original"})

    body = res.json()
    assert body["theme"] == "paper"
    assert body["volume"] == 0.4
    assert body["covers"] == "original"
    assert body["version"] == 1


def test_the_document_reaches_disk(_empty_settings):
    """The point of the issue: the value is in a file, not in the browser."""
    client.put("/api/settings", json={"playerDock": "bar"})

    stored = json.loads(_empty_settings.read_text())
    assert stored["playerDock"] == "bar"


@pytest.mark.parametrize(
    "patch",
    [
        {"unknownSetting": 1},
        {"theme": 5},
        {"columns": "not an object"},
        {"volume": "loud"},
        {"volume": True},          # bool is an int subclass; it must not pass
        {"crateTabsExpanded": "yes"},
        ["not an object"],
    ],
)
def test_a_bad_write_is_refused_and_nothing_is_written(_empty_settings, patch):
    """An unknown key or a wrong type is 422, and the file stays as it was."""
    client.put("/api/settings", json={"theme": "dark"})
    before = _empty_settings.read_bytes()

    res = client.put("/api/settings", json=patch)

    assert res.status_code == 422
    assert _empty_settings.read_bytes() == before


def test_a_key_from_a_newer_version_survives_a_write(_empty_settings):
    """An older app must not destroy what a newer one stored."""
    _empty_settings.write_text(json.dumps({"version": 9, "futureSetting": {"a": 1}}))
    get_settings_store()._data.clear()
    get_settings_store()._data.update(json.loads(_empty_settings.read_text()))

    client.put("/api/settings", json={"theme": "paper"})

    stored = json.loads(_empty_settings.read_text())
    assert stored["futureSetting"] == {"a": 1}
    assert stored["theme"] == "paper"


# ── Genres ──────────────────────────────────────────────


def test_genres_round_trip():
    """Genres are library content, so they live in library.json."""
    genres = [{"name": "Techno", "color": "#6B5BD6", "subgenres": ["Peak Time"]}]

    assert client.put("/api/genres", json=genres).status_code == 200
    assert client.get("/api/genres").json() == genres


def test_genres_reach_library_json():
    """A genre change must survive clearing the browser's site data."""
    client.put("/api/genres", json=[{"name": "House", "color": "#4E9A2A", "subgenres": []}])

    stored = json.loads((Path(os.environ["HOME"]) / ".klangkurator" / "library.json").read_text())
    assert stored["genres"][0]["name"] == "House"


@pytest.mark.parametrize(
    "genres, reason",
    [
        ([{"name": "", "color": "#fff", "subgenres": []}], "blank name"),
        ([{"name": "Techno", "color": "#fff", "subgenres": []},
          {"name": "techno", "color": "#000", "subgenres": []}], "duplicate name"),
        ([{"name": "Techno", "subgenres": []}], "missing colour"),
        ([{"name": "Techno", "color": "#fff", "subgenres": "x"}], "bad subgenres"),
        ("nope", "not a list"),
    ],
)
def test_bad_genres_are_refused(genres, reason):
    """The Settings page must never receive a list it cannot render."""
    before = client.get("/api/genres").json()

    res = client.put("/api/genres", json=genres)

    assert res.status_code == 422, reason
    assert client.get("/api/genres").json() == before


# ── A corrupt file ──────────────────────────────────────


def test_an_unreadable_file_is_kept_aside_never_overwritten(tmp_path):
    """A JSON error used to start empty and the next save wiped the original."""
    from backend.storage.base_store import BaseStore

    path = tmp_path / "settings.json"
    path.write_text("{ this is not json")

    store = BaseStore(path)

    assert store._data == {}
    kept = list(tmp_path.glob("settings.corrupt-*.json"))
    assert len(kept) == 1
    assert kept[0].read_text() == "{ this is not json"
    # The original path is free, so the next save cannot clobber the bad file.
    assert not path.exists()


def test_a_corrupt_library_is_preserved_too(tmp_path):
    """The guard is in the base store, so every data file benefits."""
    from backend.storage.base_store import BaseStore

    path = tmp_path / "library.json"
    path.write_text("[]")  # valid JSON, wrong shape for a store — not corrupt
    assert BaseStore(path)._data == []

    path.write_text("not json at all")
    BaseStore(path)
    assert list(tmp_path.glob("library.corrupt-*.json"))


# ── The read paths the first review of #51 found broken ──


def test_a_non_utf8_file_is_preserved_not_a_crash(tmp_path):
    """UnicodeDecodeError is a ValueError, not a JSONDecodeError."""
    from backend.storage.base_store import BaseStore

    path = tmp_path / "library.json"
    path.write_bytes(b'{"songs": ["\xe2\x82')  # a truncated multi-byte sequence

    store = BaseStore(path)

    assert store._data == {}
    assert list(tmp_path.glob("library.corrupt-*.json"))


@pytest.mark.parametrize("bad", [float("inf"), float("-inf"), float("nan")])
def test_a_non_finite_number_is_refused(_empty_settings, bad):
    """`json.dump` writes `Infinity`, which `JSON.parse` then refuses for ever."""
    client.put("/api/settings", json={"volume": 0.5})
    before = _empty_settings.read_bytes()

    # A raw body: the test client's own JSON encoder refuses `Infinity`, and a
    # real client reaching the API does not.
    res = client.put(
        "/api/settings",
        content=b'{"volume": Infinity}' if bad > 0 else b'{"volume": -Infinity}',
        headers={"Content-Type": "application/json"},
    )

    assert res.status_code == 422
    assert _empty_settings.read_bytes() == before


def test_a_newer_documents_version_is_not_downgraded(_empty_settings):
    """A future version may gate a migration on that number."""
    _empty_settings.write_text(json.dumps({"version": 9}))
    get_settings_store()._data.clear()
    get_settings_store()._data.update(json.loads(_empty_settings.read_text()))

    client.put("/api/settings", json={"theme": "paper"})

    assert json.loads(_empty_settings.read_text())["version"] == 9
