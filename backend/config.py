"""Configuration: paths, constants, data directory resolution."""

from pathlib import Path

# Data directory — where the JSON files live
DATA_DIR = Path.home() / ".klangkurator"
LIBRARY_FILE = DATA_DIR / "library.json"
BLOCKS_FILE = DATA_DIR / "blocks.json"
SETS_FILE = DATA_DIR / "sets.json"

# Audio extensions the file scanner looks for
SUPPORTED_AUDIO_EXTENSIONS = [
    ".mp3", ".flac", ".wav", ".m4a", ".ogg", ".aiff", ".aac", ".wma",
]

# Frontend build directory (for Phase 5 — PyWebView static serving)
FRONTEND_DIST = Path(__file__).parent.parent / "dist"


def ensure_data_dir() -> None:
    """Create the data directory if it doesn't exist."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
