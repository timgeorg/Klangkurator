"""Directory scanner — walk a root folder and find audio files."""

from pathlib import Path

from backend.config import SUPPORTED_AUDIO_EXTENSIONS


def scan_directory(root_path: str) -> list[Path]:
    """Walk a root folder recursively and return all audio files found.

    Returns sorted list of Path objects.
    """
    root = Path(root_path).expanduser().resolve()

    if not root.is_dir():
        raise ValueError(f"Not a directory: {root}")

    audio_files: set[Path] = set()
    for ext in SUPPORTED_AUDIO_EXTENSIONS:
        audio_files.update(root.rglob(f"*{ext}"))
        audio_files.update(root.rglob(f"*{ext.upper()}"))

    return sorted(audio_files)
