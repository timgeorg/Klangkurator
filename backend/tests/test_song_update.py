"""PUT /api/songs/{id}: what a partial update may change."""

from pathlib import Path

from fastapi.testclient import TestClient

from backend.config import DATA_DIR
from backend.main import app

client = TestClient(app)


def _new_song() -> dict:
    res = client.post(
        "/api/songs",
        json={
            "title": "Feng Shui",
            "artist": "Dold",
            "album": "Tech 035",
            "file_path": "/music/feng-shui.mp3",
            "mixing_notes": "Long blend",
            "subgenres": ["Raw"],
        },
    )
    assert res.status_code == 201
    return res.json()


def test_runs_against_a_throwaway_home():
    assert str(DATA_DIR).startswith(str(Path.home()))
    assert "klangkurator-test-home-" in str(DATA_DIR)


def test_explicit_null_clears_an_optional_field():
    song = _new_song()
    res = client.put(f"/api/songs/{song['id']}", json={"album": None, "mixing_notes": None})
    assert res.status_code == 200
    assert res.json()["album"] is None
    assert res.json()["mixing_notes"] is None


def test_fields_left_out_are_untouched():
    song = _new_song()
    res = client.put(f"/api/songs/{song['id']}", json={"bpm": 128.4})
    body = res.json()
    assert body["bpm"] == 128.4
    assert body["album"] == "Tech 035"
    assert body["mixing_notes"] == "Long blend"


def test_null_never_blanks_a_required_or_list_field():
    song = _new_song()
    res = client.put(f"/api/songs/{song['id']}", json={"title": None, "subgenres": None})
    assert res.status_code == 200
    assert res.json()["title"] == "Feng Shui"
    assert res.json()["subgenres"] == ["Raw"]
