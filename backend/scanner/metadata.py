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
        try:
            val = tags.get(key)
        except (ValueError, KeyError):
            # mutagen's VComment.get raises ValueError for unknown keys
            continue
        if val is None:
            continue
        # VComment/MP4/ID3 values are frequently lists — take the first entry
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
        # VComment entries are plain strings; MP4 freeform may be other types
        elif isinstance(val, (str, int, float)) and str(val).strip():
            return str(val).strip()
    return None


def file_facts(file_path: str) -> dict:
    """What the file itself is: format, duration, bitrate, sample rate, bit depth, size.

    A variant records these instead of re-probing the file at render time: a
    `.wav` beside an `.mp3` is 36 MB and 9.9 MB, and probing every row of a
    listing is not affordable ([[18_AUDIO_VARIANTS]]).

    Args:
        file_path (str): The audio file.

    Returns:
        dict: `format` (the suffix without the dot, lowercased), `duration`,
        `bitrate`, `sample_rate`, `bit_depth`, `size_bytes`. A value that
        cannot be read is None. `format` falls back to the suffix when
        `mutagen` cannot open the file, so an attach never fails on that.
    """
    path = Path(file_path)
    facts: dict = {
        "format": path.suffix.lstrip(".").lower(),
        "duration": None,
        "bitrate": None,
        "sample_rate": None,
        "bit_depth": None,
        "size_bytes": None,
    }
    try:
        facts["size_bytes"] = path.stat().st_size
    except OSError:
        pass

    try:
        audio = mutagen.File(file_path)
    except Exception:  # noqa: BLE001 — facts stay None; the attach still lands
        audio = None
    info = getattr(audio, "info", None)
    if info is None:
        return facts

    facts["duration"] = _number(info, "length")
    # Mutagen reports bits per second; the UI talks kbps.
    bitrate = _number(info, "bitrate")
    facts["bitrate"] = int(round(bitrate / 1000)) if bitrate else None
    facts["sample_rate"] = _int(info, "sample_rate")
    facts["bit_depth"] = _int(info, "bits_per_sample") or _int(info, "bit_depth")
    return facts


def _number(info, attr: str) -> float | None:
    """One numeric attribute of a mutagen info object, or None."""
    value = getattr(info, attr, None)
    return float(value) if isinstance(value, (int, float)) and value > 0 else None


def _int(info, attr: str) -> int | None:
    """One integer attribute of a mutagen info object, or None."""
    value = getattr(info, attr, None)
    return int(value) if isinstance(value, (int, float)) and value > 0 else None


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
