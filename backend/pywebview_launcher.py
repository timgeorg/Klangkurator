"""PyWebView launcher — starts FastAPI in a daemon thread and opens a desktop window.

Usage:
    python -m backend.main          # Desktop mode (PyWebView window)
    python -m backend.main --server  # Server-only mode (for dev with npm run dev)
"""

import logging
import socket
import threading
from pathlib import Path

import uvicorn

logger = logging.getLogger(__name__)


def find_free_port(start: int = 8000, end: int = 9000) -> int:
    """Find a free localhost port to avoid conflicts."""
    for port in range(start, end):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError("No free port found in range 8000-9000")


def start_server(app, port: int) -> uvicorn.Server:
    """Start uvicorn in the current thread (blocking). Returns the server."""
    config = uvicorn.Config(
        app,
        host="127.0.0.1",
        port=port,
        log_level="warning",
        access_log=False,
    )
    server = uvicorn.Server(config)
    server.run()
    return server


def start_server_async(app, port: int) -> uvicorn.Server:
    """Start uvicorn in a daemon thread. Returns the server handle."""
    config = uvicorn.Config(
        app,
        host="127.0.0.1",
        port=port,
        log_level="warning",
        access_log=False,
    )
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    return server


def launch_desktop():
    """Start FastAPI + open a PyWebView window pointing at it."""
    import webview

    from backend.main import app

    port = find_free_port()

    # Start uvicorn in background
    server = start_server_async(app, port)

    # Wait for server to be ready (poll health endpoint)
    import time
    import urllib.request

    for _ in range(50):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=0.5)
            break
        except Exception:
            time.sleep(0.1)
    else:
        logger.warning("Server didn't become ready in 5s, launching window anyway")

    url = f"http://127.0.0.1:{port}"

    def on_closing():
        logger.info("Window closing — stopping server")
        server.should_exit = True

    window = webview.create_window(
        "Klangkurator",
        url,
        width=1400,
        height=900,
        min_size=(1000, 600),
        text_select=True,
    )
    window.events.closing += on_closing

    # `private_mode=False` plus a storage path under the data folder: pywebview
    # defaults to private mode, where its GTK backend turns HTML5 local storage
    # off, so the desktop window could not keep anything (issue #51, decision 6).
    # Nothing the app needs depends on browser storage any more; this keeps the
    # behaviour a browser tab has.
    settings_dir = Path.home() / ".klangkurator"
    settings_dir.mkdir(parents=True, exist_ok=True)
    webview.start(  # debug=True → F12 DevTools
        debug=True,
        private_mode=False,
        storage_path=str(settings_dir / "webview"),
    )


def launch_server(port: int = 8000):
    """Start FastAPI in server-only mode (for development with npm run dev)."""
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host="127.0.0.1",
        port=port,
        reload=True,
        log_level="info",
    )