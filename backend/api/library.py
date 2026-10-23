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
from backend.storage import get_library_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/library", tags=["library"])


class ScanRequest(BaseModel):
    root_path: str


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
    "errors": [],
    "started_at": None,
    "finished": False,
    "result": None,
    "error": None,
}


@router.post("/scan")
def scan_library(body: ScanRequest):
    """Start a background import of every audio file under a root folder.

    Decoding a file for its waveform peaks takes about a second, so a large
    folder would otherwise be a silent blocking request (REQ-10-SP). Returns
    at once; poll GET /scan-status for progress.

    Args:
        body (ScanRequest): The root folder to scan.

    Returns:
        dict: `{started: True, total: N}`.

    Raises:
        HTTPException: 400 when the folder does not exist, 409 when another
            job is running.
    """
    root = Path(body.root_path).expanduser().resolve()
    if not root.is_dir():
        raise HTTPException(400, f"Not a directory: {root}")

    audio_files = scan_directory(str(root))
    store = get_library_store()
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


def _reset_scan_state(total: int) -> None:
    """Replace the scan state with a fresh, running one for `total` files."""
    global _scan_state
    _scan_state = {
        "running": True,
        "done": 0,
        "total": total,
        "current_file": "",
        "current_crate": "",
        "added": 0,
        "skipped": 0,
        "errors": [],
        "started_at": _now_iso(),
        "finished": False,
        "result": None,
        "error": None,
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
    """Import one file and count it — added, skipped or failed — before moving on."""
    try:
        outcome = _import_file(store, root, file_path)
    except Exception as exc:  # noqa: BLE001 — one bad file never stops the scan
        logger.exception("Scan failed for %s", file_path)
        _scan_state["errors"].append(f"{file_path.name}: {exc}")
    else:
        _scan_state[outcome] += 1
    finally:
        _scan_state["done"] += 1


def _import_file(store, root: Path, file_path: Path) -> str:
    """Add one file to the library unless it is already there.

    Args:
        store: The library store.
        root (Path): The scan's root folder, which names the crate.
        file_path (Path): The audio file to import.

    Returns:
        str: "added" or "skipped".

    Raises:
        Exception: Whatever metadata or artwork extraction throws; the caller
            records it against the file.
    """
    file_path_str = str(file_path)
    if store.find_song_by_path(file_path_str):
        return "skipped"

    meta = extract_metadata(file_path_str)
    title = meta.get("title") or file_path.stem
    artist = meta.get("artist") or "Unknown Artist"

    # Idempotent: also check by artist+title (in case file was moved)
    if store.find_song_by_artist_title(artist, title):
        return "skipped"

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

    Args:
        root (Path): The scan's root folder, which names the crate.
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
        "root_folder": _crate_name(root, file_path),
        "waveform_peaks": peaks,
        "artwork_url": None,
        "energy": 0,
        "people": 0,
    }


def _crate_name(root: Path, file_path: Path) -> str:
    """The crate a file belongs to: its folder below `root`, else the root's name."""
    try:
        rel_parent = file_path.parent.relative_to(root)
    except ValueError:
        return root.name
    return str(rel_parent) if str(rel_parent) != "." else root.name


def _finish_scan() -> None:
    """End the scan job: publish its result (or error) and free the slot."""
    _scan_state["running"] = False
    _scan_state["finished"] = True
    if _scan_state["error"] is None:
        _scan_state["result"] = {
            "total": _scan_state["total"],
            "added": _scan_state["added"],
            "skipped": _scan_state["skipped"],
            "errors": list(_scan_state["errors"]),
        }
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
    state["result"] = dict(state["result"]) if state["result"] else None
    return state


@router.get("/crates")
def list_crates():
    """List the library's crates with their track counts.

    The crate rule is the app's `crateOf` (`src/lib/trackFormat.ts`): the
    stored `root_folder`, else the file's parent folder, else "Unknown". It
    used to count a row without `root_folder` under "Unknown" while the filter
    (and the table) called it by its parent folder, so one track belonged to
    three different crates depending on who asked.

    Returns:
        list[dict]: `{name, track_count}` per crate, sorted by name.
    """
    store = get_library_store()
    songs = store.get_songs()

    crate_counts: dict[str, int] = {}
    for song in songs:
        folder = crate_of(song)
        crate_counts[folder] = crate_counts.get(folder, 0) + 1

    crates = [
        {"name": name, "track_count": count}
        for name, count in sorted(crate_counts.items())
    ]
    return crates


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
    """The crate a song belongs to: its `root_folder`, else its file's folder.

    Args:
        song (dict): A song row.

    Returns:
        str: The crate name, or "Unknown" when the row carries no path.
    """
    if song.get("root_folder"):
        return str(song["root_folder"])
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
        tuple[Path, ...]: Home first, then the configured root when it is a
        different folder.
    """
    boundaries = [home]
    try:
        configured = get_library_store().get_config("root_path")
    except Exception:  # noqa: BLE001 — an unreadable store must not break browsing
        return tuple(boundaries)
    if configured:
        root = Path(configured).expanduser().resolve()
        if root != home:
            boundaries.append(root)
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


@router.get("/root")
def get_root():
    """Get the current root folder path."""
    store = get_library_store()
    root = store.get_config("root_path")
    return {"root_path": root}


@router.put("/root")
def set_root(body: ScanRequest):
    """Set the root folder path."""
    root = Path(body.root_path).expanduser().resolve()
    if not root.is_dir():
        raise HTTPException(400, f"Not a directory: {root}")
    store = get_library_store()
    store.set_config("root_path", str(root))
    return {"root_path": str(root)}


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
        _analyze_state["running"] = False
        _analyze_state["finished"] = True
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

    return ReanalyzeResponse(
        song_id=song_id,
        bpm=result.get("bpm"),
        musical_key=result.get("musical_key"),
        duration=result.get("duration"),
        bpm_fit=bool(result.get("bpm_fit", True)),
        applied=changed,
    )


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
