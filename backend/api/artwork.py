"""Artwork serving endpoint — streams scan-time extracted cover thumbnails (PF-14).

Files are written by backend.scanner.artwork at scan/backfill time and served
straight from the artwork directory. Only {song_id}.jpg inside the artwork
dir is reachable (the .jpg suffix is appended client-side, and song ids are
store-generated uuid4s), so no traversal outside ARTWORK_DIR is possible.
"""

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from backend.config import ARTWORK_DIR

router = APIRouter(prefix="/api/artwork", tags=["artwork"])


@router.get("/{song_id}")
def get_artwork(song_id: str):
    """Serve the extracted cover thumbnail for a song."""
    path = ARTWORK_DIR / f"{song_id}.jpg"
    if not path.is_file():
        raise HTTPException(404, "No artwork")
    # Covers are immutable per song → weak etag (song id) + 1-day cache.
    return FileResponse(
        str(path),
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400", "ETag": f'"{song_id}"'},
    )