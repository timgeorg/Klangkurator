"""Audio streaming endpoint — serves library-tracked audio files for the in-app player.

Only paths already stored in library.json are servable (no client-controlled
paths → no traversal). Range requests are supported by starlette's FileResponse,
which enables <audio> seeking in the browser.
"""

import mimetypes
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from backend.config import SUPPORTED_AUDIO_EXTENSIONS
from backend.scanner.waveform import compute_peaks
from backend.storage import get_library_store

router = APIRouter(prefix="/api/audio", tags=["audio"])


@router.get("/{song_id}")
def stream_song(song_id: str):
    store = get_library_store()
    song = store.get_song(song_id)
    if song is None:
        raise HTTPException(404, "Song not found")
    file_path = song.get("file_path")
    if not file_path:
        raise HTTPException(400, "Song has no file_path")
    p = Path(file_path)
    if not p.is_file():
        raise HTTPException(404, f"Audio file not found: {file_path}")
    media_type = mimetypes.guess_type(str(p))[0] or "application/octet-stream"
    # Trust boundary: serve only actual audio files. A library-tracked path
    # pointing elsewhere (e.g. an accidental /etc/passwd import) is rejected.
    if media_type == "application/octet-stream" or p.suffix.lower() not in SUPPORTED_AUDIO_EXTENSIONS:
        raise HTTPException(415, f"Not an audio file: {p.name}")
    # No filename passed → no Content-Disposition header → inline playback,
    # no download dialog in the browser.
    return FileResponse(str(p), media_type=media_type)


@router.get("/waveform/{song_id}")
def get_waveform(song_id: str):
    """Peak envelope for the preview bars (PF-13).

    Returns the peaks persisted at scan time; otherwise computes them once
    and stores them on the song (lazy backfill), or 404s if the file is
    gone. Registered next to `/{song_id}` — FastAPI matches the literal
    segment `/waveform` before the parameter route, so no ordering hack.
    """
    store = get_library_store()
    song = store.get_song(song_id)
    if song is None:
        raise HTTPException(404, "Song not found")

    persisted = song.get("waveform_peaks")
    if persisted:
        return {"song_id": song_id, "peaks": persisted}

    file_path = song.get("file_path")
    if not file_path:
        raise HTTPException(400, "Song has no file_path")
    p = Path(file_path)
    if not p.is_file():
        raise HTTPException(404, f"Audio file not found: {file_path}")

    peaks = compute_peaks(file_path)
    if peaks is None:
        raise HTTPException(422, f"Could not compute waveform: {p.name}")
    store.update_song(song_id, {"waveform_peaks": peaks})
    return {"song_id": song_id, "peaks": peaks}