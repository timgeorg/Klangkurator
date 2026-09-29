"""Embedded artwork extraction — scan-time preprocessing (PF-14).

Cover art is extracted once per track at library-scan time (decision a) and
re-encoded as a small thumbnail: max 300px on the long edge, JPEG q80. The
thumbnail is written to ~/.klangkurator/artwork/{song_id}.jpg and served via
GET /api/artwork/{song_id}; the song stores only the API path in
`artwork_url`.

Why 300px (decision a): rows render covers at 32px and the detail view at
~300px, so re-encoding to a bounded size keeps the artwork dir ~10-50KB per
track regardless of source size — no multi-MB embedded art is ever shipped
to the frontend. Tracks scanned before this feature backfill via
POST /api/library/scan-artwork.
"""

import logging
from io import BytesIO
from pathlib import Path

import mutagen
from PIL import Image

from backend.config import ARTWORK_DIR

logger = logging.getLogger(__name__)


def extract_artwork(file_path: str, song_id: str, max_size: int = 300) -> str | None:
    """Extract embedded cover art, re-encode as thumbnail, return API path (PF-14).

    Reads the embedded image via mutagen (ID3 APIC frames for MP3/AIFF, FLAC
    pictures, MP4 'covr'); WAV/OGG are skipped — they carry no standardized
    art container. The image is converted to RGB, thumbnail'd to `max_size`
    on the long edge (aspect preserved), and saved as JPEG q80 to
    ARTWORK_DIR/{song_id}.jpg. Art below 16px on any edge is rejected as junk.

    Returns:
        "/api/artwork/{song_id}" on success, None on any failure (no embedded
        art, unsupported format, corrupt image data). Failures are logged at
        debug — a track without usable art must never break a scan.
    """
    try:
        data = _artwork_bytes(file_path)
        if data is None:
            return None

        img = Image.open(BytesIO(data)).convert("RGB")
        width, height = img.size
        if width < 16 or height < 16:
            logger.debug("Artwork too small (%dx%d): %s", width, height, file_path)
            return None

        out_path = ARTWORK_DIR / f"{song_id}.jpg"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        img.thumbnail((max_size, max_size))
        img.save(out_path, format="JPEG", quality=80)
        return f"/api/artwork/{song_id}"
    except Exception as e:
        logger.debug("Artwork extraction failed for %s: %s", file_path, e)
        return None


def _artwork_bytes(file_path: str) -> bytes | None:
    """Raw embedded image bytes, per container; None when absent/unsupported."""
    path = Path(file_path)
    try:
        audio = mutagen.File(str(path))
    except Exception as e:
        logger.debug("mutagen failed to open %s: %s", file_path, e)
        return None
    if audio is None:
        return None

    tags = getattr(audio, "tags", None)

    # MP3/AIFF (and rare ID3-chunked WAVs): ID3 tags with APIC frames
    if tags is not None and hasattr(tags, "getall"):
        frames = tags.getall("APIC")
        return frames[0].data if frames else None

    # FLAC: picture blocks; prefer type 3 (front cover) when present
    pictures = getattr(audio, "pictures", None)
    if pictures:
        front = next((p for p in pictures if getattr(p, "type", 0) == 3), None)
        return (front or pictures[0]).data

    # MP4/M4A: 'covr' tag (list of bytes-like)
    if tags is not None:
        covr = tags.get("covr")
        if covr:
            return bytes(covr[0])

    # WAV/OGG: no standardized art container → skip
    return None