"""Configuration: paths, constants, data directory resolution."""

import os
from pathlib import Path

#: Set this to anywhere but your real home and the store refuses to write.
#: It exists because `DATA_DIR` is frozen when `backend` is first imported:
#: a script that points HOME at a scratch folder *after* importing `backend`
#: still holds the real path, and an ad-hoc probe would then write the real
#: library. One such probe did, on 2026-10-31, and cost a restore from backup.
SAFE_HOME_ENV = "KLANGKURATOR_REQUIRE_HOME"

# Data directory — where the JSON files live
DATA_DIR = Path.home() / ".klangkurator"
LIBRARY_FILE = DATA_DIR / "library.json"
BLOCKS_FILE = DATA_DIR / "blocks.json"
SETS_FILE = DATA_DIR / "sets.json"
# UI preferences (column layout, map, theme, covers, dock, volume, crate tabs).
# Separate from library.json on purpose: a column drag must not rewrite a
# multi-megabyte library (issue #51).
SETTINGS_FILE = DATA_DIR / "settings.json"
ARTWORK_DIR = DATA_DIR / "artwork"  # PF-14: extracted cover thumbnails (one jpg per song id)

# Audio extensions the file scanner looks for
SUPPORTED_AUDIO_EXTENSIONS = [
    ".mp3", ".flac", ".wav", ".m4a", ".ogg", ".aiff", ".aac", ".wma",
]

# The BPM a track may take, one decimal at most — mirrors the frontend's
# BPM_RANGE in src/lib/trackFormat.ts and the Edit dialog's input bounds.
BPM_MIN = 40.0
BPM_MAX = 250.0

# Frontend build directory (for Phase 5 — PyWebView static serving)
FRONTEND_DIST = Path(__file__).parent.parent / "dist"


def ensure_data_dir() -> None:
    """Create the data directory, refusing to touch the real one when asked.

    Raises:
        RuntimeError: `KLANGKURATOR_REQUIRE_HOME` is set and `DATA_DIR` is not
            inside it. That is the "I meant to be isolated" guard: a test or a
            probe sets it, and a resolve that had already frozen the real home
            fails loudly instead of writing the user's library.
    """
    required = os.environ.get(SAFE_HOME_ENV, "").strip()
    if required:
        guard = Path(required).expanduser().resolve()
        if not (DATA_DIR.resolve() == guard or guard in DATA_DIR.resolve().parents):
            raise RuntimeError(
                f"Refusing to write {DATA_DIR}: {SAFE_HOME_ENV}={required}, but the data "
                "directory resolved outside it. `backend` was imported before HOME was "
                "pointed at the scratch folder; set HOME first, then import."
            )
    DATA_DIR.mkdir(parents=True, exist_ok=True)
