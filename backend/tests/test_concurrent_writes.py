"""Concurrent saves: library.json stays whole and keeps every write.

Inline edits in the table, the background analysis and the lazy waveform
backfill all write through the same store, often at the same moment.
"""

import json
import threading

from fastapi.testclient import TestClient

from backend.config import LIBRARY_FILE
from backend.main import app
from backend.storage import get_library_store

client = TestClient(app)


def test_concurrent_saves_keep_the_library_file_whole():
    # Large songs make every save slow enough for threads to overlap.
    ids = []
    for i in range(30):
        res = client.post(
            "/api/songs",
            json={
                "title": f"Track {i}",
                "artist": "Dold",
                "file_path": f"/music/track-{i}.mp3",
                "waveform_peaks": [0.5] * 1500,
            },
        )
        assert res.status_code == 201
        ids.append(res.json()["id"])

    store = get_library_store()
    errors: list[Exception] = []

    def edit(worker: int) -> None:
        try:
            for step in range(12):
                song_id = ids[(worker * 12 + step) % len(ids)]
                store.update_song(song_id, {"energy": worker % 6, "mixing_notes": f"w{worker} s{step}"})
        except Exception as error:  # a torn save surfaces here
            errors.append(error)

    threads = [threading.Thread(target=edit, args=(worker,)) for worker in range(8)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert errors == []
    on_disk = json.loads(LIBRARY_FILE.read_text(encoding="utf-8"))
    by_id = {song["id"]: song for song in on_disk["songs"]}
    assert set(ids) <= set(by_id)
    # The file holds the last write of every song, not an older save.
    for song_id in ids:
        assert by_id[song_id]["mixing_notes"] == store.get_song(song_id)["mixing_notes"]
