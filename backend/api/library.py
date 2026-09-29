"""API package — library scan + crate listing endpoints."""

import threading
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.config import SUPPORTED_AUDIO_EXTENSIONS
from backend.scanner.metadata import extract_metadata
from backend.scanner.waveform import compute_peaks
from backend.scanner.artwork import extract_artwork
from backend.scanner.audio_analysis import analyze_track, analyze_all_missing_bpm
from backend.storage import get_library_store

router = APIRouter(prefix="/api/library", tags=["library"])


class ScanRequest(BaseModel):
    root_path: str


class PickFolderResponse(BaseModel):
    path: str | None = None


@router.post("/scan")
def scan_library(body: ScanRequest):
    """Scan a root folder recursively for audio files and import them."""
    root = Path(body.root_path).expanduser().resolve()

    if not root.is_dir():
        raise HTTPException(400, f"Not a directory: {root}")

    # Walk the tree
    audio_files = []
    for ext in SUPPORTED_AUDIO_EXTENSIONS:
        audio_files.extend(root.rglob(f"*{ext}"))
        audio_files.extend(root.rglob(f"*{ext.upper()}"))

    audio_files = sorted(set(audio_files))

    store = get_library_store()
    added = 0
    skipped = 0
    errors = []

    for file_path in audio_files:
        file_path_str = str(file_path)

        # Check if already exists
        if store.find_song_by_path(file_path_str):
            skipped += 1
            continue

        # Extract metadata
        try:
            meta = extract_metadata(file_path_str)
        except Exception as e:
            errors.append(f"{file_path.name}: {e}")
            continue

        # Derive root_folder from parent folder name relative to root
        try:
            rel_parent = file_path.parent.relative_to(root)
            root_folder = str(rel_parent) if str(rel_parent) != "." else root.name
        except ValueError:
            root_folder = root.name

        # Build song record
        title = meta.get("title") or file_path.stem
        artist = meta.get("artist") or "Unknown Artist"

        # Idempotent: also check by artist+title (in case file was moved)
        if store.find_song_by_artist_title(artist, title):
            skipped += 1
            continue

        # PF-13: peaks are computed at scan time and persisted on the song
        # (may be None — the lazy /api/audio/waveform endpoint backfills).
        peaks = compute_peaks(file_path_str)

        song_data = {
            "title": title,
            "artist": artist,
            "album": meta.get("album"),
            "year": meta.get("year"),
            "bpm": meta.get("bpm"),
            "musical_key": meta.get("musical_key"),
            "duration": meta.get("duration"),
            "genre": meta.get("genre"),
            "file_path": file_path_str,
            "root_folder": root_folder,
            "waveform_peaks": peaks,
            "artwork_url": None,
            "danceability": 0,
            "energy": 0,
            "social_acceptance": 0,
        }

        song = store.add_song(song_data)

        # PF-14: extract artwork after add_song — add_song overwrites any
        # client-supplied id (id is generated inside the store), so the real
        # id only exists on the returned dict. Artwork is a separate update
        # so a failed extraction never blocks the import.
        art = extract_artwork(file_path_str, song["id"])
        if art:
            store.update_song(song["id"], {"artwork_url": art})

        added += 1

    return {
        "total": len(audio_files),
        "added": added,
        "skipped": skipped,
        "errors": errors,
    }


@router.get("/crates")
def list_crates():
    """List distinct root_folder values with track counts."""
    store = get_library_store()
    songs = store.get_songs()

    crate_counts: dict[str, int] = {}
    for song in songs:
        folder = song.get("root_folder") or "Unknown"
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

    - `path` omitted or "~" → the user's home directory
    - Only directories are returned (no files)
    - Hidden entries (dot-prefixed) are skipped
    - Access outside the user's home directory is rejected
    """
    home = Path.home().resolve()
    raw = (path or "").strip()

    if raw in ("", "~", "/"):
        target = home
    else:
        target = Path(raw).expanduser()
        if not target.is_absolute():
            target = home / target
        target = target.resolve()

        # Sandboxed to the home directory — this endpoint exists so a browser
        # tab can pick a music folder on the same machine; nothing beyond
        # ~ should be reachable through it.
        if target != home and home not in target.parents:
            raise HTTPException(
                403,
                f"Access denied: {target} is outside your home directory ({home})",
            )

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
        "parent": str(target.parent) if target != home else None,
        "directories": [
            {"name": d.name, "path": str(d), "has_children": _has_subdirs(d)}
            for d in dirs
        ],
    }


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
# (AnalyzeResponse is kept for backward compatibility / OpenAPI schema.)

class AnalyzeResponse(BaseModel):
    analyzed: int
    updated: int
    skipped: int
    errors: list[str]


_analyze_state: dict = {
    "running": False,
    "done": 0,
    "total": 0,
    "current_title": "",
    "started_at": None,
    "finished": False,
    "result": None,
    "error": None,
}
_analyze_lock = threading.Lock()


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

    Returns immediately — poll GET /analyze-status for progress.
    Uses librosa — runs locally, ~3-5s per track on CPU.

    Notes:
        The job thread mutates the library store while the rest of the
        API keeps serving requests. This is acceptable for a single-user
        app (matches the existing design where scan/analyze already
        mutate from request handlers).
    """
    global _analyze_state

    store = get_library_store()

    with _analyze_lock:
        if _analyze_state["running"]:
            raise HTTPException(409, "Analysis already running")

        # Compute total synchronously: songs missing BPM whose file exists.
        songs = store.get_songs()
        to_analyze = [
            s for s in songs
            if s.get("bpm") is None
            and s.get("file_path")
            and Path(s["file_path"]).exists()
        ]
        total = len(to_analyze)

        if total == 0:
            # Nothing to analyze — return the summary directly, no thread
            # (analyze_all_missing_bpm returns the all-zero summary).
            return analyze_all_missing_bpm(store)

        _analyze_state = {
            "running": True,
            "done": 0,
            "total": total,
            "current_title": "",
            "started_at": _now_iso(),
            "finished": False,
            "result": None,
            "error": None,
        }

    def _run_analysis():
        global _analyze_state
        try:
            summary = analyze_all_missing_bpm(
                store,
                progress_cb=_update_progress,
            )
            _analyze_state["result"] = summary
        except Exception as e:  # noqa: BLE001 — job must never crash silently
            _analyze_state["error"] = str(e)
        finally:
            _analyze_state["running"] = False
            _analyze_state["finished"] = True

    thread = threading.Thread(target=_run_analysis, daemon=True)
    thread.start()

    return {"started": True, "total": total}


def _update_progress(done: int, total: int, current_title: str) -> None:
    """Progress callback — update the module-level job state."""
    _analyze_state["done"] = done
    _analyze_state["total"] = total
    _analyze_state["current_title"] = current_title


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("/analyze-status")
def analyze_status():
    """Poll the current (or last) analysis job: progress + result/error."""
    state = dict(_analyze_state)
    state["result"] = dict(state["result"]) if state["result"] else None
    return state


@router.post("/analyze/{song_id}")
def analyze_one_song(song_id: str):
    """Analyze a single song for BPM and key."""
    store = get_library_store()
    song = store.get_song(song_id)
    if song is None:
        raise HTTPException(404, "Song not found")

    file_path = song.get("file_path")
    if not file_path:
        raise HTTPException(400, "Song has no file_path")

    try:
        result = analyze_track(file_path)
    except FileNotFoundError:
        raise HTTPException(404, f"Audio file not found: {file_path}")
    except Exception as e:
        raise HTTPException(500, f"Analysis failed: {e}")

    # Update the song with results
    updates = {}
    if result.get("bpm") is not None:
        updates["bpm"] = result["bpm"]
    if result.get("musical_key") is not None:
        updates["musical_key"] = result["musical_key"]
    if result.get("duration") is not None and song.get("duration") is None:
        updates["duration"] = result["duration"]

    if updates:
        store.update_song(song_id, updates)

    return {"song_id": song_id, **result}
