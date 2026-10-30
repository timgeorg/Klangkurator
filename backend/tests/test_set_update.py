"""PUT /api/sets/{id}: what a partial update may change, and what it may clear."""

from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def _new_set(**extra) -> dict:
    res = client.post(
        "/api/sets",
        json={"name": "Halloween pool", "color": "#E0607E", "items": [], "phases": [], **extra},
    )
    assert res.status_code == 201
    return res.json()


def test_explicit_null_clears_the_target_duration():
    """A set is often a pool, not a timed plan, so its target must be removable.

    Before this, the update dropped every null, so a target set once could never
    be taken off again — the pool then still claimed a length it did not have.
    """
    dj_set = _new_set(target_duration_min=120)
    assert dj_set["target_duration_min"] == 120

    res = client.put(f"/api/sets/{dj_set['id']}", json={"target_duration_min": None})
    assert res.status_code == 200
    assert res.json()["target_duration_min"] is None


def test_explicit_null_clears_the_other_optional_fields():
    dj_set = _new_set(description="first draft", event_name="Gallop", notes="draft")
    res = client.put(
        f"/api/sets/{dj_set['id']}",
        json={"description": None, "event_name": None, "notes": None},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["description"] is None
    assert body["event_name"] is None
    assert body["notes"] is None


def test_a_field_left_out_is_not_touched():
    dj_set = _new_set(description="keep me", target_duration_min=90)
    res = client.put(f"/api/sets/{dj_set['id']}", json={"name": "renamed"})
    assert res.status_code == 200
    body = res.json()
    assert body["name"] == "renamed"
    assert body["description"] == "keep me"
    assert body["target_duration_min"] == 90


def test_a_name_null_is_ignored_instead_of_blanking_it():
    """`name` is required, so a null must not empty it (same rule as a song's title)."""
    dj_set = _new_set()
    res = client.put(f"/api/sets/{dj_set['id']}", json={"name": None})
    assert res.status_code == 200
    assert res.json()["name"] == "Halloween pool"
