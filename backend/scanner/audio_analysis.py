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
import math
from pathlib import Path

logger = logging.getLogger(__name__)

# Key mapping: chroma profile index → Camelot + standard notation
# librosa.key estimates return (key_index, confidence, mode)
# We use a simpler approach: extract chroma, find dominant pitch classes,
# map to key via Krumhansl-Schmuckler-style correlation.

KEY_MAP_MAJOR = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
KEY_MAP_MINOR = ["Cm", "C#m", "Dm", "D#m", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "A#m", "Bm"]


def analyze_track(
    file_path: str,
    duration_seconds: float = 120.0,
    bpm_range: tuple[float, float] | None = None,
) -> dict:
    """Analyze a single audio file for BPM and key.

    Args:
        file_path: Path to the audio file.
        duration_seconds: How many seconds to analyze (first N seconds).
            120s is enough for accurate BPM/key — full track is slower
            and rarely more accurate.
        bpm_range: Optional (min, max) hint for the tempo. It biases the
            estimate toward the window instead of filtering candidates to
            it — see `_bpm_prior` for why that distinction matters.

    Returns:
        dict with: bpm (float|None), musical_key (str|None),
        duration (float|None), bpm_fit (bool — whether bpm sits inside
        bpm_range; always True when no range was given, False when the
        tempo could not be detected).
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
        return {"bpm": None, "musical_key": None, "duration": None, "bpm_fit": False}

    # ── BPM ────────────────────────────────────────────────
    bpm = None
    try:
        prior = _bpm_prior(*bpm_range) if bpm_range else None
        # Prior goes through beat_track, NOT feature.tempo: the two build their
        # onset envelope differently (beat_track aggregates with np.median,
        # feature.tempo with np.mean), and on real tracks that difference moves
        # the answer — measured 2 of 14 library tracks land on a different BPM.
        # beat_track has exposed `prior` since 0.10, so it steers the same
        # estimator the app already ships and the no-hint answer is identical.
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr, prior=prior)
        value = round(float(np.asarray(tempo).item()), 1)
        # beat_track answers 0.0 when the onset envelope has no onsets at all
        # (silence, a beatless pad, a long reverb-only intro). That is a failed
        # detection, not a tempo — 0 BPM is outside the 40–250 the app allows,
        # and treating it as a success would write a nonsense BPM that the
        # batch job never revisits (it only fills `bpm is None`).
        bpm = value if value > 0 else None
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

    bpm_fit = bpm is not None and (bpm_range is None or bpm_range[0] <= bpm <= bpm_range[1])

    return {
        "bpm": bpm,
        "musical_key": musical_key,
        "duration": full_duration,
        "bpm_fit": bpm_fit,
    }


def _bpm_prior(bpm_min: float, bpm_max: float):
    """A log-normal prior that biases the tempo estimate toward [min, max].

    Biases, it does not filter — and that is deliberate. Filtering candidate
    tempos to the window always returns a number: asked for 200–220 on a
    true-128 track it answers ~215 and there is no signal to say the answer is
    wrong. A prior instead shifts the estimate toward the window while letting
    the audio overrule it, so a result outside the window is a real "this
    signal doesn't support your range" that the caller can report.

    The median sits at the geometric centre of the window with sigma =
    ln(max/min)/4, so roughly ±2 sigma spans the window.

    Returns None when there is no usable hint, so the caller can pass it
    straight through:

    - a degenerate window (``max <= min``) has no centre and a zero-width
      log-normal is all-NaN, which would poison the tempogram silently;
    - a window an octave wide or wider cannot disambiguate octaves — the one
      thing this hint is for — and a prior over it would only drag the estimate
      toward the geometric centre (40–250 pulls a correct 136 to 92). Such a
      range means "no constraint", so it must behave exactly like no range.
    """
    from scipy.stats import lognorm

    if bpm_max <= bpm_min or bpm_max / bpm_min >= 2.0:
        return None
    centre = math.sqrt(bpm_min * bpm_max)
    sigma = math.log(bpm_max / bpm_min) / 4.0
    return lognorm(loc=0, s=sigma, scale=centre)


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
    songs: list[dict] | None = None,
    should_stop=None,
) -> dict:
    """Analyze all songs that are missing BPM and update them.

    Args:
        library_store: LibraryStore instance.
        limit: Max number of songs to analyze (None = all).
        progress_cb: Optional callable(done, total, current_title).
            Called with the number of tracks finished **before** the track
            about to start, and again with that track counted as done after
            it — on every path, including a skipped or failed track. The
            first call is therefore `0 / N` and the last `N / N`.
        songs: The tracks to analyze, when the caller already picked them. The
            route counts its `total` this way, so its status and this loop can
            never disagree. None means "every song without a BPM".
        should_stop: Optional callable() -> bool. Checked before each track;
            when it answers True the loop breaks and the summary says
            `cancelled`. A stop asked for during the last track ends the run
            normally instead.

    Returns:
        dict with: analyzed, updated, skipped, errors, cancelled.
    """
    to_analyze = _tracks_to_analyze(library_store, songs, limit)
    total = len(to_analyze)
    summary = {"analyzed": 0, "updated": 0, "skipped": 0, "errors": [], "cancelled": False}

    # The table edits songs while this runs (3-5s per track); a BPM or key set
    # by hand in the meantime wins over the analysed one. `song` is the live dict.
    keys_at_start = {s["id"]: s.get("musical_key") for s in to_analyze}

    for idx, song in enumerate(to_analyze, start=1):
        if should_stop is not None and should_stop():
            summary["cancelled"] = True
            logger.info("Analysis stopped after %d of %d tracks", idx - 1, total)
            break

        _report_progress(progress_cb, idx - 1, total, song)
        _record_track(library_store, song, keys_at_start, summary)
        _report_progress(progress_cb, idx, total, song)

    return summary


def _tracks_to_analyze(
    library_store, songs: list[dict] | None, limit: int | None
) -> list[dict]:
    """The tracks this run is responsible for, in library order."""
    if songs is None:
        songs = [s for s in library_store.get_songs() if s.get("bpm") is None]
    return songs[:limit] if limit else songs


def _report_progress(progress_cb, done: int, total: int, song: dict) -> None:
    """Publish progress for `song`, when the caller asked for it."""
    if progress_cb is not None:
        progress_cb(done, total, song.get("title", "Unknown"))


def _record_track(
    library_store, song: dict, keys_at_start: dict, summary: dict
) -> None:
    """Analyze one track, save what it found and count it in `summary`."""
    outcome, updated, error = _analyze_one_track(library_store, song, keys_at_start)
    summary[outcome] += 1
    summary["updated"] += updated
    if error is not None:
        summary["errors"].append(error)


def _analyze_one_track(
    library_store, song: dict, keys_at_start: dict
) -> tuple[str, int, str | None]:
    """Analyze one track and write the result onto it.

    Args:
        library_store: LibraryStore instance.
        song (dict): The live song dict; a value set by hand during the run
            wins over the detected one.
        keys_at_start (dict): Song id -> its key before the run.

    Returns:
        tuple[str, int, str | None]: the counter to advance ("analyzed" or
        "skipped" — a failed track is skipped too), 1 when values changed else
        0, and the error text for a failed track (None otherwise).
    """
    file_path = song.get("file_path")
    if not file_path or not Path(file_path).exists():
        return "skipped", 0, None

    try:
        result = analyze_track(file_path)
    except Exception as exc:  # noqa: BLE001 — one bad file never stops the run
        logger.warning("Analysis failed for %s: %s", file_path, exc)
        return "skipped", 0, f"{song.get('title', 'Unknown')}: {exc}"

    updates = _detected_updates(song, result, keys_at_start)
    if not updates:
        return "analyzed", 0, None

    library_store.update_song(song["id"], updates)
    return "analyzed", 1, None


def _detected_updates(song: dict, result: dict, keys_at_start: dict) -> dict:
    """The fields this run may write onto one song.

    BPM and duration only fill what is missing. The key is written whenever the
    song's key still equals the one it had when the run started — so a key set
    by hand during the run wins, but a key the track always had does not block
    the detector.

    Args:
        song (dict): The live song.
        result (dict): What `analyze_track` detected.
        keys_at_start (dict): Song id -> its key before the run.

    Returns:
        dict: The fields to write on the song (empty when nothing applies).
    """
    updates: dict = {}
    for field in ("bpm", "duration"):
        if result.get(field) is not None and song.get(field) is None:
            updates[field] = result[field]
    if result.get("musical_key") is not None and song.get("musical_key") == keys_at_start[song["id"]]:
        updates["musical_key"] = result["musical_key"]
    return updates