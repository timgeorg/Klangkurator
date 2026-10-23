"""The curated tool surface (REQ-34-TS): 24 tools, no deletion.

A generated server would hand a model all 39 endpoints, including
`DELETE /api/songs/{id}`. This one exposes what an agent needs to read and
curate, and nothing destructive.

Two rules live here rather than in the app:
- every track-bearing result drops `waveform_peaks` except `get_track`;
- `update_track` sends only the fields the caller set, so a partial body can
  never blank one.
"""

import json
from pathlib import Path
from typing import Any

from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from mcp.types import ToolAnnotations

from mcp_server import config
from mcp_server.client import call

READ = ToolAnnotations(read_only_hint=True, destructive_hint=False, open_world_hint=False)
#: `destructive_hint` defaults to True when omitted, so every write names it.
WRITE = ToolAnnotations(read_only_hint=False, destructive_hint=False, open_world_hint=False)
#: A repeat call leaves the same state: update_track, tag_track, set_library_root.
IDEMPOTENT = ToolAnnotations(
    read_only_hint=False, destructive_hint=False, open_world_hint=False, idempotent_hint=True
)

#: The relationship types the app knows (src/lib/storage.ts:84).
RELATIONSHIP_TYPES = (
    "remix", "same_sample", "cover", "mashup", "edit", "bootleg", "in_playlist", "transition",
)

#: The palette's fallback (src/lib/palette.ts:38), used when a tag has no colour.
FALLBACK_COLOR = "#A1A2B3"

server = MCPServer(
    name="klangkurator",
    instructions=(
        "Read and curate a local Klangkurator DJ library. The library is "
        "plain JSON on this machine; the app is the only writer, so every tool "
        "forwards to it. Start the app with ./run.sh."
    ),
)


# ── Library ──────────────────────────────────────────────


def _slim(song: dict) -> dict:
    """One song without its waveform envelope (REQ-10-SL).

    Args:
        song (dict): A song row from the API.

    Returns:
        dict: The row with `waveform_peaks` removed.
    """
    return {key: value for key, value in song.items() if key != "waveform_peaks"}


@server.tool(annotations=READ)
def list_crates() -> list[dict]:
    """List the library's crates (its music subfolders) with their track counts.

    Returns:
        list[dict]: One `{name, track_count}` per crate.
    """
    return call("GET", "/api/library/crates")


@server.tool(annotations=READ)
def search_tracks(
    query: str | None = None,
    crate: str | None = None,
    genre: str | None = None,
    key: str | None = None,
    bpm_min: float | None = None,
    bpm_max: float | None = None,
    missing_bpm: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """Search the library, with the table's own filter rules and explicit paging.

    Args:
        query (str | None): Matches title, artist, main genre, subgenres,
            genres, legacy genre, key or album.
        crate (str | None): Exact crate (the song's `root_folder`).
        genre (str | None): Any of main genre, genres or legacy genre.
        key (str | None): Exact musical key.
        bpm_min (float | None): Lowest BPM, inclusive.
        bpm_max (float | None): Highest BPM, inclusive.
        missing_bpm (bool): Only tracks without a BPM. Not combined with the
            BPM bounds.
        limit (int): Page size (1–500).
        offset (int): Rows to skip.

    Returns:
        dict: `{total, returned, offset, tracks}`; the tracks are slim.

    Raises:
        ToolError: `missing_bpm` and a BPM bound were both given.
    """
    if missing_bpm and (bpm_min is not None or bpm_max is not None):
        raise ToolError("missing_bpm cannot be combined with bpm_min or bpm_max")
    if not 1 <= limit <= 500:
        raise ToolError("limit must be between 1 and 500")
    if offset < 0:
        raise ToolError("offset must be zero or more")

    songs = call("GET", "/api/songs", params={"slim": "true"})
    filters = {
        "query": query, "crate": crate, "genre": genre, "key": key,
        "bpm_min": bpm_min, "bpm_max": bpm_max, "missing_bpm": missing_bpm,
    }
    matching = [_slim(song) for song in songs if _matches(song, filters)]
    return {
        "total": len(matching),
        "returned": len(matching[offset:offset + limit]),
        "offset": offset,
        "tracks": matching[offset:offset + limit],
    }


def _matches(song: dict, filters: dict) -> bool:
    """Whether one song passes every given filter — the table's predicate.

    Args:
        song (dict): A slim song row.
        filters (dict): The given filters; a None or False value is not applied.

    Returns:
        bool: True when the row passes every filter that was given.
    """
    if filters["query"] and not _matches_text(song, filters["query"]):
        return False
    if filters["crate"] is not None and _crate_of(song) != filters["crate"]:
        return False
    if filters["genre"] is not None and filters["genre"] not in _genres_of(song):
        return False
    if filters["key"] is not None and song.get("musical_key") != filters["key"]:
        return False
    return _matches_bpm(song.get("bpm"), filters["missing_bpm"], filters["bpm_min"], filters["bpm_max"])


def _matches_text(song: dict, query: str) -> bool:
    """Whether the free-text search hits any field the table searches.

    Args:
        song (dict): A slim song row.
        query (str): The search text.

    Returns:
        bool: True on a hit.
    """
    needle = query.strip().lower()
    haystack = [
        song.get("title") or "",
        song.get("artist") or "",
        song.get("mainGenre") or song.get("main_genre") or "",
        song.get("genre") or "",
        song.get("musical_key") or "",
        song.get("album") or "",
        *(song.get("subgenres") or []),
        *(song.get("genres") or []),
    ]
    return any(needle in str(value).lower() for value in haystack)


def _matches_bpm(
    bpm: float | None, missing_bpm: bool, bpm_min: float | None, bpm_max: float | None
) -> bool:
    """Whether a BPM passes the given BPM filters.

    Args:
        bpm (float | None): The song's BPM.
        missing_bpm (bool): Only rows without a BPM.
        bpm_min (float | None): Lowest BPM, inclusive.
        bpm_max (float | None): Highest BPM, inclusive.

    Returns:
        bool: True when the value passes; a bound excludes a missing BPM, as
        the table's own BPM filter does.
    """
    if missing_bpm:
        return bpm is None
    if bpm_min is not None and (bpm is None or bpm < bpm_min):
        return False
    if bpm_max is not None and (bpm is None or bpm > bpm_max):
        return False
    return True


def _crate_of(song: dict) -> str:
    """A song's crate, with the same rule `list_crates` counts by.

    Kept identical to the app's `crateOf` (src/lib/trackFormat.ts) and the
    backend's `crate_of`, so a crate an agent is told about can be filtered to.

    Args:
        song (dict): A song row.

    Returns:
        str: `root_folder`, else the file's parent folder, else "Unknown".
    """
    if song.get("root_folder"):
        return str(song["root_folder"])
    path = song.get("file_path")
    parent = Path(str(path)).parent.name if path else ""
    return parent or "Unknown"


def _genres_of(song: dict) -> set[str]:
    """Every genre label a song carries.

    Args:
        song (dict): A song row.

    Returns:
        set[str]: Main genre, legacy genres and legacy genre, without empties.
    """
    values = [song.get("mainGenre") or song.get("main_genre"), song.get("genre")]
    values.extend(song.get("genres") or [])
    return {str(value) for value in values if value}


@server.tool(annotations=READ)
def get_track(song_id: str) -> dict:
    """One track, with its waveform peaks — the only tool that carries them.

    Args:
        song_id (str): The track's id.

    Returns:
        dict: The full song row.
    """
    return call("GET", f"/api/songs/{song_id}")


@server.tool(annotations=IDEMPOTENT)
def update_track(
    song_id: str,
    title: str | None = None,
    artist: str | None = None,
    album: str | None = None,
    bpm: float | None = None,
    musical_key: str | None = None,
    duration: float | None = None,
    main_genre: str | None = None,
    subgenres: list[str] | None = None,
    genre: str | None = None,
    genres: list[str] | None = None,
    year: int | None = None,
    energy: float | None = None,
    people: float | None = None,
    rank: int | None = None,
    drum_notes: str | None = None,
    element_notes: str | None = None,
    mixing_notes: str | None = None,
    lyrics: str | None = None,
    phase_tags: list[str] | None = None,
    vibe_tags: list[str] | None = None,
    transition_notes: str | None = None,
    root_folder: str | None = None,
) -> dict:
    """Change the fields you name, and only those.

    An argument left unset is not sent, so a partial call can never blank a
    field; to empty one, do it in the app. Repeating the same call changes
    nothing. `main_genre`, `energy` and `people` are the field names the app
    documents; the rest follow the stored song model.

    Args:
        song_id (str): The track's id.
        **Every other argument**: the new value for that field.

    Returns:
        dict: The updated song, slim.

    Raises:
        ToolError: No field was given.
    """
    _require_write()
    fields = _named_fields(
        locals(), exclude=("song_id",), rename={"main_genre": "mainGenre"}
    )
    if not fields:
        raise ToolError(
            "Give at least one field to change, e.g. energy=3.5. "
            "To clear a field, do it in the app."
        )
    return _slim(call("PUT", f"/api/songs/{song_id}", json=fields))


def _named_fields(
    values: dict, exclude: tuple[str, ...] = (), rename: dict | None = None
) -> dict:
    """The arguments a caller actually set, ready to send.

    Args:
        values (dict): The caller's locals.
        exclude (tuple[str, ...]): Names that are not song fields.
        rename (dict | None): Wire names that differ from the model field.

    Returns:
        dict: Field name -> value, without the unset (None) ones.
    """
    rename = rename or {}
    return {
        rename.get(name, name): value
        for name, value in values.items()
        if name not in exclude and value is not None and not name.startswith("_")
    }


# ── Import ──────────────────────────────────────────────


@server.tool(annotations=WRITE)
def scan_library(root_path: str) -> dict:
    """Start a background scan of a folder; poll `scan_status` for progress.

    Args:
        root_path (str): The music folder, inside the allowed roots.

    Returns:
        dict: `{started, total}`.
    """
    _require_write()
    _require_allowed_root(root_path)
    return call("POST", "/api/library/scan", json={"root_path": root_path})


@server.tool(annotations=READ)
def scan_status() -> dict:
    """The running or last scan: progress, current file, and its result.

    Returns:
        dict: `running`, `finished`, `done`, `total`, `current_file`,
        `current_crate`, `added`, `skipped`, `errors`, `result`, `error`.
    """
    return call("GET", "/api/library/scan-status")


@server.tool(annotations=READ)
def get_library_root() -> dict:
    """The music folder the app is configured to read.

    Returns:
        dict: `{root_path}` (`None` when unset).
    """
    return call("GET", "/api/library/root")


@server.tool(annotations=IDEMPOTENT)
def set_library_root(root_path: str) -> dict:
    """Point the app at a music folder. Changes no track on its own.

    Args:
        root_path (str): The folder, inside the allowed roots.

    Returns:
        dict: `{root_path}`.
    """
    _require_write()
    _require_allowed_root(root_path)
    return call("PUT", "/api/library/root", json={"root_path": root_path})


# ── Analysis ────────────────────────────────────────────


@server.tool(annotations=WRITE)
def analyze_all() -> dict:
    """Start the BPM/key analysis for every track missing one.

    Returns:
        dict: `{started, total}`, or the all-zero summary when nothing is
        missing a BPM.
    """
    _require_write()
    return call("POST", "/api/library/analyze-all")


@server.tool(annotations=READ)
def analyze_status() -> dict:
    """The running or last analysis: progress, current title and its result.

    Returns:
        dict: `running`, `stopping`, `finished`, `done`, `total`,
        `current_title`, `result`, `error`.
    """
    return call("GET", "/api/library/analyze-status")


@server.tool(annotations=WRITE)
def analyze_track(
    song_id: str, bpm_min: float | None = None, bpm_max: float | None = None
) -> dict:
    """Re-detect one track's BPM and key, overriding a stored BPM.

    Args:
        song_id (str): The track's id.
        bpm_min (float | None): Optional low bound of the hint, with bpm_max.
        bpm_max (float | None): Optional high bound of the hint.

    Returns:
        dict: `{song_id, bpm, musical_key, duration, bpm_fit, applied}`.
    """
    _require_write()
    body: dict[str, Any] = {}
    if bpm_min is not None or bpm_max is not None:
        if bpm_min is None or bpm_max is None:
            raise ToolError("A BPM range needs both bpm_min and bpm_max")
        body = {"bpm_min": bpm_min, "bpm_max": bpm_max}
    return call("POST", f"/api/library/analyze/{song_id}", json=body)


@server.tool(annotations=WRITE)
def scan_artwork() -> dict:
    """Backfill cover art for tracks scanned before artwork extraction existed.

    Returns:
        dict: `{processed, extracted, skipped, errors}`.
    """
    _require_write()
    return call("POST", "/api/library/scan-artwork")


# ── Tags ────────────────────────────────────────────────


@server.tool(annotations=READ)
def list_tags() -> list[dict]:
    """Every tag, with its colour.

    Returns:
        list[dict]: `[{id, name, color}]`.
    """
    return call("GET", "/api/tags")


@server.tool(annotations=WRITE)
def create_tag(name: str, color: str | None = None) -> dict:
    """Create a tag. Recolour it in the app's Settings.

    Args:
        name (str): The tag's name.
        color (str | None): A hex colour; the palette's fallback when omitted.

    Returns:
        dict: The tag.
    """
    _require_write()
    return call("POST", "/api/tags", json={"name": name, "color": color or FALLBACK_COLOR})


@server.tool(annotations=IDEMPOTENT)
def tag_track(song_id: str, tag_id: str) -> dict:
    """Put a tag on a track. Adding it twice changes nothing.

    Args:
        song_id (str): The track's id.
        tag_id (str): The tag's id.

    Returns:
        dict: `{status: "ok"}`.
    """
    _require_write()
    return call("POST", f"/api/songs/{song_id}/tags", json={"tag_id": tag_id})


@server.tool(annotations=WRITE)
def untag_track(song_id: str, tag_id: str) -> dict:
    """Take a tag off a track.

    Args:
        song_id (str): The track's id.
        tag_id (str): The tag's id.

    Returns:
        dict: `{status: "ok"}`.
    """
    _require_write()
    return call("DELETE", f"/api/songs/{song_id}/tags/{tag_id}")


# ── Playlists ───────────────────────────────────────────


@server.tool(annotations=READ)
def list_playlists() -> list[dict]:
    """Every playlist, each with its tracks.

    Returns:
        list[dict]: The playlists, each with `tracks: [{song_id, position}]`.
    """
    playlists = call("GET", "/api/playlists")
    memberships = call("GET", "/api/playlist-songs")
    by_playlist: dict[str, list[dict]] = {}
    for row in memberships:
        by_playlist.setdefault(row["playlist_id"], []).append(
            {"song_id": row["song_id"], "position": row["position"]}
        )
    for playlist in playlists:
        tracks = by_playlist.get(playlist["id"], [])
        playlist["tracks"] = sorted(tracks, key=lambda track: track["position"])
    return playlists


@server.tool(annotations=WRITE)
def create_playlist(name: str, color: str | None = None, description: str | None = None) -> dict:
    """Create an empty playlist.

    Args:
        name (str): The playlist's name.
        color (str | None): A hex colour; the palette's fallback when omitted.
        description (str | None): A short description.

    Returns:
        dict: The playlist.
    """
    _require_write()
    return call("POST", "/api/playlists", json={
        "name": name,
        "color": color or FALLBACK_COLOR,
        "description": description,
    })


@server.tool(annotations=WRITE)
def playlist_add(playlist_id: str, song_id: str, position: int | None = None) -> dict:
    """Add a track to a playlist.

    The API answers 201 for an unknown playlist or song, so both are checked
    here first — otherwise the tool would report a success that wrote nothing.

    Args:
        playlist_id (str): The playlist's id.
        song_id (str): The track's id.
        position (int | None): Where to put it; the end when omitted.

    Returns:
        dict: `{playlist_id, song_id, position}`.
    """
    _require_write()
    _require_exists("/api/playlists", playlist_id, "playlist")
    _require_exists("/api/songs", song_id, "track")
    body: dict[str, Any] = {"song_id": song_id}
    if position is not None:
        body["position"] = position
    return call("POST", f"/api/playlists/{playlist_id}/songs", json=body)


@server.tool(annotations=WRITE)
def playlist_remove(playlist_id: str, song_id: str) -> dict:
    """Take a track out of a playlist.

    Args:
        playlist_id (str): The playlist's id.
        song_id (str): The track's id.

    Returns:
        dict: `{status: "ok"}`.

    Raises:
        ToolError: The association does not exist (the API answers 404).
    """
    _require_write()
    call("DELETE", f"/api/playlists/{playlist_id}/songs/{song_id}")
    return {"status": "ok"}


# ── Curation ────────────────────────────────────────────


@server.tool(annotations=READ)
def list_relationships(song_id: str | None = None) -> list[dict]:
    """Relationships between tracks, optionally only the ones touching a track.

    Args:
        song_id (str | None): Keep only relationships with this track.

    Returns:
        list[dict]: The relationship rows.
    """
    rows = call("GET", "/api/relationships")
    if song_id is None:
        return rows
    return [
        row for row in rows
        if song_id in (row.get("source_song_id"), row.get("target_song_id"))
    ]


@server.tool(annotations=WRITE)
def link_tracks(
    source_song_id: str,
    target_song_id: str,
    relationship_type: str,
    notes: str | None = None,
) -> dict:
    """Relate two tracks.

    Args:
        source_song_id (str): The track the relationship starts from.
        target_song_id (str): The other track.
        relationship_type (str): One of remix, same_sample, cover, mashup,
            edit, bootleg, in_playlist, transition.
        notes (str | None): Why they are related.

    Returns:
        dict: The relationship.

    Raises:
        ToolError: The type is not one the app knows.
    """
    _require_write()
    if relationship_type not in RELATIONSHIP_TYPES:
        raise ToolError(
            f"Unknown relationship type “{relationship_type}”. "
            f"Use one of: {', '.join(RELATIONSHIP_TYPES)}"
        )
    return call("POST", "/api/relationships", json={
        "source_song_id": source_song_id,
        "target_song_id": target_song_id,
        "relationship_type": relationship_type,
        "notes": notes,
    })


@server.tool(annotations=READ)
def get_transitions(song_id: str) -> list[dict]:
    """Transition suggestions for a track: its related tracks and the notes.

    Args:
        song_id (str): The track's id.

    Returns:
        list[dict]: `[{song, notes}]`, the songs slim.
    """
    rows = call("GET", f"/api/songs/{song_id}/transition-suggestions")
    for row in rows:
        if isinstance(row.get("song"), dict):
            row["song"] = _slim(row["song"])
    return rows


@server.tool(annotations=WRITE)
def export_library(output_path: str | None = None) -> dict:
    """Back the library up: a summary, or the envelope written to a file.

    Without a path the answer is a summary and not the envelope — it is
    megabytes, and it would fill the agent's context. With a path the file is
    written outside the app's data directory, which the app alone owns.

    Args:
        output_path (str | None): Where to write the envelope.

    Returns:
        dict: `{format, version, exported_at, counts}`, or
        `{path, bytes, counts}` when a path was given.

    Raises:
        ToolError: The path is inside the app's data directory.
    """
    envelope = call("GET", "/api/export")
    counts = {name: len(rows) for name, rows in envelope["data"].items()}
    summary = {
        "format": envelope["format"],
        "version": envelope["version"],
        "exported_at": envelope["exported_at"],
        "counts": counts,
    }
    if output_path is None:
        return summary

    target = Path(output_path).expanduser().resolve()
    if _is_inside_data_dir(target):
        raise ToolError(
            f"{target} is inside Klangkurator's data folder. "
            "Export somewhere else — the app owns that folder."
        )
    _write_envelope(target, envelope)
    return {"path": str(target), "bytes": target.stat().st_size, "counts": counts}


def _write_envelope(target: Path, envelope: dict) -> None:
    """Write the export, saying what went wrong and leaving no half file.

    Args:
        target (Path): Where the envelope goes; its parent is created.
        envelope (dict): The export to write.

    Raises:
        ToolError: The path cannot be written, or the write failed part way.
    """
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(envelope, indent=2, ensure_ascii=False), encoding="utf-8")
    except OSError as exc:
        # A truncated backup is worse than none: it looks like a backup. The
        # cleanup is best-effort — the same error can make it fail too, and
        # that must not replace the message the caller needs.
        try:
            target.unlink(missing_ok=True)
        except OSError:
            pass
        raise ToolError(f"Could not write {target}: {exc}") from None


# ── Guards ──────────────────────────────────────────────


def _require_write() -> None:
    """Refuse a library-changing tool in read-only mode (BC-20).

    Raises:
        ToolError: `KLANGKURATOR_READ_ONLY` is on.
    """
    if config.read_only():
        raise ToolError(
            "This session is read-only (KLANGKURATOR_READ_ONLY=1), so this tool "
            "is refused. Unset it to let an agent change the library."
        )


def _require_allowed_root(root_path: str) -> None:
    """Refuse a folder outside the allowlist, before any HTTP call (BC-21).

    Args:
        root_path (str): The requested music folder.

    Raises:
        ToolError: The folder is outside every allowed root.
    """
    requested = Path(root_path).expanduser().resolve()
    allowed = config.allowed_roots()
    if allowed is None:
        configured = call("GET", "/api/library/root").get("root_path")
        allowed = [configured] if configured else []
    roots = [Path(entry).expanduser().resolve() for entry in allowed]
    if any(requested == root or root in requested.parents for root in roots):
        return
    shown = " or ".join(str(root) for root in roots) or "none — KLANGKURATOR_ROOTS is empty"
    raise ToolError(
        f"{requested} is outside the folders this server may scan ({shown}). "
        "Add it to KLANGKURATOR_ROOTS to allow it."
    )


def _require_exists(collection_path: str, item_id: str, label: str) -> None:
    """Refuse an id the API would accept blindly.

    Args:
        collection_path (str): The list endpoint, e.g. "/api/songs".
        item_id (str): The id to look for.
        label (str): What the id names, for the message.

    Raises:
        ToolError: No row with that id.
    """
    params = {"slim": "true"} if collection_path == "/api/songs" else None
    rows = call("GET", collection_path, params=params) or []
    if not any(row.get("id") == item_id for row in rows):
        raise ToolError(f"No {label} with id {item_id}")


def _is_inside_data_dir(target: Path) -> bool:
    """Whether a path sits in the app's own data folder.

    Args:
        target (Path): A resolved path.

    Returns:
        bool: True under `~/.klangkurator`.
    """
    data_dir = (Path.home() / ".klangkurator").resolve()
    return target == data_dir or data_dir in target.parents
