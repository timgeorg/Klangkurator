"""The `slim` projection on GET /api/songs (REQ-10-SL, issue #47).

`waveform_peaks` is 200 floats per track and most of a listing's bytes, so a
caller that cannot draw a waveform asks for the rows without it. This is a
projection, not pagination: the app's own client keeps the default rows.
"""

import json

from fastapi.testclient import TestClient

from backend.main import app
from backend.storage import get_library_store

client = TestClient(app)

PEAKS = [round(index / 200, 3) for index in range(200)]


def _add_song(title: str, **extra) -> dict:
    """One song in the throwaway library, with a full waveform by default."""
    res = client.post(
        "/api/songs",
        json={
            "title": title,
            "artist": "Dold",
            "file_path": f"/music/{title}.mp3",
            "waveform_peaks": PEAKS,
            **extra,
        },
    )
    assert res.status_code == 201
    return res.json()


def test_a_slim_row_has_no_peaks_key_at_all():
    """Not even a null: a caller keys off the field's presence."""
    _add_song("one")

    rows = client.get("/api/songs", params={"slim": "true"}).json()
    assert len(rows) == 1
    assert "waveform_peaks" not in rows[0]


def test_the_full_listing_still_carries_the_peaks():
    """The app's own client is unchanged (BC-5)."""
    _add_song("one")

    rows = client.get("/api/songs").json()
    assert rows[0]["waveform_peaks"] == PEAKS


def test_slim_and_full_agree_on_every_other_field():
    """Same rows, same shared values; only the envelope is gone."""
    _add_song("one", energy=3.5, people=2.5)
    _add_song("two")

    full = client.get("/api/songs").json()
    slim = client.get("/api/songs", params={"slim": "true"}).json()

    assert len(slim) == len(full)
    for slim_row, full_row in zip(slim, full):
        assert {k: v for k, v in full_row.items() if k != "waveform_peaks"} == slim_row


def test_a_legacy_row_without_rank_still_reports_it():
    """The response model fills defaults; stripping raw dicts would drop them.

    A row written before issue #4 has no `rank` key at all. (Not `rank: null`:
    that fails validation on the full listing too, long before this change.)
    """
    song = _add_song("legacy")
    stored = get_library_store().get_song(song["id"])
    for key in ("rank", "phase_tags", "vibe_tags"):
        stored.pop(key, None)

    row = next(r for r in client.get("/api/songs", params={"slim": "true"}).json() if r["id"] == song["id"])
    assert row["rank"] == 0
    assert row["phase_tags"] == []
    assert row["vibe_tags"] == []


def test_slim_is_at_least_55_percent_smaller_with_full_waveforms():
    """The measured share is 67 % at 1,907 tracks; this fixture proves the floor."""
    for index in range(20):
        _add_song(f"track-{index}")

    full = client.get("/api/songs")
    slim = client.get("/api/songs", params={"slim": "true"})

    assert len(slim.content) <= len(full.content) * 0.45, (
        f"slim {len(slim.content)} B vs full {len(full.content)} B"
    )


def test_slim_still_applies_the_search_filter():
    """`slim` projects, it does not replace the endpoint's own filter."""
    _add_song("one")
    _add_song("two")

    rows = client.get("/api/songs", params={"slim": "true", "search": "one"}).json()
    assert [row["title"] for row in rows] == ["one"]
    assert "waveform_peaks" not in json.dumps(rows)
