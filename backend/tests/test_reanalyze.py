"""Per-track re-analyze with an optional BPM range (issue #6, PF-79).

The library-wide job only fills *missing* BPM/key (`analyze_all_missing_bpm`);
this route is the repair path that overrides that for one track, and its BPM
range is a hint that biases the estimate — a result outside the range is
reported, never written.
"""

import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient

from backend.api import library as library_api
from backend.main import app
from backend.scanner import audio_analysis
from backend.storage import get_library_store

client = TestClient(app)

SR = 22050


def _click_track(bpm: float, seconds: float = 60.0) -> np.ndarray:
    """Kick on every beat plus off-beat hats — the probed shape.

    The hats are not decoration: without them the estimator reads a plain
    60–190 BPM band cleanly, and the octave mis-read this feature exists to
    repair does not reproduce.
    """
    n = int(seconds * SR)
    y = np.zeros(n, dtype=np.float32)
    period = 60.0 / bpm
    for i in range(int(seconds / period)):
        t = int(i * period * SR)
        if t + 200 < n:
            kick = np.exp(-np.arange(200) / 20.0) * np.sin(2 * np.pi * 60 * np.arange(200) / SR)
            y[t:t + 200] += 0.8 * kick.astype(np.float32)
    rng = np.random.default_rng(0)
    for i in range(int(seconds / (period / 2))):
        t = int(i * (period / 2) * SR)
        if t + 80 < n:
            hat = rng.standard_normal(80) * np.exp(-np.arange(80) / 6.0)
            y[t:t + 80] += 0.25 * hat.astype(np.float32)
    return y


@pytest.fixture
def track(tmp_path):
    """(song_id, path) for a real click track in the throwaway library.

    `signal_bpm` sets the audio; `**extra` seeds the stored song fields, so
    `track(signal_bpm=174.0, bpm=100.0)` is "a 174 BPM record stored as 100".
    """

    def _make(signal_bpm: float = 174.0, **extra: object) -> tuple[str, str]:
        path = tmp_path / f"track-{signal_bpm}.wav"
        sf.write(path, _click_track(signal_bpm), SR)
        res = client.post(
            "/api/songs",
            json={"title": "Feng Shui", "artist": "Dold", "file_path": str(path), **extra},
        )
        assert res.status_code == 201
        return res.json()["id"], str(path)

    return _make


def test_reanalysis_overwrites_a_value_the_batch_job_would_skip(track):
    song_id, _ = track(signal_bpm=174.0, bpm=100.0, musical_key="Cm")
    res = client.post(f"/api/library/analyze/{song_id}")
    assert res.status_code == 200
    body = res.json()
    # It ran at all (100.0 is not None, so `analyze_all_missing_bpm` would skip).
    assert body["bpm"] is not None
    assert body["bpm"] != 100.0
    # Pin the detected key, so a broken detector (returning None) cannot make
    # the two assertions below vacuously true.
    assert body["musical_key"] is not None
    assert body["musical_key"] != "Cm"
    store = get_library_store()
    assert store.get_song(song_id)["bpm"] == body["bpm"]
    assert store.get_song(song_id)["musical_key"] == body["musical_key"] is not None
    assert "bpm" in body["applied"]


def test_the_range_reaches_the_engine(track, monkeypatch):
    song_id, path = track()
    seen: list[tuple[float, float] | None] = []

    def fake(path_arg, duration_seconds=120.0, bpm_range=None):
        seen.append(bpm_range)
        return {"bpm": 125.0, "musical_key": "Am", "duration": 60.0, "bpm_fit": True}

    monkeypatch.setattr(library_api, "analyze_track", fake)
    res = client.post(f"/api/library/analyze/{song_id}", json={"bpm_min": 124, "bpm_max": 128})
    assert res.status_code == 200
    assert seen == [(124.0, 128.0)]


def test_a_range_steers_the_estimate_into_the_window(track):
    """The probed case: no hint reads the octave wrong, the hint fixes it."""
    song_id, _ = track(signal_bpm=174.0)
    no_hint = client.post(f"/api/library/analyze/{song_id}").json()
    assert no_hint["bpm"] is not None and not (165 <= no_hint["bpm"] <= 185)

    res = client.post(f"/api/library/analyze/{song_id}", json={"bpm_min": 165, "bpm_max": 185})
    body = res.json()
    assert body["bpm_fit"] is True
    assert 165 <= body["bpm"] <= 185
    assert get_library_store().get_song(song_id)["bpm"] == body["bpm"]


def test_bpm_outside_the_range_is_reported_and_never_written(track):
    """BC-4. Probed: a true-128 signal asked for 240–250 lands at ~234.9."""
    song_id, _ = track(signal_bpm=128.0, bpm=128.0)
    res = client.post(f"/api/library/analyze/{song_id}", json={"bpm_min": 240, "bpm_max": 250})
    body = res.json()
    assert body["bpm"] is not None
    assert not (240 <= body["bpm"] <= 250)
    assert body["bpm_fit"] is False
    assert "bpm" not in body["applied"]
    assert get_library_store().get_song(song_id)["bpm"] == 128.0


def test_a_second_analysis_is_refused_while_one_runs(track):
    """`blocking=False`: a held lock answers 409 at once rather than waiting."""
    song_id, _ = track()
    library_api._analyze_lock.acquire()
    try:
        res = client.post(f"/api/library/analyze/{song_id}")
    finally:
        library_api._analyze_lock.release()
    assert res.status_code == 409


def test_a_per_track_run_is_refused_while_a_batch_job_runs(track, monkeypatch):
    """The batch job's lock is free once its thread is spawned, so `running` is
    the guard that has to hold the per-track route back."""
    song_id, _ = track()
    monkeypatch.setitem(library_api._analyze_state, "running", True)
    res = client.post(f"/api/library/analyze/{song_id}")
    assert res.status_code == 409


def test_a_batch_start_is_refused_while_a_per_track_run_holds_the_lock(track):
    """BC-7, both directions: the batch route refuses, it does not wait."""
    library_api._analyze_lock.acquire()
    try:
        res = client.post("/api/library/analyze-all")
    finally:
        library_api._analyze_lock.release()
    assert res.status_code == 409


def test_a_song_with_no_file_is_a_404(track):
    song_id, path = track()
    store = get_library_store()
    store.update_song(song_id, {"file_path": str(path) + ".gone"})
    res = client.post(f"/api/library/analyze/{song_id}")
    assert res.status_code == 404


def test_unknown_song_is_a_404():
    assert client.post("/api/library/analyze/does-not-exist").status_code == 404


@pytest.mark.parametrize(
    "body",
    [
        {"bpm_min": 120},                      # one bound only
        {"bpm_max": 120},                      # one bound only
        {"bpm_min": 140, "bpm_max": 140},      # not below
        {"bpm_min": 180, "bpm_max": 160},      # inverted
        {"bpm_min": 10, "bpm_max": 50},        # below the allowed range
        {"bpm_min": 200, "bpm_max": 300},      # above the allowed range
    ],
)
def test_a_malformed_range_is_refused_before_analysis(track, body):
    song_id, _ = track(signal_bpm=174.0, bpm=100.0, musical_key="Cm")
    res = client.post(f"/api/library/analyze/{song_id}", json=body)
    assert res.status_code == 422
    assert get_library_store().get_song(song_id)["bpm"] == 100.0


def test_a_run_that_changes_nothing_applied_is_empty(track):
    """BC-8: `applied` means changed, not detected."""
    song_id, _ = track(signal_bpm=174.0)
    first = client.post(f"/api/library/analyze/{song_id}").json()
    assert "bpm" in first["applied"]  # nothing stored yet

    again = client.post(f"/api/library/analyze/{song_id}").json()
    assert again["bpm"] == first["bpm"]
    assert again["applied"] == {}


def test_no_bounds_at_all_is_the_same_as_no_body(track):
    song_id, _ = track(signal_bpm=174.0)
    res = client.post(f"/api/library/analyze/{song_id}", json={"bpm_min": None, "bpm_max": None})
    assert res.status_code == 200
    assert res.json()["bpm_fit"] is True


def test_the_batch_job_still_only_fills_missing_values(track):
    """The signature change must not move the batch job off INV-5."""
    song_id, path = track(signal_bpm=174.0, bpm=100.0, musical_key="Cm")
    summary = audio_analysis.analyze_all_missing_bpm(get_library_store())
    assert summary["updated"] == 0
    song = get_library_store().get_song(song_id)
    assert song["bpm"] == 100.0
    assert song["musical_key"] == "Cm"

def test_a_beatless_file_is_not_read_as_zero_bpm(track, tmp_path):
    """beat_track answers 0.0 when the onset envelope has no onsets at all —
    a failed detection, not a tempo. Writing it would be worse than not
    analysing at all: 0 is outside 40–250 and the batch job never revisits it."""
    import numpy as np, soundfile as sf
    path = tmp_path / "silence.wav"
    sf.write(path, np.zeros(SR * 5, dtype=np.float32), SR)
    res = client.post(
        "/api/songs",
        json={"title": "Silence", "artist": "Dold", "file_path": str(path), "bpm": 128.0},
    )
    song_id = res.json()["id"]

    body = client.post(f"/api/library/analyze/{song_id}").json()
    assert body["bpm"] is None
    assert body["bpm_fit"] is False
    assert "bpm" not in body["applied"]
    assert get_library_store().get_song(song_id)["bpm"] == 128.0


def test_a_range_spanning_the_legal_space_behaves_like_no_range(track):
    """The dialog's own placeholders are 40 and 250. A window that wide cannot
    disambiguate octaves, so it must not drag the estimate to the geometric
    centre (40*250 -> 100 BPM) and rewrite a value that was already right."""
    song_id, _ = track(signal_bpm=174.0, bpm=100.0)
    no_range = client.post(f"/api/library/analyze/{song_id}").json()
    wide = client.post(f"/api/library/analyze/{song_id}", json={"bpm_min": 40, "bpm_max": 250}).json()
    assert wide["bpm"] == no_range["bpm"]


def test_out_of_range_still_reports_the_key_it_wrote(track):
    """The key is re-detected in the same run regardless of the BPM hint, so an
    out-of-range run that keeps the BPM must still say the key changed —
    otherwise INV-13's "never silently" is broken for the key half."""
    song_id, _ = track(signal_bpm=128.0, bpm=128.0, musical_key="Cm")
    body = client.post(f"/api/library/analyze/{song_id}", json={"bpm_min": 240, "bpm_max": 250}).json()
    assert body["bpm_fit"] is False
    assert "bpm" not in body["applied"]
    # Either the key genuinely changed and is reported, or the run changed nothing.
    stored = get_library_store().get_song(song_id)
    assert stored["bpm"] == 128.0
    if stored["musical_key"] != "Cm":
        assert body["applied"]["musical_key"] == stored["musical_key"]
