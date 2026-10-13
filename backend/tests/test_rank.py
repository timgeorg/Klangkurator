"""The per-track rank (issue #4): a 1–5 star score, 0 = unranked."""

from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def _new_song(**extra) -> dict:
    res = client.post(
        "/api/songs",
        json={
            "title": "Feng Shui",
            "artist": "Dold",
            "file_path": "/music/feng-shui.mp3",
            **extra,
        },
    )
    assert res.status_code == 201
    return res.json()


def test_rank_round_trips_through_the_store():
    song = _new_song(rank=4)
    assert song["rank"] == 4
    res = client.get(f"/api/songs/{song['id']}")
    assert res.status_code == 200
    assert res.json()["rank"] == 4


def test_put_sets_the_rank():
    song = _new_song()
    res = client.put(f"/api/songs/{song['id']}", json={"rank": 3})
    assert res.status_code == 200
    assert res.json()["rank"] == 3


def test_a_song_without_a_rank_reads_back_as_zero():
    song = _new_song()
    assert song["rank"] == 0
    res = client.get(f"/api/songs/{song['id']}")
    assert res.json()["rank"] == 0
