"""The library-wide analysis is a job with a countable progress and an Abort.

`done` counts **finished** tracks, so the first status reads 0 / N and the last
N / N. Abort stops after the track it is on, and a stop asked for during the
last track ends the run normally (BC-9, BC-10). The detector is stubbed, so
these tests never touch librosa.
"""

import threading
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.api import library as library_api
from backend.main import app
from backend.scanner import audio_analysis
from backend.storage import get_library_store

client = TestClient(app)

TRACKS = 3


def _wait_until(predicate, timeout: float = 5.0) -> None:
    """Block until `predicate()` is true, or fail with a readable message."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return
        time.sleep(0.01)
    raise AssertionError("the job did not reach the expected state in time")


def _jobs_idle() -> bool:
    """No analysis, no scan, no claimed job slot."""
    return (
        not library_api._analyze_state["running"]
        and not library_api._scan_state["running"]
        and library_api._job is None
    )


@pytest.fixture(autouse=True)
def _no_job_left_running():
    """A test that fails mid-run must not leak the job into the next one."""
    library_api._analyze_stop.clear()
    _wait_until(_jobs_idle)
    yield
    library_api._analyze_stop.clear()
    _wait_until(_jobs_idle)


@pytest.fixture
def tracks(tmp_path) -> list[str]:
    """Three songs without a BPM, each with a real (empty) file on disk."""
    ids = []
    for i in range(TRACKS):
        audio = tmp_path / f"track{i}.wav"
        audio.write_bytes(b"")
        res = client.post(
            "/api/songs",
            json={"title": f"Track {i}", "artist": "Dold", "file_path": str(audio)},
        )
        assert res.status_code == 201
        ids.append(res.json()["id"])
    return ids


def _analysis_status() -> dict:
    """The current (or last) analysis status, as the endpoint reports it."""
    res = client.get("/api/library/analyze-status")
    assert res.status_code == 200
    return res.json()


def _stub_detector(monkeypatch, on_track=None) -> list[str]:
    """Replace the detector with a fast one; `on_track(title)` runs per track."""
    seen: list[str] = []

    def fake_analyze(file_path, *args, **kwargs):
        title = Path(file_path).stem
        seen.append(title)
        if on_track is not None:
            on_track(title)
        return {"bpm": 128.0, "musical_key": "Am", "duration": 240.0}

    monkeypatch.setattr(audio_analysis, "analyze_track", fake_analyze)
    return seen


def test_the_first_status_is_zero_and_the_last_is_the_total(tracks, monkeypatch):
    """BC-7: `done` counts finished tracks, never the one about to start."""
    release = threading.Event()
    started = threading.Event()

    def hold(title):
        if title == "track0":
            started.set()
            release.wait(5)

    _stub_detector(monkeypatch, hold)
    body = client.post("/api/library/analyze-all").json()
    assert body == {"started": True, "total": TRACKS}

    assert started.wait(5)
    first = _analysis_status()
    assert (first["done"], first["total"]) == (0, TRACKS)
    assert first["current_title"] == "Track 0"

    release.set()
    _wait_until(_jobs_idle)
    last = _analysis_status()
    assert (last["done"], last["total"]) == (TRACKS, TRACKS)
    assert last["result"]["analyzed"] == TRACKS
    assert last["result"]["cancelled"] is False


def test_a_missing_file_is_skipped_and_still_advances_done(tmp_path, monkeypatch):
    """A track whose file vanished counts as finished, not as pending."""
    monkeypatch.setattr(
        audio_analysis, "analyze_track",
        lambda path, *a, **k: {"bpm": 128.0, "musical_key": "Am", "duration": 240.0},
    )
    store = get_library_store()
    present = tmp_path / "present.wav"
    present.write_bytes(b"")
    for title, path in (("Gone", tmp_path / "gone.wav"), ("Here", present)):
        store.add_song({"title": title, "artist": "Dold", "file_path": str(path)})

    seen: list[tuple[int, int]] = []
    summary = audio_analysis.analyze_all_missing_bpm(
        store, progress_cb=lambda done, total, title: seen.append((done, total)),
    )

    assert seen == [(0, 2), (1, 2), (1, 2), (2, 2)]
    assert summary["skipped"] == 1
    assert summary["analyzed"] == 1
    assert summary["cancelled"] is False


def test_cancel_with_no_job_is_a_409():
    """BC-9: the app then only refreshes the status, no error message."""
    res = client.post("/api/library/analyze-cancel")
    assert res.status_code == 409


def test_cancel_during_the_first_of_three_tracks_stops_the_run(tracks, monkeypatch):
    """BC-9: the track in flight finishes, the rest are never touched."""
    release = threading.Event()
    started = threading.Event()

    def hold(title):
        if title == "track0":
            started.set()
            release.wait(5)

    _stub_detector(monkeypatch, hold)
    client.post("/api/library/analyze-all")

    assert started.wait(5)
    cancel = client.post("/api/library/analyze-cancel")
    assert cancel.status_code == 200
    assert cancel.json() == {"stopping": True}
    assert _analysis_status()["stopping"] is True

    release.set()
    _wait_until(_jobs_idle)

    status = _analysis_status()
    assert status["stopping"] is False
    assert status["result"]["cancelled"] is True
    assert status["result"]["analyzed"] == 1
    store = get_library_store()
    assert store.get_song(tracks[0])["bpm"] == 128.0
    assert store.get_song(tracks[1])["bpm"] is None
    assert store.get_song(tracks[2])["bpm"] is None


def test_cancel_during_the_last_track_ends_normally(tracks, monkeypatch):
    """BC-10: nothing is left to stop for, so the run is not "cancelled"."""
    release = threading.Event()
    started = threading.Event()

    def hold(title):
        if title == "track2":
            started.set()
            release.wait(5)

    _stub_detector(monkeypatch, hold)
    client.post("/api/library/analyze-all")

    assert started.wait(5)
    assert client.post("/api/library/analyze-cancel").status_code == 200

    release.set()
    _wait_until(_jobs_idle)

    status = _analysis_status()
    assert status["result"]["cancelled"] is False
    assert status["result"]["analyzed"] == TRACKS
    assert status["done"] == status["total"] == TRACKS
