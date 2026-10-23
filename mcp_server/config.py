"""Configuration from the environment (REQ-34-CT).

Each value is read when it is used, so a changed variable needs no restart. No
I/O happens here, so the server starts and lists its tools with the backend
stopped.
"""

import math
import os
from pathlib import Path

#: Where the app's API listens. The MCP server never starts the app.
DEFAULT_URL = "http://127.0.0.1:8000"

#: Seconds a single API call may take before it is reported as unreachable.
DEFAULT_TIMEOUT = 30.0

#: The longest timeout handed to the HTTP client; a larger value is capped.
MAX_TIMEOUT = 86400.0


def api_url() -> str:
    """The base URL of the running app."""
    return os.environ.get("KLANGKURATOR_URL", DEFAULT_URL).rstrip("/")


def timeout() -> float:
    """How long one HTTP request may take."""
    raw = os.environ.get("KLANGKURATOR_TIMEOUT", "")
    try:
        value = float(raw) if raw else DEFAULT_TIMEOUT
    except ValueError:
        return DEFAULT_TIMEOUT
    # Zero or less would fail every request at once and read as an outage;
    # inf or nan cannot be handed to the HTTP client at all.
    if not (math.isfinite(value) and value > 0):
        return DEFAULT_TIMEOUT
    # A value past what a socket accepts (1e10 s) would fail every request.
    return min(value, MAX_TIMEOUT)


#: The folder `export_library` writes into, unless KLANGKURATOR_EXPORT_DIR names another.
DEFAULT_EXPORT_DIR = "~/klangkurator-exports"


def export_dir() -> Path:
    """The one folder `export_library` may write into (``KLANGKURATOR_EXPORT_DIR``)."""
    raw = os.environ.get("KLANGKURATOR_EXPORT_DIR", "").strip()
    return Path(raw or DEFAULT_EXPORT_DIR).expanduser()


def read_only() -> bool:
    """Whether the 13 library-writing tools are refused (``KLANGKURATOR_READ_ONLY=1``)."""
    return os.environ.get("KLANGKURATOR_READ_ONLY", "").strip() not in ("", "0")


def allowed_roots() -> list[str] | None:
    """The allowlist for ``scan_library`` and ``set_library_root``, or None.

    None means "not configured": the caller then falls back to the app's own
    configured root, read on each call. With neither set (a fresh install
    before a folder is chosen) both tools refuse every path.
    """
    raw = os.environ.get("KLANGKURATOR_ROOTS", "").strip()
    if not raw:
        return None
    return [part for part in raw.split(os.pathsep) if part]
