"""Configuration from the environment, read once at import (REQ-34-CT).

No I/O happens here, so the server starts and lists its tools with the backend
stopped.
"""

import os

#: Where the app's API listens. The MCP server never starts the app.
DEFAULT_URL = "http://127.0.0.1:8000"

#: Seconds a single API call may take before it is reported as unreachable.
DEFAULT_TIMEOUT = 30.0


def api_url() -> str:
    """The base URL of the running app."""
    return os.environ.get("KLANGKURATOR_URL", DEFAULT_URL).rstrip("/")


def timeout() -> float:
    """How long one HTTP request may take."""
    raw = os.environ.get("KLANGKURATOR_TIMEOUT", "")
    try:
        return float(raw) if raw else DEFAULT_TIMEOUT
    except ValueError:
        return DEFAULT_TIMEOUT


def read_only() -> bool:
    """Whether the 13 library-writing tools are refused (``KLANGKURATOR_READ_ONLY=1``)."""
    return os.environ.get("KLANGKURATOR_READ_ONLY", "").strip() not in ("", "0")


def allowed_roots() -> list[str] | None:
    """The allowlist for ``scan_library`` and ``set_library_root``, or None.

    None means "not configured": the caller then falls back to the app's own
    configured root, so a fresh install may scan its library and nothing else.
    """
    raw = os.environ.get("KLANGKURATOR_ROOTS", "").strip()
    if not raw:
        return None
    return [part for part in raw.split(os.pathsep) if part]
