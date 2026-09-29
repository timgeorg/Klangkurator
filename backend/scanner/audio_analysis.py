"""Audio analysis — BPM and key detection using librosa.

This replicates what Rekordbox does when you load a track: analyze the raw
audio signal to extract BPM and musical key. Runs locally, no cloud.

Usage:
    from backend.scanner.audio_analysis import analyze_track

    result = analyze_track("/path/to/track.mp3")
    # → {"bpm": 124.0, "musical_key": "A minor", "duration": 312.4}

For batch analysis with progress reporting:
    from backend.scanner.audio_analysis import analyze_all_missing_bpm

    def report(done, total, current_title):
        print(f"{done}/{total} — {current_title}")

    analyze_all_missing_bpm(library_store, progress_cb=report)
"""

import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Key mapping: chroma profile index → Camelot + standard notation
# librosa.key estimates return (key_index, confidence, mode)
# We use a simpler approach: extract chroma, find dominant pitch classes,
# map to key via Krumhansl-Schmuckler-style correlation.

KEY_MAP_MAJOR = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
KEY_MAP_MINOR = ["Cm", "C#m", "Dm", "D#m", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "A#m", "Bm"]


def analyze_track(file_path: str, duration_seconds: float = 120.0) -> dict:
    """Analyze a single audio file for BPM and key.

    Args:
        file_path: Path to the audio file.
        duration_seconds: How many seconds to analyze (first N seconds).
            120s is enough for accurate BPM/key — full track is slower
            and rarely more accurate.

    Returns:
        dict with: bpm (float), musical_key (str|None), duration (float|None)
    """
    import librosa
    import numpy as np

    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    # Load audio — librosa handles MP3, FLAC, WAV, M4A, OGG
    # sr=22050 is librosa default (enough for tempo/key, fast)
    # mono=True — we don't need stereo for analysis
    try:
        y, sr = librosa.load(file_path, sr=22050, mono=True, duration=duration_seconds)
    except Exception as e:
        logger.warning(f"librosa.load failed for {file_path}: {e}")
        return {"bpm": None, "musical_key": None, "duration": None}

    # ── BPM ────────────────────────────────────────────────
    try:
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        # tempo can be a numpy array (shape [1]) or scalar
        tempo_val = float(np.asarray(tempo).item())
        bpm = round(tempo_val, 1)
    except Exception as e:
        logger.warning(f"BPM detection failed for {file_path}: {e}")
        bpm = None

    # ── Key ────────────────────────────────────────────────
    try:
        musical_key = _detect_key(y, sr, librosa, np)
    except Exception as e:
        logger.warning(f"Key detection failed for {file_path}: {e}")
        musical_key = None

    # ── Duration ───────────────────────────────────────────
    try:
        full_duration = float(librosa.get_duration(path=file_path))
    except Exception:
        full_duration = None

    return {"bpm": bpm, "musical_key": musical_key, "duration": full_duration}


def _detect_key(y, sr: int, librosa=None, np=None) -> str | None:
    """Detect musical key using chroma features + Krumhansl-Schmuckler correlation.

    This is the standard approach used by open-source key detection tools.
    Rekordbox uses a similar (proprietary) method.
    """
    if librosa is None or np is None:
        import librosa as _librosa
        import numpy as _np
        librosa = _librosa
        np = _np

    # Extract chroma (pitch class distribution over time)
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=512)
    # Average over time → 12-element pitch class profile
    chroma_avg = np.mean(chroma, axis=1)  # shape: (12,)

    # Krumhansl-Schmuckler key profiles
    # Major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.30, 1.70]
    # Minor: [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 1.68]
    major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.30, 1.70])
    minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 1.68])

    best_score = -np.inf
    best_key = None
    best_mode = None

    # Try all 12 rotations for major and minor
    for i in range(12):
        # Rotate the chroma profile to align with each possible key
        rotated_chroma = np.roll(chroma_avg, -i)

        # Correlate with major and minor profiles
        major_score = np.corrcoef(rotated_chroma, major_profile)[0, 1]
        minor_score = np.corrcoef(rotated_chroma, minor_profile)[0, 1]

        if major_score > best_score:
            best_score = major_score
            best_key = i
            best_mode = "major"

        if minor_score > best_score:
            best_score = minor_score
            best_key = i
            best_mode = "minor"

    if best_key is None:
        return None

    if best_mode == "major":
        return KEY_MAP_MAJOR[best_key]
    else:
        return KEY_MAP_MINOR[best_key]


def analyze_all_missing_bpm(
    library_store,
    limit: int | None = None,
    progress_cb=None,
) -> dict:
    """Analyze all songs that are missing BPM and update them.

    Args:
        library_store: LibraryStore instance.
        limit: Max number of songs to analyze (None = all).
        progress_cb: Optional callable(done, total, current_title).
            Called with the 1-based index of the track that is about to
            start (before analysis), and again with the same index after
            it completes — so the final call has done == total (all
            tracks finished).

    Returns:
        dict with: analyzed, updated, skipped, errors
    """
    songs = library_store.get_songs()
    to_analyze = [s for s in songs if s.get("bpm") is None]

    if limit:
        to_analyze = to_analyze[:limit]

    analyzed = 0
    updated = 0
    skipped = 0
    errors = []

    total = len(to_analyze)

    for idx, song in enumerate(to_analyze, start=1):
        done = idx  # 1-based index of the track that is about to start
        title = song.get("title", "Unknown")

        if progress_cb is not None:
            progress_cb(done, total, title)

        file_path = song.get("file_path")
        if not file_path or not Path(file_path).exists():
            skipped += 1
            continue

        try:
            result = analyze_track(file_path)
        except Exception as e:
            errors.append(f"{song.get('title', 'Unknown')}: {e}")
            skipped += 1
            if progress_cb is not None:
                progress_cb(done, total, title)
            continue

        updates = {}
        if result.get("bpm") is not None:
            updates["bpm"] = result["bpm"]
        if result.get("musical_key") is not None:
            updates["musical_key"] = result["musical_key"]
        if result.get("duration") is not None and song.get("duration") is None:
            updates["duration"] = result["duration"]

        if updates:
            library_store.update_song(song["id"], updates)
            updated += 1

        analyzed += 1

        if progress_cb is not None:
            progress_cb(done, total, title)

    return {
        "analyzed": analyzed,
        "updated": updated,
        "skipped": skipped,
        "errors": errors,
    }