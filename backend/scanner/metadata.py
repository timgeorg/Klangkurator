"""Audio metadata extraction using mutagen."""

from pathlib import Path

import mutagen


def extract_metadata(file_path: str) -> dict:
    """Extract metadata from an audio file.

    Returns dict with keys: title, artist, album, year, bpm, musical_key,
    duration, genre. Missing fields are None.
    """
    path = Path(file_path)

    try:
        audio = mutagen.File(file_path)
    except Exception as e:
        return _fallback_metadata(path, f"mutagen.File error: {e}")

    if audio is None:
        return _fallback_metadata(path, "mutagen returned None")

    if not hasattr(audio, "info") or audio.info is None:
        return _fallback_metadata(path, "no info attribute")

    # Duration is available on all formats
    duration = float(audio.info.length) if hasattr(audio.info, "length") else None

    # Extract format-specific tags
    if hasattr(audio, "tags") and audio.tags:
        return _extract_tags(audio, duration, path)
    else:
        return _fallback_metadata(path, "no tags", duration)


def _extract_tags(audio, duration: float | None, path: Path) -> dict:
    """Try to extract tags from various audio formats."""
    tags = audio.tags

    # ID3 (MP3)
    if hasattr(tags, "get"):
        title = _get_tag(tags, "TIT2", "title", "\xa9nam")
        artist = _get_tag(tags, "TPE1", "artist", "\xa9ART", "TPE2", "TPE3")
        album = _get_tag(tags, "TALB", "album", "\xa9albm")
        year_str = _get_tag(tags, "TDRC", "date", "\xa9day", "TYER")
        bpm_str = _get_tag(tags, "TBPM", "bpm", "tmpo")
        key = _get_tag(tags, "TKEY", "initialkey", "key", "--com.apple.iTunes", "TMOO")
        genre = _get_tag(tags, "TCON", "genre", "\xa9gen")

        # Parse year
        year = None
        if year_str:
            try:
                year = int(year_str[:4])
            except (ValueError, IndexError):
                pass

        # Parse BPM
        bpm = None
        if bpm_str:
            try:
                bpm = float(bpm_str)
            except ValueError:
                pass

        return {
            "title": title,
            "artist": artist,
            "album": album,
            "year": year,
            "bpm": bpm,
            "musical_key": key,
            "duration": duration,
            "genre": genre,
        }

    return _fallback_metadata(path, "unreadable tags", duration)


def _get_tag(tags, *keys) -> str | None:
    """Try multiple tag keys and return the first string value found."""
    for key in keys:
        val = tags.get(key)
        if val is None:
            continue
        # Handle mutagen ID3 frames (list of Frame objects)
        if isinstance(val, list):
            if len(val) > 0:
                val = val[0]
            else:
                continue
        # ID3 frames have a .text attribute
        if hasattr(val, "text"):
            text = val.text
            if isinstance(text, list):
                text = text[0] if text else None
            if text:
                return str(text).strip() or None
        # VComment tags are simple strings
        elif isinstance(val, str) and val.strip():
            return val.strip()
        # MP4 tags: numeric values stored as list of ints
        elif isinstance(val, (int, float)):
            return str(val)
    return None


def _fallback_metadata(path: Path, reason: str = "", duration: float | None = None) -> dict:
    """Return metadata with fallbacks when tag extraction fails."""
    return {
        "title": path.stem,
        "artist": "Unknown Artist",
        "album": None,
        "year": None,
        "bpm": None,
        "musical_key": None,
        "duration": duration,
        "genre": None,
    }
