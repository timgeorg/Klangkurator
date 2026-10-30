"""Audio variants: one track, several files (issue #65, [[18_AUDIO_VARIANTS]]).

The pair from the ticket is the fixture throughout: an `.mp3` that carries the
tags, ratings and set entry, and a `.wav` that is the same recording and may be
the master. The rules under test are INV-14 (one primary, a variant is never a
second row) and INV-15 (detaching never deletes the file).
"""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.api import library as library_api
from backend.main import app
from backend.services.import_merge import merge_variants
from backend.storage import get_library_store

client = TestClient(app)


@pytest.fixture(autouse=True)
def _no_scanner_work(monkeypatch):
    """The scan tests here are about the attach offer, never about decoding."""
    monkeypatch.setattr(library_api, "extract_metadata", lambda path: {"title": Path(path).stem, "artist": "Dold"})
    monkeypatch.setattr(library_api, "compute_peaks", lambda path: [0.5, 0.25])
    monkeypatch.setattr(library_api, "extract_artwork", lambda path, song_id: None)


@pytest.fixture
def pair(tmp_path) -> dict:
    """The Levex pair: a tagged mp3 plus an untagged wav of the same recording."""
    mp3 = tmp_path / "Skrillex - Scary Monsters and Nice Sprites (Levex Remix).mp3"
    wav = tmp_path / "Skrillex - Scary Monsters and Nice Sprites (Levex Remix).wav"
    mp3.write_bytes(b"\x00" * 1000)
    wav.write_bytes(b"\x00" * 3600)
    res = client.post(
        "/api/songs",
        json={
            "title": "Skrillex - Scary Monsters and Nice Sprites (Levex Remix)",
            "artist": "Levex",
            "file_path": str(mp3),
            "bpm": 132.0,
            "musical_key": "Gm",
            "duration": 204.624,
            "energy": 4.2,
            "people": 3.5,
            "rank": 4,
            "mixing_notes": "Mix out on the second drop.",
            "root_folder": "house/tims-tech-house-picks",
        },
    )
    assert res.status_code == 201
    return {"song": res.json(), "mp3": mp3, "wav": wav}


def _attach(song_id: str, path: Path):
    return client.post(f"/api/songs/{song_id}/variants", json={"file_path": str(path)})


def test_attaching_adds_a_variant_and_no_song_row(pair):
    """AC-1, AC-2: the attach lands on the track; the library does not grow."""
    before = len(get_library_store().get_songs())
    res = _attach(pair["song"]["id"], pair["wav"])
    assert res.status_code == 201
    body = res.json()
    assert len(body["audio_variants"]) == 1
    assert body["audio_variants"][0]["file_path"] == str(pair["wav"])
    assert body["audio_variants"][0]["format"] == "wav"
    assert body["audio_variants"][0]["size_bytes"] == 3600
    assert len(get_library_store().get_songs()) == before


def test_a_variant_carries_no_track_fields(pair):
    """INV-14: a variant holds files facts only — BPM, key and notes stay on the row."""
    body = _attach(pair["song"]["id"], pair["wav"]).json()
    variant = body["audio_variants"][0]
    for forbidden in ("bpm", "musical_key", "energy", "people", "rank", "mixing_notes"):
        assert forbidden not in variant
    assert body["bpm"] == 132.0
    assert body["mixing_notes"] == "Mix out on the second drop."


def test_an_unknown_track_is_refused(pair):
    """An attach to nothing is a 404, not a silent no-op."""
    res = _attach("no-such-id", pair["wav"])
    assert res.status_code == 404


def test_a_missing_file_is_refused(tmp_path, pair):
    """Nothing is attached that the app cannot later play."""
    res = _attach(pair["song"]["id"], tmp_path / "gone.wav")
    assert res.status_code == 404


def test_a_file_of_another_track_is_refused(pair):
    """The same file never lives on two tracks."""
    other = client.post(
        "/api/songs",
        json={"title": "Other", "artist": "Dold", "file_path": str(pair["mp3"])},
    ).json()
    res = _attach(other["id"], pair["mp3"])
    assert res.status_code == 409


def test_attaching_the_same_file_twice_is_idempotent(pair):
    """A double click is not a second variant."""
    first = _attach(pair["song"]["id"], pair["wav"]).json()
    second = _attach(pair["song"]["id"], pair["wav"]).json()
    assert len(first["audio_variants"]) == 1
    assert len(second["audio_variants"]) == 1


def test_make_primary_swaps_paths_and_keeps_every_other_field(pair):
    """AC-7: the swap moves the paths; BPM, key, ratings, notes and tags stay."""
    song_id = pair["song"]["id"]
    tag = client.post("/api/tags", json={"name": "peak", "color": "#ff0000"}).json()
    client.post(f"/api/songs/{song_id}/tags", json={"tag_id": tag["id"]})
    attached = _attach(song_id, pair["wav"]).json()
    variant_id = attached["audio_variants"][0]["id"]

    res = client.post(f"/api/songs/{song_id}/variants/{variant_id}/primary")
    assert res.status_code == 200
    body = res.json()

    assert body["file_path"] == str(pair["wav"])
    assert [v["file_path"] for v in body["audio_variants"]] == [str(pair["mp3"])]
    assert body["audio_variants"][0]["format"] == "mp3"
    for field in ("bpm", "musical_key", "duration", "energy", "people", "rank", "mixing_notes", "artist", "title"):
        assert body[field] == pair["song"][field], field
    assert [t["id"] for t in client.get(f"/api/songs/{song_id}/tags").json()] == [tag["id"]]


def test_a_second_make_primary_returns_to_the_start(pair):
    """The demoted file is described as well as the promoted one was."""
    song_id = pair["song"]["id"]
    variant_id = _attach(song_id, pair["wav"]).json()["audio_variants"][0]["id"]
    client.post(f"/api/songs/{song_id}/variants/{variant_id}/primary")
    back_id = client.get(f"/api/songs/{song_id}").json()["audio_variants"][0]["id"]

    body = client.post(f"/api/songs/{song_id}/variants/{back_id}/primary").json()
    assert body["file_path"] == str(pair["mp3"])
    assert body["audio_variants"][0]["file_path"] == str(pair["wav"])
    assert body["audio_variants"][0]["format"] == "wav"


def test_detaching_keeps_the_file_and_the_row(pair):
    """AC-18, AC-19, INV-15: the file stays on disk and the track survives."""
    song_id = pair["song"]["id"]
    variant_id = _attach(song_id, pair["wav"]).json()["audio_variants"][0]["id"]

    res = client.delete(f"/api/songs/{song_id}/variants/{variant_id}")
    assert res.status_code == 200
    assert res.json()["audio_variants"] == []
    assert pair["wav"].is_file()
    assert client.get(f"/api/songs/{song_id}").json()["file_path"] == str(pair["mp3"])


def test_detaching_an_unknown_variant_is_refused(pair):
    """A 404 instead of a save that changes nothing."""
    assert client.delete(f"/api/songs/{pair['song']['id']}/variants/nope").status_code == 404


def test_playback_falls_back_to_a_variant_when_the_primary_is_gone(pair):
    """AC-9: a missing primary gives way to a variant, and the response says so."""
    song_id = pair["song"]["id"]
    _attach(song_id, pair["wav"])
    pair["mp3"].unlink()

    res = client.get(f"/api/audio/{song_id}")
    assert res.status_code == 200
    assert res.headers["x-klangkurator-source"] == "variant"
    assert res.headers["x-klangkurator-file"] == pair["wav"].name


def test_playback_uses_the_primary_when_it_is_there(pair):
    """AC-8, AC-10: the primary plays and is named, even with a variant present."""
    song_id = pair["song"]["id"]
    _attach(song_id, pair["wav"])

    res = client.get(f"/api/audio/{song_id}")
    assert res.status_code == 200
    assert res.headers["x-klangkurator-source"] == "primary"
    assert res.headers["x-klangkurator-file"] == pair["mp3"].name


def test_the_listing_marks_a_missing_primary_and_variant(pair):
    """AC-10 and AC-17: the row says which file is gone, without dropping it."""
    song_id = pair["song"]["id"]
    _attach(song_id, pair["wav"])
    pair["wav"].unlink()

    row = next(s for s in client.get("/api/songs").json() if s["id"] == song_id)
    assert row["primary_missing"] is False
    assert row["audio_variants"][0]["missing"] is True


def test_a_missing_flag_is_never_stored(pair, tmp_path):
    """`missing` is derived on read, so it cannot go stale in library.json."""
    _attach(pair["song"]["id"], pair["wav"])
    data = json.loads(get_library_store()._file.read_text())
    stored = next(s for s in data["songs"] if s["id"] == pair["song"]["id"])
    assert stored["audio_variants"]
    assert "missing" not in stored["audio_variants"][0]


def test_the_export_carries_audio_variants(pair):
    """AC-15: a backup keeps the file list."""
    _attach(pair["song"]["id"], pair["wav"])
    export = client.get("/api/export").json()
    song = next(s for s in export["data"]["songs"] if s["id"] == pair["song"]["id"])
    assert [v["file_path"] for v in song["audio_variants"]] == [str(pair["wav"])]


# ── the import merge ─────────────────────────────────────

def _variant(path: str, variant_id: str = "v1") -> dict:
    return {
        "id": variant_id,
        "file_path": path,
        "format": "wav",
        "duration": 204.5,
        "bitrate": None,
        "sample_rate": 44100,
        "bit_depth": 24,
        "size_bytes": 36158234,
        "added_at": "2026-10-30T15:00:00Z",
    }


def test_merge_variants_keeps_the_local_path_and_adds_the_imported_one():
    """AC-16: union by path; no path is rewritten (INV-11)."""
    local = [_variant("/local/a.wav", "local-1")]
    imported = [_variant("/author/a.wav", "author-1")]
    merged = merge_variants(local, imported)
    assert [v["file_path"] for v in merged] == ["/local/a.wav", "/author/a.wav"]
    assert merged[0]["id"] == "local-1"
    assert merged[1]["id"] == "author-1"


def test_merge_variants_keeps_a_variant_whose_file_is_missing():
    """AC-17: an absent file is marked on read, never dropped by the merge."""
    merged = merge_variants([], [_variant("/elsewhere/master.wav")])
    assert len(merged) == 1
    assert merged[0]["file_path"] == "/elsewhere/master.wav"
    assert "missing" not in merged[0]


def test_merge_variants_does_not_duplicate_a_shared_path():
    """Importing the same export twice leaves one variant."""
    merged = merge_variants([_variant("/a.wav", "a")], [_variant("/a.wav", "b")])
    assert len(merged) == 1
    assert merged[0]["id"] == "a"


def test_import_adds_a_variant_to_a_matched_track(pair):
    """AC-16: a matched track gains the imported variant and keeps its own row."""
    song_id = pair["song"]["id"]
    envelope = {
        "format": "klangkurator-library",
        "version": 1,
        "data": {
            "songs": [
                {
                    "id": "foreign",
                    "title": pair["song"]["title"],
                    "artist": pair["song"]["artist"],
                    "file_path": str(pair["mp3"]),
                    "audio_variants": [_variant("/author/master.wav", "author-v")],
                }
            ]
        },
    }
    plan = client.post("/api/import/preview", json=envelope)
    assert plan.status_code == 200
    res = client.post("/api/import", json={"envelope": envelope})
    assert res.status_code == 200
    assert res.json()["summary"]["variants_merged"] >= 0

    row = client.get(f"/api/songs/{song_id}").json()
    assert [v["file_path"] for v in row["audio_variants"]] == ["/author/master.wav"]
    assert row["audio_variants"][0]["missing"] is True  # marked, not dropped


def test_import_of_a_new_track_keeps_its_variants_with_fresh_ids():
    """INV-12: the track id is minted locally, and so is each variant id."""
    envelope = {
        "format": "klangkurator-library",
        "version": 1,
        "data": {
            "songs": [
                {
                    "id": "foreign-track",
                    "title": "Imported",
                    "artist": "Dold",
                    "file_path": "/nowhere/imported.mp3",
                    "audio_variants": [_variant("/nowhere/imported.wav", "foreign-variant")],
                }
            ]
        },
    }
    assert client.post("/api/import", json={"envelope": envelope}).status_code == 200
    row = next(s for s in client.get("/api/songs").json() if s["title"] == "Imported")
    assert row["id"] != "foreign-track"
    assert row["audio_variants"][0]["id"] != "foreign-variant"
    assert row["audio_variants"][0]["file_path"] == "/nowhere/imported.wav"


# ── the scan's attach offer (AC-1, AC-2) ─────────────────

def _scan(root: Path) -> dict:
    """Run a scan to completion and return its status."""
    import time

    res = client.post("/api/library/scan", json={"root_path": str(root)})
    assert res.status_code == 200
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        status = client.get("/api/library/scan-status").json()
        if not status["running"]:
            return status
        time.sleep(0.01)
    raise AssertionError("scan did not finish")


@pytest.fixture
def known_track(tmp_path, monkeypatch) -> dict:
    """A library track plus a second file the scan meets as a new file.

    The stored track's duration and title are what the scan's second copy
    carries, so the offer's duration branch is the one exercised — the case the
    ticket describes, where the `.wav`'s artist does not match the `.mp3`'s.
    """
    mp3 = tmp_path / "library" / "Skrillex - Scary Monsters (Levex Remix).mp3"
    mp3.parent.mkdir()
    mp3.write_bytes(b"\x00")
    title = "Skrillex - Scary Monsters (Levex Remix)"
    song = client.post(
        "/api/songs",
        json={"title": title, "artist": "Levex", "file_path": str(mp3), "duration": 204.6},
    ).json()

    wav = tmp_path / "library" / "Skrillex - Scary Monsters (Levex Remix).wav"
    wav.write_bytes(b"\x00")

    def metadata(path: str) -> dict:
        return {"title": Path(path).stem, "artist": "Unknown Artist", "duration": 204.5}

    monkeypatch.setattr(library_api, "extract_metadata", metadata)
    return {"song": song, "wav": wav, "root": tmp_path / "library"}


def test_a_scan_offers_a_second_file_instead_of_adding_a_row(known_track):
    """AC-1, AC-2: the copy is offered; the library keeps one row for the track."""
    before = len(get_library_store().get_songs())
    status = _scan(known_track["root"])

    assert status["result"]["offered"] == 1
    assert status["result"]["added"] == 0
    offers = status["result"]["offers"]
    assert offers == [
        {
            "file_path": str(known_track["wav"]),
            "song_id": known_track["song"]["id"],
            "title": known_track["song"]["title"],
            "artist": "Levex",
            "match": "duration",
            "duration": 204.5,
        }
    ]
    assert len(get_library_store().get_songs()) == before


def test_applying_an_offer_adds_no_song_row(known_track):
    """AC-2: the one click the Import page offers lands as a variant."""
    _scan(known_track["root"])
    before = len(get_library_store().get_songs())

    res = client.post(
        f"/api/songs/{known_track['song']['id']}/variants",
        json={"file_path": str(known_track["wav"])},
    )
    assert res.status_code == 201
    assert [v["file_path"] for v in res.json()["audio_variants"]] == [str(known_track["wav"])]
    assert len(get_library_store().get_songs()) == before


def test_a_rescan_does_not_offer_an_attached_variant_again(known_track):
    """INV-14: once attached, the file is part of the track, not a new file."""
    _scan(known_track["root"])
    client.post(
        f"/api/songs/{known_track['song']['id']}/variants",
        json={"file_path": str(known_track["wav"])},
    )
    status = _scan(known_track["root"])
    assert status["result"]["offers"] == []
    assert status["result"]["offered"] == 0
    assert status["result"]["skipped"] == 2


def test_unrelated_files_of_a_similar_length_are_added_not_offered(known_track):
    """A duration alone is not identity: a different title is a track of its own."""
    stranger = known_track["root"] / "Dold - Something Else.wav"
    stranger.write_bytes(b"\x00")
    rows = len(get_library_store().get_songs())

    status = _scan(known_track["root"])

    # Only the real second copy is offered; the stranger becomes its own row.
    assert [o["file_path"] for o in status["result"]["offers"]] == [str(known_track["wav"])]
    assert status["result"]["added"] == 1
    assert len(get_library_store().get_songs()) == rows + 1
    assert any(s["file_path"] == str(stranger) for s in get_library_store().get_songs())


def test_an_artist_title_match_is_offered_too(tmp_path, monkeypatch):
    """The tag-complete case: same artist and title, so the offer carries that match."""
    first = tmp_path / "music" / "a.mp3"
    first.parent.mkdir()
    first.write_bytes(b"\x00")
    song = client.post(
        "/api/songs",
        json={"title": "Same Song", "artist": "Dold", "file_path": str(first), "duration": 300.0},
    ).json()
    copy = tmp_path / "music" / "b.flac"
    copy.write_bytes(b"\x00")

    monkeypatch.setattr(
        library_api,
        "extract_metadata",
        lambda path: {"title": "Same Song", "artist": "Dold", "duration": 300.0},
    )
    status = _scan(tmp_path / "music")
    assert status["result"]["offers"][0]["song_id"] == song["id"]
    assert status["result"]["offers"][0]["match"] == "artist_title"


# ── analysis (AC-11, AC-12, AC-13, AC-14) ────────────────

def test_the_library_wide_job_never_sees_a_variant(pair, monkeypatch):
    """AC-11, AC-12: the job walks song rows; a variant is not one and has no BPM."""
    from backend.api.library import _songs_missing_bpm

    _attach(pair["song"]["id"], pair["wav"])
    # The row has a BPM; clear it so the job would pick the *track* up. The
    # variant must still never appear as a candidate of its own.
    client.put(f"/api/songs/{pair['song']['id']}", json={"bpm": None})

    candidates = _songs_missing_bpm(get_library_store())
    paths = [c["file_path"] for c in candidates]
    assert str(pair["mp3"]) in paths
    assert str(pair["wav"]) not in paths


def test_analysis_uses_the_primary_file(pair, monkeypatch):
    """AC-11: only the primary's path reaches the detector."""
    analysed: list[str] = []
    monkeypatch.setattr(
        library_api, "analyze_track",
        lambda path, bpm_range=None: analysed.append(path) or {
            "bpm": 132.0, "musical_key": "Gm", "duration": 204.6, "bpm_fit": True,
        },
    )
    _attach(pair["song"]["id"], pair["wav"])
    res = client.post(f"/api/library/analyze/{pair['song']['id']}", json={})
    assert res.status_code == 200
    assert analysed == [str(pair["mp3"])]


def test_an_octave_disagreement_reports_both_numbers(pair):
    """AC-13: the popup gets `primary 132.0 / variant 66.3`, not one number."""
    song_id = pair["song"]["id"]
    attached = _attach(song_id, pair["wav"]).json()
    variant_id = attached["audio_variants"][0]["id"]
    row = get_library_store().get_song(song_id)
    row["audio_variants"] = [
        {**v, "bpm_reading": 66.3} if v["id"] == variant_id else v
        for v in row["audio_variants"]
    ]

    body = client.get(f"/api/songs/{song_id}").json()
    assert body["bpm"] == 132.0
    assert body["audio_variants"][0]["bpm_reading"] == 66.3

    # The popup's own call reports the pair and names the fault.
    res = client.post(f"/api/library/analyze/{song_id}", json={})
    assert res.status_code == 200
    assert res.json()["primary_bpm"] == 132.0
    assert res.json()["variant_bpm"] == 66.3
    assert res.json()["octave_disagreement"] is True


def test_a_agreeing_variant_reports_no_disagreement(pair):
    """AC-14: nothing is flagged when both files read the same tempo."""
    song_id = pair["song"]["id"]
    attached = _attach(song_id, pair["wav"]).json()
    variant_id = attached["audio_variants"][0]["id"]
    row = get_library_store().get_song(song_id)
    row["audio_variants"] = [
        {**v, "bpm_reading": 132.0} if v["id"] == variant_id else v
        for v in row["audio_variants"]
    ]

    res = client.post(f"/api/library/analyze/{song_id}", json={})
    body = res.json()
    assert body["variant_bpm"] is None
    assert body["octave_disagreement"] is False
    assert body["primary_bpm"] == 132.0


def test_an_analysis_never_writes_a_variant_reading(pair, monkeypatch):
    """AC-14: the popup offers the repair; a run never edits a variant."""
    monkeypatch.setattr(
        library_api, "analyze_track",
        lambda path, bpm_range=None: {
            "bpm": 66.3, "musical_key": "Gm", "duration": 204.6, "bpm_fit": True,
        },
    )
    song_id = pair["song"]["id"]
    attached = _attach(song_id, pair["wav"]).json()
    before = attached["audio_variants"][0]

    client.post(f"/api/library/analyze/{song_id}", json={})

    after = client.get(f"/api/songs/{song_id}").json()["audio_variants"][0]
    for key in ("id", "file_path", "format", "duration", "bpm_reading"):
        assert after[key] == before[key], key
