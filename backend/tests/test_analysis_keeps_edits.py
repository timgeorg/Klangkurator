"""Batch analysis never overwrites a BPM or key set by hand while it runs."""

from pathlib import Path

from fastapi.testclient import TestClient

from backend.main import app
from backend.scanner import audio_analysis
from backend.storage import get_library_store

client = TestClient(app)


def test_batch_analysis_keeps_values_edited_during_the_run(tmp_path: Path, monkeypatch):
    ids = []
    for name in ("edited", "untouched"):
        audio = tmp_path / f"{name}.mp3"
        audio.write_bytes(b"")
        res = client.post(
            "/api/songs",
            json={"title": name, "artist": "Dold", "file_path": str(audio), "musical_key": "Cm"},
        )
        ids.append(res.json()["id"])
    edited, untouched = ids
    store = get_library_store()

    def fake_analyze(file_path: str, *args, **kwargs) -> dict:
        # The user edits the first track inline while its analysis runs.
        if file_path.endswith("edited.mp3"):
            store.update_song(edited, {"bpm": 128.0, "musical_key": "Fm"})
        return {"bpm": 140.0, "musical_key": "Am", "duration": 300.0}

    monkeypatch.setattr(audio_analysis, "analyze_track", fake_analyze)
    audio_analysis.analyze_all_missing_bpm(store)

    assert store.get_song(edited)["bpm"] == 128.0
    assert store.get_song(edited)["musical_key"] == "Fm"
    assert store.get_song(untouched)["bpm"] == 140.0
    assert store.get_song(untouched)["musical_key"] == "Am"
