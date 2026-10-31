"""API package — library scan, analysis jobs and crate listing endpoints."""

import logging
import threading
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.config import BPM_MAX, BPM_MIN
from backend.scanner.file_scanner import scan_directory
from backend.scanner.metadata import extract_metadata
from backend.scanner.waveform import compute_peaks
from backend.scanner.artwork import extract_artwork
from backend.scanner.audio_analysis import analyze_track, analyze_all_missing_bpm
from backend.storage import crate_registry, get_library_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/library", tags=["library"])


class ScanRequest(BaseModel):
    """A scan of one music location, named by its id or its path.

    `location_id` is what the app sends; `root_path` stays accepted so an older
    client and the MCP server's own scan tool keep working, and so a first
    import can scan a folder the app has not registered yet.
    """

    location_id: str | None = None
    root_path: str | None = None


class LocationRequest(BaseModel):
    path: str


class PickFolderResponse(BaseModel):
    path: str | None = None


# ── One background job at a time (REQ-10-SP, REQ-10-AP) ──
# The scan, the library-wide analysis and the per-track re-analyze exclude each
# other; `_job` names the run that holds the slot. The lock only guards the
# check-and-set — a job is not "busy" by holding it, because the batch jobs
# return as soon as their thread is spawned.

_JOB_MESSAGES = {
    "scan": "A scan is running",
    "analysis": "An analysis is running",
    "reanalyze": "An analysis is running",
}

_job_lock = threading.Lock()
_job: str | None = None


def _claim_job(kind: str, start=None) -> None:
    """Take the one job slot for `kind`, or raise 409 naming the running job.

    `start`, when given, runs **inside** the same locked section, so a fresh
    run's state and Abort event are armed before anything else can see the
    claim. That is what keeps an early cancel from being lost or applied to
    the run it was not meant for.

    The lock is taken non-blocking and released at once: a job is marked by
    `_job`, not by holding the lock, so a 3–5 s per-track run never makes
    another request wait.

    Args:
        kind (str): "scan", "analysis" or "reanalyze".
        start (callable | None): Setup to run while the slot is held.

    Raises:
        HTTPException: 409 when another job holds the slot.
    """
    global _job
    if not _job_lock.acquire(blocking=False):
        raise HTTPException(409, _job_message(_job))
    try:
        if _job is not None:
            raise HTTPException(409, _job_message(_job))
        _job = kind
        if start is not None:
            start()
    finally:
        _job_lock.release()


def _release_job(kind: str) -> None:
    """Free the job slot if this kind still holds it."""
    global _job
    with _job_lock:
        if _job == kind:
            _job = None


def _job_message(kind: str | None) -> str:
    """The 409 text naming the job in the way."""
    return _JOB_MESSAGES.get(kind, "Another job is running")


# ── Scan — background job + status polling ───────────────

_scan_state: dict = {
    "running": False,
    "done": 0,
    "total": 0,
    "current_file": "",
    "current_crate": "",
    "added": 0,
    "skipped": 0,
    "offered": 0,
    "offers": [],
    "errors": [],
    "started_at": None,
    "finished": False,
    "result": None,
    "error": None,
    "warning": None,
}


@router.post("/scan")
def scan_library(body: ScanRequest):
    """Start a background import of every audio file under one music location.

    Decoding a file for its waveform peaks takes about a second, so a large
    folder would otherwise be a silent blocking request (REQ-10-SP). Returns
    at once; poll GET /scan-status for progress.

    A location that is **not there** — an unmounted drive, a renamed folder —
    is a no-op with a warning, never an error: one absent location must not
    disturb the others. The files already in the library are left alone, and
    nothing is flagged missing until the user confirms a cleanup.

    Args:
        body (ScanRequest): The location to scan, by `location_id` (what the
            app sends) or by `root_path` (a first import, the MCP server).

    Returns:
        dict: `{started, total}`, plus `warning` when the location is absent.

    Raises:
        HTTPException: 400 when no folder is named, 404 for an unknown
            location id, 409 when another job is running.
    """
    store = get_library_store()
    root = _scan_target(body, store)

    if not root.is_dir():
        message = f"The music location {root} is not there right now."
        logger.warning("Scan skipped: %s", message)
        # Through the same claim as a real scan: an absent location must not
        # publish a "finished" status over a running job's progress.
        _claim_job(
            "scan",
            lambda: _reset_scan_state(0, running=False, warning=message),
        )
        _release_job("scan")
        return {"started": False, "total": 0, "warning": message}

    audio_files = scan_directory(str(root))
    _claim_job("scan", lambda: _reset_scan_state(len(audio_files)))
    try:
        _start_scan(root, audio_files, store)
    except BaseException:
        # The thread never ran, so its `finally` will never free the slot:
        # release it here or every later job answers 409 for the session.
        _release_job("scan")
        _scan_state["running"] = False
        _scan_state["finished"] = True
        raise
    return {"started": True, "total": len(audio_files)}


def _scan_target(body: ScanRequest, store) -> Path:
    """The folder a scan request names.

    Args:
        body (ScanRequest): The request.
        store: The library store, for a location id lookup.

    Returns:
        Path: The resolved folder. It may not exist; the caller decides.

    Raises:
        HTTPException: 400 when no folder is named, 404 for an unknown id.
    """
    if body.location_id:
        location = next(
            (loc for loc in store.get_locations() if loc["id"] == body.location_id), None
        )
        if location is None:
            raise HTTPException(404, f"No music location with id {body.location_id}")
        return Path(location["path"]).expanduser().resolve()
    if not (body.root_path or "").strip():
        raise HTTPException(400, "Name a music location by id or path")
    return Path(body.root_path).expanduser().resolve()


def _reset_scan_state(total: int, running: bool = True, warning: str | None = None) -> None:
    """Replace the scan state with a fresh one for `total` files.

    Args:
        total (int): How many files the scan will visit.
        running (bool): False for a run that ends at once (an absent location).
        warning (str | None): Why nothing was scanned, when that is the case.
    """
    global _scan_state
    _scan_state = {
        "running": running,
        "done": 0,
        "total": total,
        "current_file": "",
        "current_crate": "",
        "added": 0,
        "skipped": 0,
        "offered": 0,
        "offers": [],
        "errors": [],
        "started_at": _now_iso(),
        "finished": not running,
        "result": None,
        "error": None,
        "warning": warning,
    }


def _start_scan(root: Path, audio_files: list[Path], store) -> None:
    """Spawn the scan's thread; its state was armed with the claim."""
    thread = threading.Thread(target=_run_scan, args=(root, audio_files, store), daemon=True)
    thread.start()


def _run_scan(root: Path, audio_files: list[Path], store) -> None:
    """Import every file in turn, publishing progress; the job's only writer."""
    logger.info("Scan started: %d files under %s", len(audio_files), root)
    try:
        for file_path in audio_files:
            _scan_state["current_file"] = file_path.name
            _scan_state["current_crate"] = _crate_name(root, file_path)
            _scan_one(store, root, file_path)
    except Exception as exc:  # noqa: BLE001 — the job must never end silently
        logger.exception("Scan job failed under %s", root)
        _scan_state["error"] = str(exc)
    finally:
        _finish_scan()


def _scan_one(store, root: Path, file_path: Path) -> None:
    """Import one file and count it — added, skipped, offered or failed."""
    try:
        outcome = _import_file(store, root, file_path)
    except Exception as exc:  # noqa: BLE001 — one bad file never stops the scan
        logger.exception("Scan failed for %s", file_path)
        _scan_state["errors"].append(f"{file_path.name}: {exc}")
    else:
        _scan_state[outcome] += 1
    finally:
        _scan_state["done"] += 1


#: How close two durations must be for the scan to call two files one recording
#: ([[18_AUDIO_VARIANTS]]: "a duration match within ±2 s"). The same window the
#: import merge treats as identity.
VARIANT_DURATION_TOLERANCE_S = 2.0


def _variant_offer(store, file_path: Path, meta: dict, title: str, artist: str) -> dict | None:
    """The attach this file is worth, when it looks like another copy of a track.

    A file is offered as a variant when its artist+title matches a stored track,
    or when its duration sits within `VARIANT_DURATION_TOLERANCE_S` of one. It is
    only offered: a `.wav` carries no tags, so its filename-derived artist
    ("Skrillex") will not equal the `.mp3`'s tag-derived one ("Levex"), and a
    silent attach would be a guess (AC-1).

    Args:
        store: The library store.
        file_path (Path): The file the scan is on.
        meta (dict): What `extract_metadata` read from it.
        title (str): The metadata title, or the file name without suffix.
        artist (str): The metadata artist, or "Unknown Artist".

    Returns:
        dict | None: `{file_path, song_id, title, artist, match, duration}` for
        the Import result list, or None when no track looks like this file.
    """
    song = store.find_song_by_artist_title(artist, title)
    match = "artist_title"
    if song is None:
        song = _song_within_duration(store, meta.get("duration"), title)
        match = "duration"
    if song is None:
        return None
    return {
        "file_path": str(file_path),
        "song_id": song["id"],
        "title": song.get("title") or title,
        "artist": song.get("artist") or artist,
        "match": match,
        "duration": meta.get("duration"),
    }


def _normalise_title(text: str) -> str:
    """A title reduced to the part two copies of one file always share.

    Case, extra whitespace and punctuation go. A leading "Artist - " prefix
    goes too, because a `.wav` falls back to its file name for the title while
    the `.mp3` beside it carries the same words in a tag.

    Args:
        text (str): A title, or a file name without its suffix.

    Returns:
        str: The comparable form.
    """
    lowered = " ".join((text or "").lower().split())
    if " - " in lowered:
        lowered = lowered.split(" - ", 1)[1]
    return "".join(ch for ch in lowered if ch.isalnum() or ch == " ").strip()


def _song_within_duration(store, duration, title: str) -> dict | None:
    """The first track whose duration sits close AND whose title matches.

    The title is required, not decoration. A duration alone would claim any
    track of a similar length: two unrelated 3:24 tracks are a common pair, and
    a 0.2 s test tone matches the next 0.2 s test tone. The duration then only
    bridges the artist disagreement that made the offer necessary — a `.wav`
    with no tags reads `Unknown Artist`.

    Args:
        store: The library store.
        duration (float | None): The candidate file's duration.
        title (str): The candidate file's title, from tags or its file name.

    Returns:
        dict | None: The track, or None when the duration is unknown, no track
        sits close enough, or the titles differ.
    """
    if not duration or not title:
        return None
    wanted = _normalise_title(title)
    if not wanted:
        return None
    for song in store.get_songs():
        other = song.get("duration")
        if not other:
            continue
        if abs(float(other) - float(duration)) > VARIANT_DURATION_TOLERANCE_S:
            continue
        if _normalise_title(song.get("title") or "") == wanted:
            return song
    return None


def _import_file(store, root: Path, file_path: Path) -> str:
    """Add one file to the library, offer it as a variant, or skip it.

    Args:
        store: The library store.
        root (Path): The scan's root folder, which names the crate.
        file_path (Path): The audio file to import.

    Returns:
        str: "added", "skipped" or "offered". "offered" means the file looks
        like another copy of a stored track and waits for the Import page to
        attach it (AC-1: one click, never silent).

    Raises:
        Exception: Whatever metadata or artwork extraction throws; the caller
            records it against the file.
    """
    file_path_str = str(file_path)
    # Already the primary, or already a variant: nothing to do either way.
    if store.find_song_by_any_path(file_path_str):
        return "skipped"

    meta = extract_metadata(file_path_str)
    title = meta.get("title") or file_path.stem
    artist = meta.get("artist") or "Unknown Artist"

    # An artist+title match used to be a silent skip (INV-5's re-scan guard).
    # It is a variant offer now: the match means "another file of a track I
    # already have", and the Import page asks before attaching (AC-1).
    offer = _variant_offer(store, file_path, meta, title, artist)
    if offer is not None:
        _scan_state["offers"].append(offer)
        return "offered"

    # PF-13: peaks are computed at scan time and persisted on the song
    # (may be None — the lazy /api/audio/waveform endpoint backfills).
    peaks = compute_peaks(file_path_str)
    song = store.add_song(_song_data(root, file_path, meta, title, artist, peaks))

    # PF-14: extract artwork after add_song — add_song overwrites any
    # client-supplied id (id is generated inside the store), so the real
    # id only exists on the returned dict. Artwork is a separate update
    # so a failed extraction never blocks the import.
    art = extract_artwork(file_path_str, song["id"])
    if art:
        store.update_song(song["id"], {"artwork_url": art})

    return "added"


def _song_data(
    root: Path, file_path: Path, meta: dict, title: str, artist: str, peaks: list[float] | None
) -> dict:
    """The song record a new file becomes, with every field the scan sets.

    The crate is stored as its **id**, resolved through the registry, so two
    folders with the same name in different music locations stay two crates.

    Args:
        root (Path): The music location being scanned.
        file_path (Path): The audio file.
        meta (dict): What `extract_metadata` read from the file.
        title (str): The metadata title, or the file name without suffix.
        artist (str): The metadata artist, or "Unknown Artist".
        peaks (list[float] | None): The waveform envelope, when it could be read.

    Returns:
        dict: The record to hand to the store.
    """
    return {
        "title": title,
        "artist": artist,
        "album": meta.get("album"),
        "year": meta.get("year"),
        "bpm": meta.get("bpm"),
        "musical_key": meta.get("musical_key"),
        "duration": meta.get("duration"),
        "genre": meta.get("genre"),
        "file_path": str(file_path),
        crate_registry.SONG_KEY: crate_registry.crate_id(
            str(root), _crate_name(root, file_path)
        ),
        "waveform_peaks": peaks,
        "artwork_url": None,
        "energy": 0,
        "people": 0,
    }


def _crate_name(root: Path, file_path: Path) -> str:
    """The crate a file belongs to: its folder below `root`, else the root's name.

    Args:
        root (Path): The music location being scanned.
        file_path (Path): The audio file.

    Returns:
        str: The crate name, relative to the location.
    """
    return crate_registry.crate_name_for(str(root), str(file_path))


def _finish_scan() -> None:
    """End the scan job: publish its result (or error), then mark it stopped.

    `running` goes False last: a status read in between must never see a run
    that stopped without its result, which the views would report as vanished.
    """
    if _scan_state["error"] is None:
        _scan_state["result"] = {
            "total": _scan_state["total"],
            "added": _scan_state["added"],
            "skipped": _scan_state["skipped"],
            "offered": _scan_state["offered"],
            "offers": list(_scan_state["offers"]),
            "errors": list(_scan_state["errors"]),
        }
    _scan_state["finished"] = True
    _scan_state["running"] = False
    _release_job("scan")


@router.get("/scan-status")
def scan_status():
    """Poll the current (or last) scan job: progress + result/error.

    Returns:
        dict: a copy of the job state, so a caller never sees it change under
            its feet mid-serialisation.
    """
    state = dict(_scan_state)
    state["errors"] = list(state["errors"])
    state["offers"] = list(state["offers"])
    state["result"] = dict(state["result"]) if state["result"] else None
    return state


@router.get("/crates")
def list_crates():
    """List the library's crates with their track counts.

    A crate is a registry entry (issue #11), so a name repeated in two music
    locations is two crates with two ids and two counts, and the tabs and the
    filter can tell them apart. `missing_track_count` counts the songs whose
    music location was removed: they stay in the library, flagged.

    Returns:
        list[dict]: `{id, name, location_path, track_count, missing_track_count}`
        per crate, sorted by name then location.
    """
    store = get_library_store()
    songs = store.get_songs()

    # Counted by `crate_of`, the same rule the table, the tabs and the filter
    # use, so one song can never land in two different buckets depending on
    # who asks. A row without a registry crate (created by hand, or from a
    # file outside every location) is counted under its file's folder rather
    # than dropped from the total.
    counts: dict[str, int] = {}
    missing: dict[str, int] = {}
    for song in songs:
        key = crate_of(song)
        counts[key] = counts.get(key, 0) + 1
        if song.get(crate_registry.MISSING_KEY):
            missing[key] = missing.get(key, 0) + 1

    known = store.get_crates()
    rows = [
        {
            **crate,
            "track_count": counts.get(crate["id"], 0),
            "missing_track_count": missing.get(crate["id"], 0),
        }
        for crate in known
    ]
    registered = {crate["id"] for crate in known}
    rows.extend(
        {
            "id": key,
            "name": key,
            "location_path": "",
            "track_count": count,
            "missing_track_count": missing.get(key, 0),
        }
        for key, count in counts.items()
        if key not in registered
    )
    return sorted(rows, key=lambda row: (row["name"].casefold(), row["location_path"]))


# ── Directory browsing (folder-picker support) ────────────


@router.get("/browse")
def browse_directory(path: str | None = None):
    """List subdirectories of `path` for the client-side folder dialog.

    Two boundaries are reachable (REQ-10-BW): the home folder, and the
    configured root even when it sits outside home. An external drive holding
    the music was unreachable here while `POST /scan` and `PUT /root` accepted
    it, so a browser tab could not pick the folder the app already read.

    - `path` omitted or "~" → the user's home directory
    - Only directories are returned (no files)
    - Hidden entries (dot-prefixed) are skipped
    - A path outside both boundaries is rejected

    Args:
        path (str | None): The folder to list; omitted or "~" is home.

    Returns:
        dict: `path`, `parent` (None at either boundary) and `directories`.

    Raises:
        HTTPException: 400 when the path is not a directory, 403 outside both
            boundaries or on a permission error.
    """
    home = Path.home().resolve()
    boundaries = _browse_boundaries(home)
    target = _browse_target(path, home, boundaries)

    if not target.is_dir():
        raise HTTPException(400, f"Not a directory: {target}")

    try:
        dirs = sorted(
            (d for d in target.iterdir()
             if d.is_dir() and not d.name.startswith(".")),
            key=lambda d: d.name.lower(),
        )
    except PermissionError as e:
        raise HTTPException(403, f"Permission denied: {target}") from e

    return {
        "path": str(target),
        "parent": None if target in boundaries else str(target.parent),
        "directories": [
            {"name": d.name, "path": str(d), "has_children": _has_subdirs(d)}
            for d in dirs
        ],
    }


def crate_of(song: dict) -> str:
    """The crate a song belongs to: its crate id, else its file's folder.

    A row without a crate id is one the migration could not place; it is
    labelled by the folder that holds it rather than counted under "Unknown",
    so the table, the tabs and the filter still agree.

    Args:
        song (dict): A song row.

    Returns:
        str: The crate id, or the file's parent folder name, or "Unknown".
    """
    key = song.get(crate_registry.SONG_KEY)
    if isinstance(key, str) and key:
        return key
    path = song.get("file_path")
    if path:
        parent = Path(str(path)).parent.name
        if parent:
            return parent
    return "Unknown"


def _browse_boundaries(home: Path) -> tuple[Path, ...]:
    """The folders browsing may reach: home, plus the configured root.

    Args:
        home (Path): The resolved home folder.

    Returns:
        tuple[Path, ...]: Home first, then each music location that is a
        different folder.
    """
    boundaries = [home]
    try:
        locations = get_library_store().get_locations()
    except Exception:  # noqa: BLE001 — an unreadable store must not break browsing
        return tuple(boundaries)
    for location in locations:
        folder = Path(location["path"]).expanduser().resolve()
        if folder not in boundaries:
            boundaries.append(folder)
    return tuple(boundaries)


def _browse_target(raw: str | None, home: Path, boundaries: tuple[Path, ...]) -> Path:
    """The folder a browse request names, refused when it is outside `boundaries`.

    Args:
        raw (str | None): The requested path; empty or "~" is home.
        home (Path): The resolved home folder, for relative paths.
        boundaries (tuple[Path, ...]): The folders browsing may reach.

    Returns:
        Path: The resolved folder to list.

    Raises:
        HTTPException: 403 when the folder is outside every boundary.
    """
    requested = (raw or "").strip()
    if requested in ("", "~", "/"):
        return home

    target = Path(requested).expanduser()
    if not target.is_absolute():
        target = home / target
    target = target.resolve()

    if any(target == b or b in target.parents for b in boundaries):
        return target

    allowed = " or ".join(str(b) for b in boundaries)
    raise HTTPException(
        403,
        f"Access denied: {target} is outside your home directory or music folder ({allowed})",
    )


def _has_subdirs(d: Path) -> bool:
    """Cheap check so the dialog can hide expand arrows on leaf folders."""
    try:
        return any(c.is_dir() and not c.name.startswith(".") for c in d.iterdir())
    except OSError:
        return False


@router.get("/locations")
def list_locations():
    """The music locations the library reads, with their crate counts.

    Each location is a folder scanned like a root (issue #11): one concept, one
    scanning path. A location that is not mounted is reported as absent, so the
    Settings page can say so without an error.

    Returns:
        list[dict]: `{id, path, exists, crate_count, track_count}` per
        location, in path order.
    """
    store = get_library_store()
    crates = store.get_crates()
    songs = store.get_songs()
    counts: dict[str, int] = {}
    for song in songs:
        key = song.get(crate_registry.SONG_KEY)
        if isinstance(key, str):
            counts[key] = counts.get(key, 0) + 1

    result = []
    for location in store.get_locations():
        own = [crate for crate in crates if crate["location_path"] == location["path"]]
        result.append({
            **location,
            "exists": Path(location["path"]).is_dir(),
            "crate_count": len(own),
            "track_count": sum(counts.get(crate["id"], 0) for crate in own),
        })
    return result


@router.post("/locations", status_code=201)
def add_location(body: LocationRequest):
    """Register a music location so it can be scanned and rescanned.

    Adding the same folder twice changes nothing, so a retry is safe. The
    folder may be absent right now: registering it is not a promise that the
    drive is mounted, and the scan is the call that reports absence.

    Args:
        body (LocationRequest): The folder to add.

    Returns:
        dict: The location, with `added_crates` and `exists`.

    Raises:
        HTTPException: 400 when the path is blank.
    """
    path = crate_registry.normalize_path(body.path)
    if not path:
        raise HTTPException(400, "Name the folder to add")
    store = get_library_store()
    location = store.add_location(path)
    logger.info("Music location added: %s (%d crates)", location["path"], location["added_crates"])
    return {**location, "exists": Path(location["path"]).is_dir()}


@router.delete("/locations/{location_id}")
def remove_location(location_id: str):
    """Remove a music location and flag its songs as missing.

    Nothing is deleted (issue #11): the songs keep their notes, tags, ratings
    and relationships, and each is marked `missing_since`. Re-adding the folder
    re-resolves them by path, because crate ids are derived from the path.

    Args:
        location_id (str): The location to remove.

    Returns:
        dict: `{id, path, songs_flagged, crates_removed}`.

    Raises:
        HTTPException: 404 when no location carries that id.
    """
    result = get_library_store().remove_location(location_id)
    if result is None:
        raise HTTPException(404, f"No music location with id {location_id}")
    logger.info(
        "Music location removed: %s (%d songs flagged missing, %d crates)",
        result["path"], result["songs_flagged"], result["crates_removed"],
    )
    return result


@router.get("/locations/{location_id}/crates")
def list_location_crates(location_id: str):
    """The crates one music location holds, with their track counts.

    Args:
        location_id (str): The location's id.

    Returns:
        list[dict]: The crates, in the shape `GET /crates` reports them.

    Raises:
        HTTPException: 404 when no location carries that id.
    """
    store = get_library_store()
    if not any(loc["id"] == location_id for loc in store.get_locations()):
        raise HTTPException(404, f"No music location with id {location_id}")
    own = {crate["id"] for crate in store.crates_of_location(location_id)}
    return [crate for crate in list_crates() if crate["id"] in own]


@router.post("/pick-folder", response_model=PickFolderResponse)
def pick_folder():
    """Use PyWebView's native file dialog to pick a folder.
    Only works when running inside PyWebView (desktop mode).
    """
    try:
        import webview
    except ImportError:
        raise HTTPException(400, "PyWebView not available")

    if not webview.windows:
        raise HTTPException(400, "Not running in desktop mode")

    result = webview.windows[0].create_file_dialog(webview.FOLDER_DIALOG)
    if result:
        return PickFolderResponse(path=result[0])
    return PickFolderResponse(path=None)


# ── Audio analysis — background job + status polling ────
# Single in-process job (single-user app): POST /analyze-all starts one
# daemon thread and returns immediately; the frontend polls
# GET /analyze-status for progress. No persistence across restarts.

_analyze_state: dict = {
    "running": False,
    "stopping": False,
    "done": 0,
    "total": 0,
    "current_title": "",
    "started_at": None,
    "finished": False,
    "result": None,
    "error": None,
}

# Abort: asked to stop, the loop breaks before the *next* track (REQ-10-AP).
_analyze_stop = threading.Event()


class ReanalyzeRequest(BaseModel):
    """Optional BPM range hint for a single-track re-analysis (PF-79).

    Both bounds or neither; inside the BPM a track may take (40–250, one
    decimal — the app's BPM_RANGE). A range is a hint: the detector is biased
    toward the window, and a result outside it is reported instead of written.
    """

    bpm_min: float | None = None
    bpm_max: float | None = None


class ReanalyzeResponse(BaseModel):
    song_id: str
    bpm: float | None = None
    musical_key: str | None = None
    duration: float | None = None
    #: Whether the detected bpm sits inside the requested range (True when no
    #: range was given; False when the tempo could not be detected).
    bpm_fit: bool
    #: The fields that were actually written — a hint that did not fit leaves
    #: bpm out, so the caller can state the truth without re-deriving it.
    applied: dict
    #: What the primary reads now, and what a variant recorded for the same
    #: recording — the pair the popup shows when they disagree by a metrical
    #: level (AC-13). Both are reported; neither is chosen (AC-14).
    primary_bpm: float | None = None
    variant_bpm: float | None = None
    #: True when `variant_bpm` is the primary's tempo doubled or halved within
    #: 3 %, which is the octave fault the ticket names.
    octave_disagreement: bool = False


class ArtworkScanResponse(BaseModel):
    processed: int
    extracted: int
    skipped: int
    errors: list[str]


@router.post("/scan-artwork", response_model=ArtworkScanResponse)
def scan_artwork():
    """Backfill artwork for legacy songs scanned before PF-14 (INV-5)."""
    store = get_library_store()
    processed = extracted = skipped = 0
    errors: list[str] = []

    for song in store.get_songs():
        if song.get("artwork_url"):
            skipped += 1
            continue

        file_path = song.get("file_path")
        if not file_path or not Path(file_path).is_file():
            skipped += 1
            continue

        processed += 1
        art = extract_artwork(file_path, song["id"])
        if art:
            store.update_song(song["id"], {"artwork_url": art})
            extracted += 1
        else:
            errors.append(song.get("title") or file_path)

    return ArtworkScanResponse(
        processed=processed, extracted=extracted,
        skipped=skipped, errors=errors,
    )


@router.post("/analyze-all")
def analyze_all_songs():
    """Start a background analysis of all songs missing BPM/key.

    Returns immediately — poll GET /analyze-status for progress. Uses librosa,
    about 3–5 s per track on CPU.

    The list is counted **once**, here, and handed to the loop, so the status'
    `total` and the loop's own count can never disagree. The track list also
    lets a track disappear from under the run without shifting the count.

    Returns:
        dict: `{started: True, total: N}`, or the all-zero summary when
            nothing is missing a BPM.

    Raises:
        HTTPException: 409 when a scan or another analysis is running.

    Notes:
        The job thread mutates the library store while the rest of the
        API keeps serving requests. This is acceptable for a single-user
        app (matches the existing design where scan/analyze already
        mutate from request handlers).
    """
    store = get_library_store()
    to_analyze = _songs_missing_bpm(store)

    # Claim first, decide after: the one-job rule (REQ-10-AP) holds even for a
    # run with nothing to do. The state and the Abort event are armed with the
    # claim, under the lock `analyze-cancel` also takes.
    if not to_analyze:
        _claim_job("analysis")
        _release_job("analysis")
        return analyze_all_missing_bpm(store, songs=[])

    _claim_job("analysis", lambda: _reset_analysis_state(len(to_analyze)))
    try:
        thread = threading.Thread(target=_run_analysis, args=(store, to_analyze), daemon=True)
        thread.start()
    except BaseException:
        # Same as the scan: no thread means no `finally` to free the slot.
        _release_job("analysis")
        _analyze_state["running"] = False
        _analyze_state["finished"] = True
        raise
    return {"started": True, "total": len(to_analyze)}


def _songs_missing_bpm(store) -> list[dict]:
    """The songs the job would fill: no BPM, with a file still on disk."""
    songs = store.get_songs()
    return [
        s for s in songs
        if s.get("bpm") is None
        and s.get("file_path")
        and Path(s["file_path"]).exists()
    ]


def _reset_analysis_state(total: int) -> None:
    """Arm the analysis state and clear its Abort event, before the thread exists.

    Cleared here rather than in the thread: a cancel that arrived between the
    claim and a later reset would otherwise make the fresh run stop at once.
    Running inside the claim's locked section is what makes that ordering safe.

    Args:
        total (int): The number of tracks the run was handed.
    """
    global _analyze_state
    _analyze_stop.clear()
    _analyze_state = {
        "running": True,
        "stopping": False,
        "done": 0,
        "total": total,
        "current_title": "",
        "started_at": _now_iso(),
        "finished": False,
        "result": None,
        "error": None,
    }


def _run_analysis(store, to_analyze: list[dict]) -> None:
    """Analyze the handed tracks, publishing progress; the job's only writer."""
    logger.info("Analysis started: %d tracks", len(to_analyze))
    try:
        summary = analyze_all_missing_bpm(
            store,
            progress_cb=_update_progress,
            songs=to_analyze,
            should_stop=_analyze_stop.is_set,
        )
        _analyze_state["result"] = summary
    except Exception as exc:  # noqa: BLE001 — job must never crash silently
        logger.exception("Analysis job failed")
        _analyze_state["error"] = str(exc)
    finally:
        # `running` last, as in _finish_scan: a read in between sees the result.
        _analyze_state["finished"] = True
        _analyze_state["running"] = False
        _release_job("analysis")


def _update_progress(done: int, total: int, current_title: str) -> None:
    """Progress callback — update the module-level job state."""
    _analyze_state["done"] = done
    _analyze_state["total"] = total
    _analyze_state["current_title"] = current_title


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("/analyze-status")
def analyze_status():
    """Poll the current (or last) analysis job: progress + result/error.

    Returns:
        dict: a copy of the job state with `stopping` derived from the Abort
            event, so the flag can never outlive the run that set it.
    """
    state = dict(_analyze_state)
    state["stopping"] = bool(state["running"]) and _analyze_stop.is_set()
    state["result"] = dict(state["result"]) if state["result"] else None
    return state


@router.post("/analyze-cancel")
def cancel_analysis():
    """Ask the running analysis to stop after the track it is on.

    Returns:
        dict: `{stopping: True}`.

    Raises:
        HTTPException: 409 when no analysis is running — the app then only
            refreshes the status instead of reporting an error.
    """
    with _job_lock:
        if _job != "analysis" or not _analyze_state["running"]:
            raise HTTPException(409, "No analysis is running")
        _analyze_stop.set()
    logger.info("Analysis stopped after the current track was requested")
    return {"stopping": True}


@router.post("/analyze/{song_id}", response_model=ReanalyzeResponse)
def analyze_one_song(song_id: str, body: ReanalyzeRequest | None = None):
    """Re-analyze ONE song for BPM and key, optionally within a BPM range.

    Unlike the library-wide job this **overrides** the "only fill missing"
    rule — that is the point: a wrong BPM was otherwise unrepairable except by
    hand. Runs synchronously (~3-5s for one track), holding the same lock as
    the library-wide job so the two can never run at once (REQ-10-AP).

    The optional ``bpm_min``/``bpm_max`` is a hint, not a filter: the tempo
    estimate is biased toward the window, and when the detected BPM does not
    land inside it the stored BPM is left unchanged and ``bpm_fit`` is False.

    Args:
        song_id (str): The track to analyze.
        body (ReanalyzeRequest | None): An optional BPM range hint.

    Returns:
        ReanalyzeResponse: what the detector read, whether it fit the range,
        and the fields that were actually written.

    Raises:
        HTTPException: 404 for an unknown song or a file that is gone, 400 for
            a song without a file path, 409 while another job runs, 422 for a
            malformed range, 500 when the detector fails.
    """
    bpm_range = _validate_bpm_range(body)

    store = get_library_store()
    song = store.get_song(song_id)
    if song is None:
        raise HTTPException(404, "Song not found")

    file_path = song.get("file_path")
    if not file_path:
        raise HTTPException(400, "Song has no file_path")

    result, changed = _reanalyze(store, song_id, file_path, bpm_range, song)

    # Read the row again: `_reanalyze` may have written a BPM, and the pair the
    # popup shows must describe what the track holds now.
    current = store.get_song(song_id) or song
    primary_bpm, variant_bpm = _bpm_pair(current)

    return ReanalyzeResponse(
        song_id=song_id,
        bpm=result.get("bpm"),
        musical_key=result.get("musical_key"),
        duration=result.get("duration"),
        bpm_fit=bool(result.get("bpm_fit", True)),
        applied=changed,
        primary_bpm=primary_bpm,
        variant_bpm=variant_bpm,
        octave_disagreement=_is_octave_apart(primary_bpm, variant_bpm),
    )


#: How close a doubled or halved tempo must land to count as the same reading
#: one metrical level away. 3 % covers a detector's own jitter on a real track.
OCTAVE_TOLERANCE = 0.03


def _bpm_pair(song: dict) -> tuple[float | None, float | None]:
    """The primary's BPM and the first variant reading that disagrees.

    Args:
        song (dict): The track, as stored.

    Returns:
        tuple[float | None, float | None]: The stored BPM, and a variant's own
        reading when one exists and differs. Both None when there is nothing to
        compare — no stored BPM, or no variant that ever recorded one.
    """
    primary = song.get("bpm")
    if primary is None:
        return None, None
    for variant in song.get("audio_variants") or []:
        reading = variant.get("bpm_reading")
        if reading is not None and reading != primary:
            return primary, reading
    return primary, None


def _is_octave_apart(primary: float | None, variant: float | None) -> bool:
    """Whether two tempos are the same reading one metrical level apart.

    A factor of two either way is the case the ticket measured: one file read
    132.0 and the other 66.3.

    Args:
        primary (float | None): The track's BPM.
        variant (float | None): A variant's reading.

    Returns:
        bool: True when doubling or halving one lands within
        `OCTAVE_TOLERANCE` of the other.
    """
    if not primary or not variant:
        return False
    for factor in (2.0, 0.5):
        if abs(primary * factor - variant) <= OCTAVE_TOLERANCE * variant:
            return True
    return False


def _reanalyze(store, song_id: str, file_path: str, bpm_range, song: dict) -> tuple[dict, dict]:
    """Claim the job slot, analyze one track and write what it found.

    Args:
        store: The library store.
        song_id (str): The track.
        file_path (str): Its file.
        bpm_range (tuple[float, float] | None): The optional hint.
        song (dict): The song as it was read before the run.

    Returns:
        tuple[dict, dict]: the detector's result and the fields that changed.

    Raises:
        HTTPException: 409 while another job runs, 404 when the file is gone,
            500 when the detector fails.
    """
    # One analysis at a time, in both directions: a per-track run claims the
    # same job slot the batch job and the scan use, and holds it for its 3–5 s.
    # Refuse rather than wait, so the caller gets a message instead of a silent
    # hang (REQ-10-AP).
    _claim_job("reanalyze")
    try:
        try:
            result = analyze_track(file_path, bpm_range=bpm_range)
        except FileNotFoundError:
            raise HTTPException(404, f"Audio file not found: {file_path}")
        except Exception as e:
            raise HTTPException(500, f"Analysis failed: {e}")

        # Re-read after the run: the 3-5 s is plenty of time for an inline
        # edit, and `changed` must compare against what the song holds *now*.
        current = store.get_song(song_id) or song
        updates, changed = _reanalyze_updates(song_id, current, result)
        if updates:
            store.update_song(song_id, updates)
    finally:
        _release_job("reanalyze")
    return result, changed


def _reanalyze_updates(song_id: str, current: dict, result: dict) -> tuple[dict, dict]:
    """What one re-analysis would write, and which of it is a change.

    Args:
        song_id (str): The track, for the log line.
        current (dict): The song as it is *now* — an inline edit during the
            3–5 s run must win the comparison.
        result (dict): What `analyze_track` detected.

    Returns:
        tuple[dict, dict]: the fields to write and the subset that differs from
        `current` (`applied` means changed, not detected, so the popup can say
        a run changed nothing without re-deriving it from a stale copy).
    """
    updates = {}
    # A hint that did not fit the signal must not overwrite the stored BPM.
    if result.get("bpm") is not None and result.get("bpm_fit", True):
        updates["bpm"] = result["bpm"]
    if result.get("musical_key") is not None:
        updates["musical_key"] = result["musical_key"]
    if result.get("duration") is not None and current.get("duration") is None:
        updates["duration"] = result["duration"]

    changed = {k: v for k, v in updates.items() if current.get(k) != v}
    logger.debug("Re-analysis for %s would write %s", song_id, sorted(updates))
    return updates, changed


def _validate_bpm_range(body: ReanalyzeRequest | None) -> tuple[float, float] | None:
    """The requested range, or None. 422 with a readable reason when malformed."""
    if body is None:
        return None
    lo, hi = body.bpm_min, body.bpm_max
    if lo is None and hi is None:
        return None
    if lo is None or hi is None:
        raise HTTPException(422, "A BPM range needs both bounds")
    if lo >= hi:
        raise HTTPException(422, "The low BPM bound must be below the high one")
    if not (BPM_MIN <= lo <= BPM_MAX and BPM_MIN <= hi <= BPM_MAX):
        raise HTTPException(422, f"BPM bounds go from {BPM_MIN:.0f} to {BPM_MAX:.0f}")
    return (float(lo), float(hi))
