"""The folder scan runs as a background job with a polled status (REQ-10-SP).

The per-file work is stubbed, so these tests are about the job's bookkeeping —
start, progress, the one-job rule and the way it ends — never about decoding a
real file or the 1.4 s a waveform takes.
"""

import threading
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.api import library as library_api
from backend.main import app
from backend.storage import get_library_store
from backend.scanner import audio_analysis

client = TestClient(app)

FILES = 3
PEAKS = [0.5, 0.25]


def _wait_until(predicate, timeout: float = 5.0) -> None:
    """Block until `predicate()` is true, or fail with a readable message."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return
        time.sleep(0.01)
    raise AssertionError("the job did not reach the expected state in time")


def _jobs_idle() -> bool:
    """No scan, no analysis, no claimed job slot."""
    return (
        not library_api._scan_state["running"]
        and not library_api._analyze_state["running"]
        and library_api._job is None
    )


@pytest.fixture(autouse=True)
def _no_job_left_running():
    """A test that fails mid-scan must not leak the job into the next one."""
    library_api._analyze_stop.clear()
    _wait_until(_jobs_idle)
    yield
    library_api._analyze_stop.clear()
    _wait_until(_jobs_idle)


@pytest.fixture(autouse=True)
def _fast_file_work(monkeypatch):
    """No mutagen, no decode for peaks, no artwork — one file, no waiting."""
    monkeypatch.setattr(
        library_api, "extract_metadata",
        lambda path: {"title": Path(path).stem, "artist": "Dold"},
    )
    monkeypatch.setattr(library_api, "compute_peaks", lambda path: PEAKS)
    monkeypatch.setattr(library_api, "extract_artwork", lambda path, song_id: None)


@pytest.fixture
def music(tmp_path) -> Path:
    """A root folder with FILES files spread over two crates."""
    for i in range(FILES):
        crate = tmp_path / f"crate{i % 2}"
        crate.mkdir(exist_ok=True)
        (crate / f"track{i}.wav").write_bytes(b"")
    return tmp_path


def _start(root: Path) -> dict:
    """POST the scan and return its body."""
    res = client.post("/api/library/scan", json={"root_path": str(root)})
    assert res.status_code == 200
    return res.json()


def _status() -> dict:
    """The current (or last) scan status, as the endpoint reports it."""
    res = client.get("/api/library/scan-status")
    assert res.status_code == 200
    return res.json()


def test_a_scan_starts_at_once_and_reports_its_count(music):
    """BC-1: the request returns with `started` and the total, not once done."""
    started = time.monotonic()
    body = _start(music)
    elapsed = time.monotonic() - started

    assert body == {"started": True, "total": FILES}
    assert elapsed < 1.0

    _wait_until(_jobs_idle)
    status = _status()
    assert status["running"] is False
    assert status["finished"] is True
    assert status["done"] == status["total"] == FILES
    assert status["result"] == {"total": FILES, "added": FILES, "skipped": 0, "errors": []}


def test_a_second_scan_is_refused_while_one_runs(music, monkeypatch):
    """BC-6: one job at a time, and the message names the running job."""
    gate = threading.Event()

    def slow_peaks(path):
        gate.wait(5)
        return PEAKS

    monkeypatch.setattr(library_api, "compute_peaks", slow_peaks)
    _start(music)
    _wait_until(lambda: library_api._scan_state["current_file"] != "")

    res = client.post("/api/library/scan", json={"root_path": str(music)})
    assert res.status_code == 409
    assert "scan" in res.json()["detail"].lower()

    gate.set()
    _wait_until(_jobs_idle)


def test_done_counts_up_from_zero_to_the_total(music, monkeypatch):
    """BC-1/BC-2: before the first file 0 / N, before the last (N-1) / N."""
    seen: list[tuple[int, int]] = []

    def sampling_peaks(path):
        # Read the job state directly: the job thread must not make requests.
        state = library_api._scan_state
        seen.append((state["done"], state["total"]))
        time.sleep(0.02)
        return PEAKS

    monkeypatch.setattr(library_api, "compute_peaks", sampling_peaks)
    _start(music)
    _wait_until(_jobs_idle)

    assert seen == [(0, FILES), (1, FILES), (2, FILES)]
    status = _status()
    assert status["done"] == status["total"] == FILES
    assert status["current_crate"] in {"crate0", "crate1"}


def test_a_file_that_throws_is_recorded_and_the_scan_still_finishes(music, monkeypatch):
    """BC-15's cousin: one bad file never leaves the view spinning."""

    def flaky_metadata(path):
        if Path(path).name == "track1.wav":
            raise RuntimeError("unreadable")
        return {"title": Path(path).stem, "artist": "Dold"}

    monkeypatch.setattr(library_api, "extract_metadata", flaky_metadata)
    _start(music)
    _wait_until(_jobs_idle)

    status = _status()
    assert status["running"] is False
    assert status["finished"] is True
    assert status["done"] == FILES
    assert status["error"] is None
    assert [error for error in status["errors"] if error.startswith("track1.wav: ")]
    assert status["result"]["added"] == FILES - 1
    assert status["result"]["errors"] == status["errors"]


def test_an_unexpected_exception_ends_the_job_with_an_error(music, monkeypatch):
    """An error outside a single file still ends the job, visibly."""

    def explode(store, root, file_path):
        raise RuntimeError("disk exploded")

    monkeypatch.setattr(library_api, "_scan_one", explode)
    _start(music)
    _wait_until(_jobs_idle)

    status = _status()
    assert status["running"] is False
    assert status["finished"] is True
    assert "disk exploded" in status["error"]
    assert status["result"] is None


def test_an_empty_folder_gives_a_total_of_zero(tmp_path):
    """A folder without audio files is a valid scan, not an error."""
    body = _start(tmp_path)
    assert body == {"started": True, "total": 0}

    _wait_until(_jobs_idle)
    status = _status()
    assert status["running"] is False
    assert status["result"] == {"total": 0, "added": 0, "skipped": 0, "errors": []}


def test_an_analysis_is_refused_while_a_scan_runs(music, monkeypatch):
    """BC-6: the two jobs exclude each other in the backend."""
    gate = threading.Event()

    def slow_peaks(path):
        gate.wait(5)
        return PEAKS

    monkeypatch.setattr(library_api, "compute_peaks", slow_peaks)
    _start(music)
    _wait_until(lambda: library_api._scan_state["current_file"] != "")

    res = client.post("/api/library/analyze-all")
    assert res.status_code == 409
    assert "scan" in res.json()["detail"].lower()

    gate.set()


def test_a_scan_is_refused_while_an_analysis_runs(music, monkeypatch):
    """BC-6, the other direction: a scan waits for no one."""
    audio = music / "crate0" / "song.wav"
    audio.write_bytes(b"")
    res = client.post(
        "/api/songs",
        json={"title": "Song", "artist": "Dold", "file_path": str(audio)},
    )
    assert res.status_code == 201

    gate = threading.Event()

    def slow_analysis(path):
        gate.wait(5)
        return {"bpm": 128.0, "musical_key": "Am", "duration": 240.0}

    monkeypatch.setattr(audio_analysis, "analyze_track", slow_analysis)
    assert client.post("/api/library/analyze-all").json()["started"] is True
    _wait_until(lambda: library_api._analyze_state["current_title"] != "")

    res = client.post("/api/library/scan", json={"root_path": str(music)})
    assert res.status_code == 409
    assert "analysis" in res.json()["detail"].lower()

    gate.set()


def test_a_thread_that_cannot_start_releases_the_slot(monkeypatch, tmp_path):
    """A spawn failure must not strand the job slot for the rest of the session."""
    monkeypatch.setattr(
        library_api.threading, "Thread", lambda *a, **k: _UnstartableThread()
    )

    from fastapi.testclient import TestClient as _Client
    from backend.main import app as _app

    # The app's handler re-raises here instead of answering 500.
    with pytest.raises(RuntimeError, match="can't start new thread"):
        _Client(_app, raise_server_exceptions=True).post(
            "/api/library/scan", json={"root_path": str(tmp_path)}
        )

    assert library_api._job is None
    assert library_api._scan_state["running"] is False


class _UnstartableThread:
    """A thread whose start() raises, as the OS can do under thread pressure."""

    def start(self):
        """Fail the way the OS can."""
        raise RuntimeError("can't start new thread")


def test_mixed_case_extensions_are_found(tmp_path):
    """`Song.Mp3` matched neither the lower nor the upper pattern before."""
    from backend.scanner.file_scanner import scan_directory

    for name in ("lower.mp3", "upper.MP3", "mixed.Mp3", "notes.txt"):
        (tmp_path / name).write_bytes(b"")

    found = {path.name for path in scan_directory(str(tmp_path))}

    assert found == {"lower.mp3", "upper.MP3", "mixed.Mp3"}


def test_a_crate_counts_the_same_way_the_filter_does():
    """A row without root_folder belongs to its parent folder, not "Unknown".

    The row is created without `root_folder` on purpose: a scanned row always
    carries one, so it could not tell the two rules apart."""
    from backend.api.library import crate_of
    from backend.storage import get_library_store

    res = client.post(
        "/api/songs", json={"title": "A", "artist": "D", "file_path": "/music/Techno/a.wav"}
    )
    assert res.status_code == 201
    song = get_library_store().get_song(res.json()["id"])
    assert not song.get("root_folder")

    assert crate_of(song) == "Techno"
    assert {row["name"] for row in library_api.list_crates()} == {"Techno"}


class _Recording(dict):
    """A job state that records the order its keys are written in."""

    def __init__(self, data, order):
        super().__init__(data)
        self.order = order

    def __setitem__(self, key, value):
        self.order.append(key)
        super().__setitem__(key, value)


def test_a_job_publishes_its_end_before_it_stops(monkeypatch):
    """`running` is written last, so no status read sees a run that stopped
    without its result (the views would call it vanished)."""
    order: list[str] = []
    # A clean running state: an earlier test may leave an `error`, and then
    # _finish_scan rightly writes no result at all.
    clean = {"running": True, "finished": False, "error": None, "result": None}
    monkeypatch.setattr(
        library_api, "_scan_state", _Recording({**library_api._scan_state, **clean}, order)
    )
    monkeypatch.setattr(library_api, "_job", "scan")
    library_api._finish_scan()
    assert order.index("result") < order.index("running")
    assert order.index("finished") < order.index("running")

    order.clear()
    monkeypatch.setattr(
        library_api, "_analyze_state", _Recording({**library_api._analyze_state, **clean}, order)
    )
    monkeypatch.setattr(library_api, "_job", "analysis")
    library_api._run_analysis(get_library_store(), [])
    assert order.index("result") < order.index("running")
    assert order.index("finished") < order.index("running")
