"""Decimal ratings (issue #7): the 0–5 ratings take one decimal, rank stays whole."""

from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


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


def test_create_with_a_fractional_energy_round_trips():
    song = _new_song(energy=3.8)
    assert song["energy"] == 3.8
    res = client.get(f"/api/songs/{song['id']}")
    assert res.status_code == 200
    assert res.json()["energy"] == 3.8


def test_put_sets_a_fractional_rating():
    song = _new_song()
    res = client.put(f"/api/songs/{song['id']}", json={"energy": 3.1})
    assert res.status_code == 200
    assert res.json()["energy"] == 3.1


def test_integer_values_still_work():
    song = _new_song(energy=3)
    res = client.put(f"/api/songs/{song['id']}", json={"energy": 4})
    assert res.status_code == 200
    assert res.json()["energy"] == 4


def test_rank_stays_a_whole_number():
    song = _new_song(rank=4, energy=3.8)
    res = client.put(f"/api/songs/{song['id']}", json={"energy": 2.5, "rank": 2.5})
    # rank is still int — a fractional rank is rejected…
    assert res.status_code == 422
    # …and the failed request must not have written the energy either.
    res = client.get(f"/api/songs/{song['id']}")
    assert res.json()["energy"] == 3.8
    assert res.json()["rank"] == 4


def test_legacy_store_with_a_fraction_energy_lists_without_error():
    """A library.json predating the float widening must not break the list route."""
    from backend.storage import get_library_store

    store = get_library_store()
    song = _new_song()
    store.update_song(song["id"], {"energy": 3.8, "people": 2.5})
    res = client.get("/api/songs")
    assert res.status_code == 200
    energies = {s["id"]: s["energy"] for s in res.json()}
    assert energies[song["id"]] == 3.8