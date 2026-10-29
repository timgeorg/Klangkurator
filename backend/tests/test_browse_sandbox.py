"""The widened browse sandbox (REQ-10-BW, issue #47).

Browsing reached only `$HOME`, so a library on an external drive could be
scanned and set as the root but never picked in the browser's folder dialog.
The configured root is now a second boundary.
"""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.storage import get_library_store

client = TestClient(app)


@pytest.fixture
def music_root(tmp_path) -> Path:
    """A music folder outside home, set as the configured root."""
    root = tmp_path / "Extreme SSD" / "#MUSIC"
    (root / "techno").mkdir(parents=True)
    (root / "house").mkdir(parents=True)
    get_library_store().set_config("root_path", str(root))
    return root


def _browse(path: str | None = None) -> dict:
    """GET /browse and assert it succeeded."""
    res = client.get("/api/library/browse", params={"path": path} if path else None)
    assert res.status_code == 200, res.text
    return res.json()


def test_the_configured_root_is_browsable(music_root):
    """The folder the app already reads is reachable through the dialog."""
    body = _browse(str(music_root))

    assert body["path"] == str(music_root)
    assert {d["name"] for d in body["directories"]} == {"techno", "house"}


def test_a_child_of_the_root_is_browsable(music_root):
    """Walking down from the root works, which is how a crate gets picked."""
    body = _browse(str(music_root / "techno"))

    assert body["path"] == str(music_root / "techno")


def test_the_root_reports_no_parent(music_root):
    """`parent: null` marks the boundary, so the dialog's up arrow disappears."""
    assert _browse(str(music_root))["parent"] is None


def test_home_is_still_browsable(music_root):
    """The widening adds a boundary; it does not remove the old one."""
    home = Path.home().resolve()

    body = _browse(str(home))

    assert body["path"] == str(home)
    assert body["parent"] is None


def test_outside_both_boundaries_is_refused(music_root):
    """`/etc` is neither home nor the music folder."""
    res = client.get("/api/library/browse", params={"path": "/etc"})

    assert res.status_code == 403
    assert "Access denied" in res.json()["detail"]


def test_a_sibling_of_the_root_is_refused(music_root):
    """Only the root and what is inside it — not the drive it sits on."""
    sibling = music_root.parent / "other"

    res = client.get("/api/library/browse", params={"path": str(sibling)})

    assert res.status_code == 403


def test_without_a_configured_root_only_home_is_reachable(tmp_path):
    """A fresh install can browse home and nothing else."""
    outside = tmp_path / "elsewhere"
    outside.mkdir()
    get_library_store().set_config("root_path", None)

    assert client.get("/api/library/browse", params={"path": str(outside)}).status_code == 403
