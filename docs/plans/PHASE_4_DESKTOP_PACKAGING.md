---
source: manual
created: 2026-08-09
tags:
  - plan
  - implementation
  - mvp
status: active
---
# Phase 4 — Desktop Packaging (PyWebView)

Status: Active
Estimated: 1 day
Prerequisites: Phase 3 complete

## Goal

Wrap the FastAPI backend + React frontend into a single desktop app that
launches with `python -m backend.main`. After this phase, Tim has a working
desktop app — no terminal, no `npm run dev`, just one command.

## Context

After Phase 3, the app runs as two processes:
- `uvicorn backend.main:app --port 8000` (backend)
- `npm run dev` (frontend, Vite dev server on port 5173)

For the desktop app, we need:
1. The frontend **built** (not dev server) — `npm run build` → `dist/`
2. FastAPI serving the built frontend as static files
3. PyWebView opening a window to `http://localhost:8000`
4. FastAPI starting automatically inside the PyWebView process
5. Clean shutdown when the window closes

## Tasks

### 4.1 — Serve built frontend from FastAPI (`backend/main.py`)

Add static file serving after all API routes:

```python
from fastapi.staticfiles import StaticFiles
from pathlib import Path

# After all API router includes...
frontend_dist = Path(__file__).parent.parent / "dist"
if frontend_dist.exists():
    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="assets")
    
    # SPA fallback: all non-API routes serve index.html
    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        # Don't intercept API routes
        if full_path.startswith("api/"):
            raise HTTPException(404)
        return FileResponse(frontend_dist / "index.html")
```

This makes FastAPI serve both the API (`/api/*`) and the frontend (everything
else) from a single port. No separate Vite dev server needed in production.

### 4.2 — PyWebView launcher (`backend/pywebview_launcher.py`)

```python
import webview
import threading
import uvicorn
import socket

def find_free_port(start=8000, end=9000):
    """Find a free port to avoid conflicts."""
    for port in range(start, end):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError("No free port found")

def start_server(app, port):
    """Run uvicorn in a daemon thread."""
    config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning")
    server = uvicorn.Server(config)
    server.run()

def launch():
    """Start FastAPI + open PyWebView window."""
    from backend.main import app
    
    port = find_free_port()
    
    # Start uvicorn in background thread
    server_thread = threading.Thread(
        target=start_server,
        args=(app, port),
        daemon=True
    )
    server_thread.start()
    
    # Open PyWebView window
    window = webview.create_window(
        "Klangkurator",
        f"http://127.0.0.1:{port}",
        width=1400,
        height=900,
        min_size=(1000, 600),
        text_select=True,
    )
    
    webview.start(debug=True)  # debug=True for dev tools (F12)
```

### 4.3 — Update `backend/main.py` entry point

```python
import sys

def main():
    """Entry point: run as desktop app (PyWebView) or server-only."""
    if "--server" in sys.argv:
        # Server-only mode: uvicorn backend.main:app --port 8000
        import uvicorn
        uvicorn.run(app, host="127.0.0.1", port=8000)
    else:
        # Desktop mode: PyWebView + FastAPI
        from backend.pywebview_launcher import launch
        launch()

if __name__ == "__main__":
    main()
```

Usage:
- `python -m backend.main` → desktop app (PyWebView window)
- `python -m backend.main --server` → server only (for dev with `npm run dev`)
- `uvicorn backend.main:app --reload --port 8000` → same as `--server` but with hot reload

### 4.4 — Native folder picker

When running in PyWebView, use the native OS folder picker for library
scanning instead of a text input:

Add to `backend/api/library.py`:
```python
@router.post("/pick-folder")
async def pick_folder():
    """Use PyWebView's native file dialog to pick a folder.
    Only works when running inside PyWebView.
    """
    import webview
    if not webview.windows:
        raise HTTPException(400, "Not running in desktop mode")
    
    result = webview.windows[0].create_file_dialog(
        webview.FOLDER_DIALOG
    )
    if result:
        return {"path": result[0]}
    return {"path": None}
```

Frontend `LoadFiles.tsx`:
```typescript
const handlePickFolder = async () => {
  try {
    const result = await apiPost('/library/pick-folder');
    if (result.path) {
      setRootPath(result.path);
    }
  } catch {
    // Fallback: manual text input (browser mode)
  }
};
```

### 4.5 — Build frontend

```bash
cd dj-crate-explorer
npm run build
```

This creates `dist/` with the built React app. FastAPI serves it.

### 4.6 — Environment detection in frontend

Update `vite.config.ts` or `src/lib/api.ts` to detect mode:

```typescript
// In desktop mode (PyWebView), the API is on the same origin
// In dev mode, the API is on localhost:8000 (proxied by Vite)
const API_BASE = import.meta.env.DEV 
  ? '/api'  // Vite proxy handles it
  : '/api'; // Same origin in production (FastAPI serves both)
```

Actually, in both cases it's just `/api` — the Vite proxy handles dev,
and same-origin handles production. Simplify:

```typescript
const API_BASE = '/api';
```

Remove `VITE_API_BASE` env var — not needed.

### 4.7 — Clean shutdown

```python
def launch():
    ...
    def on_closing():
        # Stop uvicorn server
        server.should_exit = True
    
    window.events.closing += on_closing
    webview.start()
```

### 4.8 — `.gitignore` updates

```
# Python
backend/__pycache__/
*.pyc
__pycache__/

# Build
dist/

# Data (never commit user data)
*.json
!docs/**/*.json
```

## Deliverable

```bash
cd dj-crate-explorer
npm run build                    # Build frontend
/home/tim/Vault/.venv/bin/python -m backend.main    # Launch desktop app
```

- A desktop window opens showing the Klangkurator app
- "Load Files" → click "Pick Folder" → native folder dialog → select music folder
- Scan runs, tracks appear in library with real metadata
- All CRUD operations work and persist to `~/.klangkurator/`
- Close the window → app shuts down cleanly

Also works in dev mode:
```bash
# Terminal 1
/home/tim/Vault/.venv/bin/uvicorn backend.main:app --reload --port 8000

# Terminal 2
npm run dev
# Open http://localhost:5173
```

## Key Decisions

- **FastAPI serves both API and frontend** from one port. No separate
  static file server needed. The built React app lives in `dist/` and
  FastAPI mounts it.
- **Random port for desktop**: avoids conflicts if port 8000 is already
  in use. The frontend doesn't care — it uses relative `/api` paths.
- **`--server` flag**: allows running just the backend for development
  with `npm run dev` (Vite hot reload). The desktop mode is for daily use.
- **PyWebView with `debug=True`**: opens DevTools (F12) for debugging.
  Can set to `False` for production later.
- **No PyInstaller yet**: the app runs via `python -m backend.main`.
  PyInstaller packaging (standalone executable) is a polish item.

## Risks

- **PyWebView GUI backend**: on Linux, PyWebView needs Qt or GTK. The
  ThinkPad has Qt (Smartimize uses `gui='qt'`). Verify `pywebview` works
  with `webview.start(gui='qt')` on the ThinkPad.
- **Port detection race**: the free port check + uvicorn bind could race.
  Use `daemon=True` and a small delay before opening the window.
  Alternatively, have uvicorn signal when it's ready (check `/api/health`
  in a loop before opening the window).