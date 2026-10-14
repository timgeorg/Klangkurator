"""Generic JSON file store with atomic writes."""

import json
import os
import threading
from pathlib import Path


class BaseStore:
    """Load a JSON file into memory, write back on mutation.

    Atomic write: write to .tmp file, then os.rename (atomic on POSIX).
    Saves run one at a time: every save writes the same .tmp file, so two at
    once (a request in the threadpool, the analysis thread, the waveform
    backfill) would rename it from under each other.
    """

    def __init__(self, file_path: Path):
        self._file_path = file_path
        self._data: dict = {}
        self._lock = threading.RLock()
        self._load()

    def _load(self) -> None:
        """Load JSON from disk. If file doesn't exist, start empty."""
        if self._file_path.exists():
            try:
                self._data = json.loads(self._file_path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, IOError):
                self._data = {}
        else:
            self._data = {}

    def _save(self) -> None:
        """Write to temp file, then atomic rename, one save at a time."""
        with self._lock:
            self._file_path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self._file_path.with_suffix(".tmp")
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(self._data, f, indent=2, ensure_ascii=False, default=str)
            os.replace(tmp, self._file_path)
