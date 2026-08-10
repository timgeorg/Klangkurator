"""API package — library scan + crate listing endpoints."""

from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.config import SUPPORTED_AUDIO_EXTENSIONS
from backend.scanner.metadata import extract_metadata
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
            "artwork_url": None,
            "danceability": 0,
            "energy": 0,
            "social_acceptance": 0,
        }

        store.add_song(song_data)
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


# ── Audio analysis ──────────────────────────────────────


class AnalyzeResponse(BaseModel):
    analyzed: int
    updated: int
    skipped: int
    errors: list[str]


@router.post("/analyze-all", response_model=AnalyzeResponse)
def analyze_all_songs():
    """Analyze all songs missing BPM/key and fill them in.
    Uses librosa — runs locally, ~3-5s per track on CPU.
    """
    store = get_library_store()
    return analyze_all_missing_bpm(store)


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
