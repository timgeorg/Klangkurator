"""Generic JSON file store with atomic writes."""

import json
import logging
import os
import threading
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)


class BaseStore:
    """Load a JSON file into memory, write back on mutation.

    Atomic write: write to .tmp file, then os.rename (atomic on POSIX).
    Saves run one at a time: every save writes the same .tmp file, so two at
    once (a request in the threadpool, the analysis thread, the waveform
    backfill) would rename it from under each other.

    An unreadable file is **kept**, not replaced: it is renamed to
    `<name>.corrupt-<timestamp>.json` and logged before the store starts empty,
    so a transient read error or a bad edit can never cost the library
    (issue #51).
    """

    def __init__(self, file_path: Path):
        self._file_path = file_path
        self._data: dict = {}
        self._lock = threading.RLock()
        self._load()

    def _load(self) -> None:
        """Load JSON from disk, preserving an unreadable file before starting empty."""
        if not self._file_path.exists():
            self._data = {}
            return
        try:
            self._data = json.loads(self._file_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError, OSError) as exc:
            # UnicodeDecodeError is a ValueError, not a JSONDecodeError: a file
            # with a truncated multi-byte sequence (a disk hiccup, an editor
            # saving Latin-1, bit rot) must be preserved too, or every endpoint
            # 500s and the app cannot start.
            self._data = {}
            self._preserve_corrupt_file(exc)

    def _preserve_corrupt_file(self, exc: Exception) -> None:
        """Rename an unreadable file aside and log why, so nothing is lost.

        Args:
            exc (Exception): Why the read failed, for the log line.
        """
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        target = self._file_path.with_name(f"{self._file_path.stem}.corrupt-{stamp}.json")
        try:
            self._file_path.replace(target)
        except OSError:
            logger.exception(
                "Could not preserve the unreadable file %s; starting empty",
                self._file_path,
            )
            return
        logger.exception(
            "Unreadable JSON in %s. The file was kept as %s and the store starts "
            "empty; restore it from that copy if the data matters.",
            self._file_path,
            target,
            exc_info=exc,
        )

    def _save(self) -> None:
        """Write to temp file, then atomic rename, one save at a time."""
        with self._lock:
            self._file_path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self._file_path.with_suffix(".tmp")
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(self._data, f, indent=2, ensure_ascii=False, default=str)
            os.replace(tmp, self._file_path)
