"""Audio streaming endpoint — serves library-tracked audio files for the in-app player.

Only paths already stored in library.json are servable (no client-controlled
paths → no traversal). Range requests are supported by starlette's FileResponse,
which enables <audio> seeking in the browser.

A track may hold several files (issue #65, [[18_AUDIO_VARIANTS]]). The primary
plays; when its file is gone, a variant plays instead, and the response names
the file it served so the player can say which one that was.
"""

import mimetypes
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from backend.config import SUPPORTED_AUDIO_EXTENSIONS
from backend.scanner.waveform import compute_peaks
from backend.storage import get_library_store

router = APIRouter(prefix="/api/audio", tags=["audio"])


def _servable(path: str) -> Path | None:
    """The file at `path` when it exists and is audio this app may serve.

    Args:
        path (str): A library-stored path (primary or variant).

    Returns:
        Path | None: The file, or None when it is gone or not audio.
    """
    p = Path(path)
    if not p.is_file():
        return None
    media_type = mimetypes.guess_type(str(p))[0] or "application/octet-stream"
    # Trust boundary: serve only actual audio files. A library-tracked path
    # pointing elsewhere (e.g. an accidental /etc/passwd import) is rejected.
    if media_type == "application/octet-stream" or p.suffix.lower() not in SUPPORTED_AUDIO_EXTENSIONS:
        return None
    return p


def choose_playable(song: dict) -> tuple[Path, str] | None:
    """The file playback must use: the primary, else the first playable variant.

    Falling back is a repair, not a preference: the primary is what the user
    chose, and only a missing file gives way (AC-9).

    Args:
        song (dict): A stored song.

    Returns:
        tuple[Path, str] | None: The file and which slot it came from
        (`"primary"` or `"variant"`), or None when nothing is playable.
    """
    primary = song.get("file_path")
    if primary:
        p = _servable(primary)
        if p is not None:
            return p, "primary"
    for variant in song.get("audio_variants") or []:
        p = _servable(variant.get("file_path") or "")
        if p is not None:
            return p, "variant"
    return None


@router.get("/{song_id}")
def stream_song(song_id: str):
    """Stream the track's primary file, or a variant when the primary is gone.

    The response names the served file in `X-Klangkurator-File` and its slot in
    `X-Klangkurator-Source`, so a caller can state which file played (AC-10).
    The player itself reads the same facts from the row (`primary_missing`),
    which keeps a page that never streams from asking for them.

    Args:
        song_id (str): The track.

    Returns:
        FileResponse: The audio.

    Raises:
        HTTPException: 404 for an unknown track or when no file is playable,
            400 for a track without any path.
    """
    store = get_library_store()
    song = store.get_song(song_id)
    if song is None:
        raise HTTPException(404, "Song not found")
    if not song.get("file_path") and not song.get("audio_variants"):
        raise HTTPException(400, "Song has no file_path")
    picked = choose_playable(song)
    if picked is None:
        raise HTTPException(404, f"Audio file not found: {song.get('file_path')}")
    p, source = picked
    media_type = mimetypes.guess_type(str(p))[0] or "application/octet-stream"
    # No filename passed → no Content-Disposition header → inline playback,
    # no download dialog in the browser.
    return FileResponse(
        str(p),
        media_type=media_type,
        headers={
            "X-Klangkurator-File": p.name,
            "X-Klangkurator-Source": source,
        },
    )


@router.get("/waveform/{song_id}")
def get_waveform(song_id: str):
    """Peak envelope for the preview bars (PF-13).

    Returns the peaks persisted at scan time; otherwise computes them once
    and stores them on the song (lazy backfill), or 404s if the file is
    gone. Registered next to `/{song_id}` — FastAPI matches the literal
    segment `/waveform` before the parameter route, so no ordering hack.

    The waveform follows the primary (18_AUDIO_VARIANTS: the row's duration and
    waveform come from the primary) and, like playback, falls back to a variant
    when the primary's file is gone.

    Args:
        song_id (str): The track.

    Returns:
        dict: `{song_id, peaks}`.

    Raises:
        HTTPException: 404 for an unknown track or a file that is gone, 400 for
            a track without any path, 422 when the file cannot be decoded.
    """
    store = get_library_store()
    song = store.get_song(song_id)
    if song is None:
        raise HTTPException(404, "Song not found")

    persisted = song.get("waveform_peaks")
    if persisted:
        return {"song_id": song_id, "peaks": persisted}

    if not song.get("file_path") and not song.get("audio_variants"):
        raise HTTPException(400, "Song has no file_path")

    picked = choose_playable(song)
    if picked is None:
        raise HTTPException(404, f"Audio file not found: {song.get('file_path')}")
    p, _source = picked

    peaks = compute_peaks(str(p))
    if peaks is None:
        raise HTTPException(422, f"Could not compute waveform: {p.name}")
    store.update_song(song_id, {"waveform_peaks": peaks})
    return {"song_id": song_id, "peaks": peaks}
