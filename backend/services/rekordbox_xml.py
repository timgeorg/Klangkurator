"""Write a Rekordbox playlist XML file (`DJ_PLAYLISTS`, version 1.0.0).

Rekordbox imports a playlist from this file, and it exports the same file itself,
so the format is the one Pioneer documents in *XML file format for playlists
sharing*. The writer here is pure: it takes plain dictionaries and returns text, so
the format rules are unit-testable without Rekordbox, a library, or a file system.

See `docs/requirements/31a_REKORDBOX_PLAYLIST_EXPORT.md` for what each attribute
is for and which fields it deliberately leaves out.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from urllib.parse import quote
from xml.sax.saxutils import escape, quoteattr

# Rekordbox stores a rating as one of six values, not a star count. The app keeps
# 0-5 stars (`rank`), so the table is the whole mapping — taken from the published
# format, not guessed.
RATING_TABLE = {0: 0, 1: 51, 2: 102, 3: 153, 4: 204, 5: 255}

# Rekordbox's own spellings for the 12 minor and 12 major keys. The app may hold
# "Bb" where Rekordbox expects "A#", so minors are normalised through this table.
_KEY_ALIASES = {
    "bb": "A#",
    "db": "C#",
    "eb": "D#",
    "gb": "F#",
    "ab": "G#",
    "cb": "B",
    "fb": "E",
}

# The keys Rekordbox accepts. A value outside this set is dropped rather than
# written, because Rekordbox refuses a `Tonality` it does not know.
_MAJOR = {"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"}
_MINOR = {f"{k}m" for k in _MAJOR}


@dataclass
class ExportTrack:
    """One track as the XML needs it — already resolved from the app's models."""

    track_id: int
    name: str
    location: str
    artist: str | None = None
    genre: str | None = None
    size: int | None = None
    total_time: int | None = None
    average_bpm: float | None = None
    tonality: str | None = None
    rating: int = 0
    comments: str | None = None
    date_added: date | None = None
    kind: str | None = None


@dataclass
class ExportPlaylist:
    """One playlist node: a set, in the set's own order."""

    name: str
    track_ids: list[int] = field(default_factory=list)


def file_uri(path: str) -> str:
    """The `Location` value Rekordbox needs for a local file.

    Rekordbox wants an absolute URI, not a path: `file://localhost/` plus the
    percent-encoded path. Spaces, `#`, apostrophes and non-ASCII characters all
    appear in this library's root, so every character outside the unreserved set
    is encoded rather than passed through.

    Args:
        path (str): An absolute or relative filesystem path.

    Returns:
        str: The `file://localhost/...` URI.

    Raises:
        ValueError: When the path is empty.
    """
    if not path:
        raise ValueError("A track needs a file path to be exported.")
    absolute = str(Path(path).resolve())
    # `quote` with no safe characters encodes `/` too; the separator has to stay.
    encoded = quote(absolute, safe="/")
    return f"file://localhost{encoded}"


def normalise_tonality(key: str | None) -> str | None:
    """Map the app's key spelling to Rekordbox's, or None when it cannot.

    Rekordbox accepts the 24 keys with sharps. The app may hold a flat spelling
    ("Bb", "Ebm"), so flats are converted. An unrecognised value returns None and
    the caller leaves the attribute out — an absent `Tonality` beats a wrong one.

    Args:
        key (str | None): The app's `musical_key`, e.g. "F#m" or "Bb".

    Returns:
        str | None: Rekordbox's spelling, or None when it has no slot for it.
    """
    if not key:
        return None
    value = key.strip()
    if not value:
        return None
    minor = value.endswith("m") and not value.endswith("aj")
    root = value[:-1] if minor else value
    root = root.replace("♯", "#").replace("♭", "b").strip()
    if not root:
        return None
    # "Amin"/"Amaj" spellings: strip the mode word.
    for suffix in ("min", "maj"):
        if root.lower().endswith(suffix):
            root = root[: -len(suffix)]
            minor = suffix == "min"
            break
    if not root:
        return None
    note = root[0].upper() + root[1:]
    alias = _KEY_ALIASES.get(note.lower())
    if alias:
        note = alias
    if note not in _MAJOR:
        return None
    candidate = f"{note}m" if minor else note
    return candidate if candidate in (_MAJOR | _MINOR) else None


def rating_for(rank: int | None) -> int:
    """The Rekordbox rating for a 0-5 star rank.

    Args:
        rank (int | None): The app's `rank`.

    Returns:
        int: One of 0, 51, 102, 153, 204, 255.
    """
    if rank is None:
        return 0
    return RATING_TABLE.get(max(0, min(5, int(rank))), 0)


def kind_for(path: str) -> str | None:
    """Rekordbox's `Kind` label for a file, from its extension.

    Args:
        path (str): The file path.

    Returns:
        str | None: e.g. "MP3 File", or None for an extension Rekordbox does not name.
    """
    suffix = Path(path).suffix.lower().lstrip(".")
    return {
        "mp3": "MP3 File",
        "m4a": "M4A File",
        "aac": "AAC File",
        "flac": "FLAC File",
        "wav": "WAV File",
        "aiff": "AIFF File",
        "aif": "AIFF File",
        "ogg": "OGG File",
    }.get(suffix)


def _date_added(value: date | datetime | None) -> str | None:
    """`DateAdded` is the calendar date in Rekordbox's own format."""
    if value is None:
        return None
    if isinstance(value, datetime):
        value = value.date()
    return value.strftime("%Y-%m-%d")


def _bpm(value: float | None) -> str | None:
    """`AverageBpm` carries two decimals. Zero is a failed reading, so it is dropped."""
    if value is None or value <= 0:
        return None
    return f"{value:.2f}"


def _track_element(track: ExportTrack) -> str:
    """One `<TRACK>` inside `<COLLECTION>`.

    Attributes the app cannot fill are left out entirely: an absent attribute is
    read as "unknown" by Rekordbox, while `AverageBpm="0"` or a made-up key is
    wrong data in a DJ-visible column.
    """
    attrs: list[tuple[str, str]] = [("TrackID", str(track.track_id))]
    attrs.append(("Name", track.name))

    kind = track.kind or kind_for(track.location)
    if track.artist:
        attrs.append(("Artist", track.artist))
    if track.genre:
        attrs.append(("Genre", track.genre))
    if kind:
        attrs.append(("Kind", kind))
    if track.size is not None and track.size > 0:
        attrs.append(("Size", str(track.size)))
    if track.total_time is not None and track.total_time > 0:
        attrs.append(("TotalTime", str(int(track.total_time))))
    bpm = _bpm(track.average_bpm)
    if bpm:
        attrs.append(("AverageBpm", bpm))
    tonality = normalise_tonality(track.tonality)
    if tonality:
        attrs.append(("Tonality", tonality))
    attrs.append(("Rating", str(track.rating)))
    if track.comments:
        attrs.append(("Comments", track.comments))
    added = _date_added(track.date_added)
    if added:
        attrs.append(("DateAdded", added))
    attrs.append(("Location", file_uri(track.location)))

    body = " ".join(f"{name}={quoteattr(value)}" for name, value in attrs)
    return f"    <TRACK {body}/>"


def _playlist_node(playlist: ExportPlaylist) -> str:
    """One `<NODE Type="1">`: a playlist holding the set's tracks in order."""
    entries = len(playlist.track_ids)
    lines = [
        f'      <NODE Name={quoteattr(playlist.name)} Type="1" KeyType="0" Entries="{entries}">'
    ]
    lines.extend(f'        <TRACK Key="{key}"/>' for key in playlist.track_ids)
    lines.append("      </NODE>")
    return "\n".join(lines)


def build_xml(
    tracks: list[ExportTrack],
    playlists: list[ExportPlaylist],
    *,
    product_name: str = "Klangkurator",
    product_version: str = "0.1.0",
    company: str = "",
) -> str:
    """Build a complete `DJ_PLAYLISTS` document.

    `TRACK Key` in a playlist is the export's own 1-based key, not the app's song
    id: Rekordbox matches a playlist entry to a collection entry through `Key` and
    `TrackID`, so the two are numbered together here and the app's ids never leak
    into the file.

    Args:
        tracks (list[ExportTrack]): The tracks to write, one per collection entry.
        playlists (list[ExportPlaylist]): The sets, each with the track ids it holds
            in the order it holds them. An id that is not in `tracks` is skipped.
        product_name (str): The `PRODUCT` name.
        product_version (str): The `PRODUCT` version.
        company (str): The `PRODUCT` company. Empty is what Rekordbox writes.

    Returns:
        str: The XML document, UTF-8 text.

    Raises:
        ValueError: When a playlist names a track that is not in `tracks`, because
            an entry Rekordbox cannot resolve is a broken import.
    """
    known = {track.track_id for track in tracks}
    for playlist in playlists:
        missing = [key for key in playlist.track_ids if key not in known]
        if missing:
            raise ValueError(
                f'Playlist "{playlist.name}" names tracks that are not exported: {missing}'
            )

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<DJ_PLAYLISTS Version="1.0.0">',
        f'  <PRODUCT Name={quoteattr(product_name)} Version={quoteattr(product_version)} '
        f'Company={quoteattr(company)}/>',
        f'  <COLLECTION Entries="{len(tracks)}">',
    ]
    lines.extend(_track_element(track) for track in tracks)
    lines.append("  </COLLECTION>")
    lines.append("  <PLAYLISTS>")
    lines.append(f'    <NODE Type="0" Name="ROOT" Count="{len(playlists)}">')
    lines.extend(_playlist_node(playlist) for playlist in playlists)
    lines.append("    </NODE>")
    lines.append("  </PLAYLISTS>")
    lines.append("</DJ_PLAYLISTS>")
    return "\n".join(lines) + "\n"


def size_of(path: str) -> int | None:
    """The file's size for the `Size` attribute, or None when it cannot be read.

    Args:
        path (str): The audio file path.

    Returns:
        int | None: The size in bytes.
    """
    try:
        return os.path.getsize(path)
    except OSError:
        return None
