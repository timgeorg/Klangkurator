"""Klangkurator FastAPI backend."""

import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.config import ensure_data_dir, FRONTEND_DIST
from backend.api import router as api_router

ensure_data_dir()

app = FastAPI(
    title="Klangkurator",
    version="0.1.0",
    description="DJ music organization and set planning tool",
)

# CORS: local-only app. Scope to localhost origins (dev server + served UI).
# A wildcard with credentials would let any website probe files the player
# endpoint can serve — see the audio endpoint's trust boundary notes.
_LOCALHOST_ORIGINS = [
    "http://localhost:8080", "http://127.0.0.1:8080",  # Vite dev server
    "http://localhost:8000", "http://127.0.0.1:8000",  # served UI
    "http://localhost:4173", "http://127.0.0.1:4173",  # vite preview
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_LOCALHOST_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.1.0"}


# ── Static file serving (production / desktop mode) ──────
# When the frontend is built (npm run build → dist/), FastAPI serves
# both the API and the static files from a single port.

_assets_dir = FRONTEND_DIST / "assets"
if _assets_dir.exists():
    app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")

if FRONTEND_DIST.exists() and (FRONTEND_DIST / "index.html").exists():
    _index_file = FRONTEND_DIST / "index.html"

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        """SPA fallback: all non-API routes serve index.html."""
        if full_path.startswith("api/"):
            raise HTTPException(404, detail="API endpoint not found")

        # Try to serve a real file from dist/
        candidate = FRONTEND_DIST / full_path
        if candidate.is_file():
            return FileResponse(candidate)

        # Fallback to index.html for client-side routing
        return FileResponse(_index_file)
