"""Waveform peak extraction — scan-time preprocessing (PF-13).

Peaks are computed once per track at library-scan time (PF-13 decision b)
and persisted on the song as `waveform_peaks` (200 floats, 0..1). The
frontend renders them directly; tracks scanned before this feature fall
back to the lazy endpoint GET /api/audio/waveform/{song_id}.

Speed: ~0.6-1.0s per 5-11min track (decode-bound: soundfile must decode the
whole file once; measured floor ~600ms for a 10+min 48kHz track — the peak
math itself is negligible after float32 read + 4:1 decimation). Scans show a
progress bar, so the added time is absorbed by the import flow (REQ-10-AP).
The librosa fallback downsamples to 11kHz with the fast resampler (default
`kaiser_best` is ~10x slower and unnecessary for peaks).
"""

import logging

import numpy as np

logger = logging.getLogger(__name__)


def compute_peaks(file_path: str, buckets: int = 200) -> list[float] | None:
    """Compute the normalized peak envelope for an audio file (PF-13).

    Computed at scan time (decision b) and persisted on the song;
    <0.5s/track target.

    Returns:
        `buckets` floats in [0.05, 1.0], rounded to 3 decimals — or None
        on failure (missing/corrupt file). Failures are logged as a
        warning so a bad file never breaks the scan.
    """
    try:
        y = _load_mono(file_path)
        if y is None or len(y) == 0:
            return None
        return _bucket_peaks(np.abs(y), buckets)
    except Exception as e:
        logger.warning("Waveform peaks failed for %s: %s", file_path, e)
        return None


def _load_mono(file_path: str) -> np.ndarray | None:
    """Mono signal — soundfile raw read first, librosa fast-load fallback."""
    try:
        import soundfile as sf

        # float32 halves memory traffic vs float64 and is plenty for peak
        # envelopes (tester-measured ~1.5x on the bucket math); long tracks
        # are still decode-bound (~0.6-0.7s for 10+ min files).
        data, _sr = sf.read(file_path, always_2d=True, dtype="float32")
        mono = data.mean(axis=1, dtype=np.float32)
        # Decimate 4:1 before bucketing — 200 buckets from every 4th sample
        # is visually identical and cuts the bucketing pass ~4x.
        return mono[::4]
    except Exception as sf_error:
        logger.debug(
            "soundfile failed for %s (%s) — falling back to librosa",
            file_path,
            sf_error,
        )

    import librosa

    y, _sr = librosa.load(file_path, sr=11025, mono=True, res_type="kaiser_fast")
    return y


def _bucket_peaks(y_abs: np.ndarray, buckets: int) -> list[float]:
    """Max-abs per equal-width bucket, normalized to the global max."""
    # Edge-pad the tail so every bucket has samples (no empty-window max).
    pad = (-len(y_abs)) % buckets
    if pad:
        y_abs = np.pad(y_abs, (0, pad), mode="edge")
    peaks = y_abs.reshape(buckets, -1).max(axis=1)

    global_max = float(peaks.max())
    if global_max <= 0:
        # Digital silence — render a flat minimum line instead of NaNs.
        return [0.05] * buckets

    normalized = np.clip(peaks / global_max, 0.05, 1.0)
    return [round(float(v), 3) for v in normalized]