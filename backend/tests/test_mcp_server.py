"""The MCP server's tool surface and its guards (REQ-34-TS, -CT; issue #47).

The server is a thin HTTP client, so these tests point it at the app through a
TestClient transport seam and exercise the tools in-process. What is under test
is the tool layer: the curated list, the annotations, the slim projection, the
two gates (read-only, roots) and the error shapes.
"""

import json
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

pytest.importorskip("mcp", reason="the MCP server is optional for the app")

from mcp.server.mcpserver.exceptions import ToolError  # noqa: E402

from backend.main import app  # noqa: E402
from backend.storage import get_library_store  # noqa: E402
from mcp_server import client as mcp_client  # noqa: E402
from mcp_server import config, tools  # noqa: E402

app_client = TestClient(app)

READ_TOOLS = {
    "list_crates", "search_tracks", "get_track", "scan_status", "get_library_root",
    "analyze_status", "list_tags", "list_playlists", "list_relationships", "get_transitions",
}
WRITE_TOOLS = {
    "update_track", "scan_library", "set_library_root", "analyze_all", "analyze_track",
    "scan_artwork", "create_tag", "tag_track", "untag_track", "create_playlist",
    "playlist_add", "playlist_remove", "link_tracks", "export_library",
}


class _AppTransport:
    """An httpx2 transport that hands every request to the app's TestClient."""

    def __enter__(self):
        """httpx2 opens and closes its transport; this one holds no socket."""
        return self

    def __exit__(self, *exc_info):
        """Nothing to release."""
        return False

    def handle_request(self, request):
        """Forward one httpx2 request to the TestClient and wrap its answer."""
        import httpx2

        response = app_client.request(
            request.method,
            request.url.raw_path.decode(),
            content=request.content,
            headers={"content-type": request.headers.get("content-type", "application/json")},
        )
        return httpx2.Response(
            response.status_code,
            content=response.content,
            headers=dict(response.headers),
            request=request,
        )


@pytest.fixture(autouse=True)
def _through_the_app(monkeypatch):
    """Point the MCP client at the in-process app, and reset its env."""
    monkeypatch.setattr(config, "TRANSPORT", _AppTransport(), raising=False)
    monkeypatch.delenv("KLANGKURATOR_READ_ONLY", raising=False)
    monkeypatch.delenv("KLANGKURATOR_ROOTS", raising=False)
    monkeypatch.setenv("KLANGKURATOR_URL", "http://127.0.0.1:8000")
    client_mod = mcp_client
    original = client_mod._client

    def _client():
        """An httpx2 client carrying the test transport."""
        import httpx2

        return httpx2.Client(transport=_AppTransport(), timeout=5)

    monkeypatch.setattr(client_mod, "_client", _client)
    yield original


@pytest.fixture
def song() -> dict:
    """One song with a 200-float waveform."""
    res = app_client.post("/api/songs", json={
        "title": "Sequence",
        "artist": "Kobosil",
        "file_path": "/music/sequence.mp3",
        "bpm": 130.0,
        "waveform_peaks": [index / 200 for index in range(200)],
    })
    assert res.status_code == 201
    return res.json()


# ── The surface ─────────────────────────────────────────


def test_exactly_the_curated_tools_are_listed():
    """BC-6: 24 tools, nothing generated, nothing destructive."""
    import asyncio

    listed = asyncio.run(tools.server.list_tools())
    names = {tool.name for tool in listed}

    assert len(listed) == 24
    assert names == READ_TOOLS | WRITE_TOOLS
    assert not any(name.startswith("delete_") for name in names)


def test_every_tool_is_annotated():
    """BC-7: read tools read-only, writes non-destructive, all local."""
    import asyncio

    listed = asyncio.run(tools.server.list_tools())
    for tool in listed:
        annotations = tool.annotations
        assert annotations.open_world_hint is False, tool.name
        assert annotations.destructive_hint is False, tool.name
        assert annotations.read_only_hint is (tool.name in READ_TOOLS), tool.name


def test_no_resource_or_prompt_is_exposed():
    """BC-6: the surface is tools only."""
    import asyncio

    assert asyncio.run(tools.server.list_resources()) == []
    assert asyncio.run(tools.server.list_prompts()) == []


# ── Reading ─────────────────────────────────────────────


def test_list_crates_sums_to_the_track_total():
    """BC-8."""
    for index in range(3):
        app_client.post("/api/songs", json={
            "title": f"t{index}", "artist": "a",
            "file_path": f"/music/c{index}.mp3", "root_folder": "techno" if index < 2 else "house",
        })

    crates = tools.list_crates()

    assert sum(crate["track_count"] for crate in crates) == 3
    assert {crate["name"] for crate in crates} == {"techno", "house"}


def test_search_returns_slim_rows_and_pages_without_overlap():
    """BC-9: no peaks, `total >= returned`, and paging is disjoint."""
    for index in range(30):
        app_client.post("/api/songs", json={
            "title": f"t{index}", "artist": "a", "file_path": f"/music/t{index}.mp3",
            "bpm": 130.0, "waveform_peaks": [0.5] * 200,
        })

    first = tools.search_tracks(bpm_min=128, bpm_max=132, limit=10, offset=0)
    second = tools.search_tracks(bpm_min=128, bpm_max=132, limit=10, offset=10)

    assert first["total"] >= first["returned"] == 10
    assert first["offset"] == 0
    assert not any("waveform_peaks" in track for track in first["tracks"])
    assert {t["id"] for t in first["tracks"]}.isdisjoint({t["id"] for t in second["tracks"]})


def test_search_missing_bpm_excludes_the_bpm_bounds():
    """BC-10: the two filters are mutually exclusive."""
    with pytest.raises(ToolError, match="missing_bpm"):
        tools.search_tracks(missing_bpm=True, bpm_min=128)


def test_search_matches_the_table_on_crate_and_genre(song):
    """BC-10: the same fields the table filters on."""
    get_library_store().update_song(song["id"], {"root_folder": "techno", "mainGenre": "Techno"})

    assert [t["id"] for t in tools.search_tracks(crate="techno")["tracks"]] == [song["id"]]
    assert [t["id"] for t in tools.search_tracks(genre="Techno")["tracks"]] == [song["id"]]
    assert tools.search_tracks(crate="house")["total"] == 0


def test_only_get_track_carries_the_peaks(song):
    """BC-11."""
    assert len(tools.get_track(song["id"])["waveform_peaks"]) == 200
    assert "waveform_peaks" not in tools.search_tracks()["tracks"][0]
    assert "waveform_peaks" not in tools.update_track(song["id"], energy=3.5)


# ── Writing ─────────────────────────────────────────────


def test_update_track_changes_only_the_field_it_names(song):
    """BC-12: a partial update is partial, and a repeat is idempotent."""
    before = {k: v for k, v in song.items() if k != "updated_at"}

    updated = tools.update_track(song["id"], energy=3.5)
    again = tools.update_track(song["id"], energy=3.5)

    assert updated["energy"] == again["energy"] == 3.5
    after = app_client.get(f"/api/songs/{song['id']}").json()
    assert {k: v for k, v in after.items() if k not in ("energy", "updated_at")} == \
        {k: v for k, v in before.items() if k != "energy"}


def test_an_empty_update_is_refused_and_writes_nothing(song):
    """BC-13: the backend answers 200 for `PUT {}`, so the tool must refuse."""
    path = Path(os.environ["HOME"]) / ".klangkurator" / "library.json"
    before = path.stat().st_mtime_ns

    with pytest.raises(ToolError, match="at least one field"):
        tools.update_track(song["id"])

    assert path.stat().st_mtime_ns == before


def test_update_track_cannot_write_the_waveform(song):
    """The field is not an argument, so a caller cannot reach it at all."""
    import inspect

    assert "waveform_peaks" not in inspect.signature(tools.update_track).parameters


def test_tags_round_trip(song):
    """BC-14."""
    tag = tools.create_tag("peak time")
    assert tag["color"] and tag["id"]
    assert tag["id"] in {row["id"] for row in tools.list_tags()}

    tools.tag_track(song["id"], tag["id"])
    tools.tag_track(song["id"], tag["id"])
    assert tag["id"] in {row["id"] for row in app_client.get(f"/api/songs/{song['id']}/tags").json()}

    tools.untag_track(song["id"], tag["id"])
    with pytest.raises(ToolError, match="404"):
        tools.untag_track(song["id"], tag["id"])


def test_playlist_add_refuses_ids_the_api_would_accept(song):
    """BC-15: the API answers 201 for both."""
    playlist = tools.create_playlist("Sunset")

    with pytest.raises(ToolError, match="playlist"):
        tools.playlist_add("nope", song["id"])
    with pytest.raises(ToolError, match="track"):
        tools.playlist_add(playlist["id"], "nope")

    tools.playlist_add(playlist["id"], song["id"])
    listed = next(p for p in tools.list_playlists() if p["id"] == playlist["id"])
    assert [track["song_id"] for track in listed["tracks"]] == [song["id"]]

    tools.playlist_remove(playlist["id"], song["id"])
    with pytest.raises(ToolError, match="404"):
        tools.playlist_remove(playlist["id"], song["id"])


def test_link_tracks_validates_the_type(song):
    """BC-16: the API takes any string; the app knows eight."""
    other = app_client.post("/api/songs", json={
        "title": "Other", "artist": "a", "file_path": "/music/other.mp3",
    }).json()

    with pytest.raises(ToolError, match="Unknown relationship type"):
        tools.link_tracks(song["id"], other["id"], "vibes")

    link = tools.link_tracks(song["id"], other["id"], "transition", notes="key match")
    assert link["relationship_type"] == "transition"
    assert link["id"] in {row["id"] for row in tools.list_relationships(song_id=song["id"])}
    assert "waveform_peaks" not in tools.get_transitions(song["id"])[0]["song"]


def test_export_gives_a_summary_not_the_envelope(tmp_path):
    """BC-17: a summary in the context, the bytes on disk."""
    summary = tools.export_library()
    assert set(summary) == {"format", "version", "exported_at", "counts"}

    target = tmp_path / "backup.json"
    written = tools.export_library(str(target))
    assert written["bytes"] == target.stat().st_size
    assert json.loads(target.read_text())["format"] == summary["format"]


def test_export_refuses_a_path_inside_the_data_folder():
    """BC-17: the app owns that folder."""
    inside = Path(os.environ["HOME"]) / ".klangkurator" / "backup.json"

    with pytest.raises(ToolError, match="data folder"):
        tools.export_library(str(inside))


# ── The gates ───────────────────────────────────────────


def test_read_only_refuses_every_writing_tool(song, monkeypatch):
    """BC-20: 13 tools refused, reads still work, export still writes."""
    monkeypatch.setenv("KLANGKURATOR_READ_ONLY", "1")
    path = Path(os.environ["HOME"]) / ".klangkurator" / "library.json"
    before = path.stat().st_mtime_ns

    calls = {
        "update_track": lambda: tools.update_track(song["id"], energy=1),
        "create_tag": lambda: tools.create_tag("x"),
        "tag_track": lambda: tools.tag_track(song["id"], "t"),
        "untag_track": lambda: tools.untag_track(song["id"], "t"),
        "create_playlist": lambda: tools.create_playlist("x"),
        "playlist_add": lambda: tools.playlist_add("p", song["id"]),
        "playlist_remove": lambda: tools.playlist_remove("p", song["id"]),
        "link_tracks": lambda: tools.link_tracks("a", "b", "remix"),
        "scan_library": lambda: tools.scan_library("/tmp"),
        "set_library_root": lambda: tools.set_library_root("/tmp"),
        "analyze_all": lambda: tools.analyze_all(),
        "analyze_track": lambda: tools.analyze_track(song["id"]),
        "scan_artwork": lambda: tools.scan_artwork(),
    }
    for name, fn in calls.items():
        with pytest.raises(ToolError, match="KLANGKURATOR_READ_ONLY"):
            fn()

    assert path.stat().st_mtime_ns == before
    assert tools.list_tags() == []
    assert tools.export_library()["counts"]["songs"] == 1


def test_the_roots_allowlist_refuses_before_any_request(monkeypatch, tmp_path):
    """BC-21: with a dead URL the message is about roots, not the backend."""
    allowed = tmp_path / "music"
    allowed.mkdir()
    monkeypatch.setenv("KLANGKURATOR_ROOTS", str(allowed))
    monkeypatch.setenv("KLANGKURATOR_URL", "http://127.0.0.1:9/")

    with pytest.raises(ToolError, match="outside the folders"):
        tools.scan_library(str(tmp_path / "elsewhere"))
    with pytest.raises(ToolError, match="outside the folders"):
        tools.set_library_root("/etc")


def test_an_unreachable_backend_is_one_actionable_message(monkeypatch):
    """BC-22: the URL and ./run.sh, never a traceback."""
    monkeypatch.setenv("KLANGKURATOR_URL", "http://127.0.0.1:9/")
    monkeypatch.setattr(config, "TRANSPORT", None, raising=False)
    monkeypatch.setattr(mcp_client, "_client", _real_client)

    with pytest.raises(ToolError) as caught:
        tools.list_crates()

    message = str(caught.value)
    assert "http://127.0.0.1:9" in message
    assert "./run.sh" in message


def _real_client():
    """A real httpx2 client, for the unreachable-backend case."""
    import httpx2

    return httpx2.Client(timeout=1)


def test_a_backend_error_keeps_its_detail():
    """BC-23: the API's own detail, not a bare tool failure."""
    with pytest.raises(ToolError, match="404: Song not found"):
        tools.get_track("nope")


def test_the_app_runs_without_the_mcp_package():
    """BC-25: nothing under backend/ imports mcp."""
    backend_dir = Path(__file__).resolve().parents[1]
    offenders = [
        path for path in backend_dir.rglob("*.py")
        if path.name != Path(__file__).name
        and ("import mcp" in path.read_text() or "from mcp" in path.read_text())
    ]

    assert offenders == []
