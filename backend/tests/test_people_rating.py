"""One People rating (issue #48): `people` replaces Dance and Social.

No compatibility layer: `danceability` and `social_acceptance` are never read
and never written, so a row still carrying them in `library.json` lists with
`people: 0` and a request that sets one of them changes nothing.
"""

import time

import numpy as np
import soundfile as sf
from fastapi.testclient import TestClient

from backend.api import library as library_api
from backend.main import app
from backend.storage import get_library_store

client = TestClient(app)

# The keys this issue retires. They appear only here, on purpose: a row seeded
# with them proves they are ignored, never read.
OLD_RATING_KEYS = ("danceability", "social_acceptance")


def _new_song(**extra) -> dict:
    res = client.post(
        "/api/songs",
        json={
            "title": "Sequence",
            "artist": "Kobosil",
            "file_path": "/music/sequence.mp3",
            **extra,
        },
    )
    assert res.status_code == 201
    return res.json()


def _seed_old_keys(song_id: str, **old_values: float) -> None:
    """Write the retired keys straight into the store, as an old file would."""
    get_library_store().update_song(song_id, dict(old_values))


def _wait_for_scan(timeout: float = 10.0) -> dict:
    """Poll the scan job until it ends, and return its status.

    The scan is a background job (issue #46), so `POST /scan` only starts it.
    """
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        status = client.get("/api/library/scan-status").json()
        if not status["running"] and status["finished"]:
            return status
        time.sleep(0.01)
    raise AssertionError("the scan did not finish in time")


def _write_wav(path) -> None:
    """A short, quiet tone the scanner can read."""
    samples = int(22050 * 0.2)
    tone = (0.2 * np.sin(2 * np.pi * 440 * np.arange(samples) / 22050)).astype(np.float32)
    sf.write(path, tone, 22050)


def test_an_old_row_lists_with_people_unrated_and_no_old_keys():
    song = _new_song()
    _seed_old_keys(song["id"], danceability=4.5, social_acceptance=2.5)

    res = client.get("/api/songs")
    assert res.status_code == 200
    row = next(s for s in res.json() if s["id"] == song["id"])
    assert row["people"] == 0
    for key in OLD_RATING_KEYS:
        assert key not in row


def test_put_persists_a_fractional_people_rating():
    song = _new_song()
    res = client.put(f"/api/songs/{song['id']}", json={"people": 3.5})
    assert res.status_code == 200
    assert res.json()["people"] == 3.5
    assert client.get(f"/api/songs/{song['id']}").json()["people"] == 3.5


def test_put_with_an_old_key_leaves_the_ratings_unchanged():
    song = _new_song(energy=2.5, people=3.5)
    _seed_old_keys(song["id"], danceability=1.5, social_acceptance=4.5)

    res = client.put(f"/api/songs/{song['id']}", json={"danceability": 4})
    assert res.status_code == 200
    assert res.json()["people"] == 3.5
    assert res.json()["energy"] == 2.5

    stored = get_library_store().get_song(song["id"])
    assert stored["people"] == 3.5
    # The retired key the request named was not written over.
    assert stored["danceability"] == 1.5


def test_a_scan_writes_people_unrated_and_no_old_keys(tmp_path):
    crate = tmp_path / "Melodic Techno"
    crate.mkdir()
    _write_wav(crate / "one.wav")
    _write_wav(crate / "two.wav")

    res = client.post("/api/library/scan", json={"root_path": str(tmp_path)})
    assert res.status_code == 200
    assert res.json() == {"started": True, "total": 2}
    assert _wait_for_scan()["result"]["added"] == 2

    rows = client.get("/api/songs").json()
    assert len(rows) == 2
    for row in rows:
        assert row["people"] == 0
        for key in OLD_RATING_KEYS:
            assert key not in row
    for stored in get_library_store().get_songs():
        assert stored["people"] == 0
        for key in OLD_RATING_KEYS:
            assert key not in stored


def test_export_carries_people_for_a_rated_row():
    song = _new_song(people=3.5)

    res = client.get("/api/export")
    assert res.status_code == 200
    exported = next(s for s in res.json()["data"]["songs"] if s["id"] == song["id"])
    assert exported["people"] == 3.5
    for key in OLD_RATING_KEYS:
        assert key not in exported


def test_import_preview_reports_a_people_conflict_like_energy():
    local = _new_song(energy=3, people=4)
    envelope = {
        "format": "klangkurator-library",
        "version": 1,
        "exported_at": "2026-10-23T00:00:00Z",
        "data": {
            "songs": [{
                "id": "12121212-1212-1212-1212-121212121212",
                "title": local["title"],
                "artist": local["artist"],
                "file_path": local["file_path"],
                "energy": 1,
                "people": 5,
            }],
            "tags": [], "song_tags": [], "song_relationships": [],
            "playlists": [], "playlist_songs": [], "blocks": [], "sets": [],
        },
    }

    plan = client.post("/api/import/preview", json=envelope).json()
    assert plan["summary"]["conflicts"] == 2  # energy 3 vs 1, people 4 vs 5
    by_field = {c["field"]: c for c in plan["conflicts"]}
    assert by_field["people"]["local"] == 4
    assert by_field["people"]["imported"] == 5

    # 0 counts as empty, so an unrated local row fills without a conflict.
    unrated = _new_song(title="Unrated", file_path="/music/unrated.mp3", people=0)
    fill = {
        "format": "klangkurator-library",
        "version": 1,
        "exported_at": "2026-10-23T00:00:00Z",
        "data": {
            "songs": [{
                "id": "13131313-1313-1313-1313-131313131313",
                "title": unrated["title"],
                "artist": unrated["artist"],
                "file_path": unrated["file_path"],
                "people": 2.5,
            }],
            "tags": [], "song_tags": [], "song_relationships": [],
            "playlists": [], "playlist_songs": [], "blocks": [], "sets": [],
        },
    }
    fill_plan = client.post("/api/import/preview", json=fill).json()
    assert fill_plan["summary"]["conflicts"] == 0
    client.post("/api/import", json={"envelope": fill, "resolutions": []})
    assert client.get(f"/api/songs/{unrated['id']}").json()["people"] == 2.5
