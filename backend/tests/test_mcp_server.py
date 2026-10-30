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
    "list_crates", "search_tracks", "get_track", "scan_status",
    "list_music_locations", "analyze_status", "list_tags", "list_playlists",
    "list_relationships", "get_transitions",
}
WRITE_TOOLS = {
    "update_track", "scan_library", "add_music_location", "remove_music_location",
    "analyze_all", "analyze_track", "scan_artwork", "create_tag", "tag_track",
    "untag_track", "create_playlist", "playlist_add", "playlist_remove",
    "link_tracks", "export_library",
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
    monkeypatch.delenv("KLANGKURATOR_READ_ONLY", raising=False)
    monkeypatch.delenv("KLANGKURATOR_ROOTS", raising=False)
    monkeypatch.delenv("KLANGKURATOR_EXPORT_DIR", raising=False)
    monkeypatch.delenv("KLANGKURATOR_TIMEOUT", raising=False)
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
    """BC-6: the curated list, nothing generated, nothing destructive.

    25 tools since the music-location CRUD replaced the single root pair
    (issue #11): `list_music_locations`, `add_music_location` and
    `remove_music_location` in place of `get_library_root` and
    `set_library_root`.
    """
    import asyncio

    listed = asyncio.run(tools.server.list_tools())
    names = {tool.name for tool in listed}

    assert len(listed) == 25
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
            "file_path": f"/music/{'techno' if index < 2 else 'house'}/c{index}.mp3",
        })

    crates = tools.list_crates()

    assert sum(crate["track_count"] for crate in crates) == 3
    assert {crate["name"] for crate in crates} == {"techno", "house"}
    # Two crates, two ids: the id is what a filter takes (issue #11).
    assert len({crate["id"] for crate in crates}) == 2


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
    crate = _crate_of(song["file_path"].rsplit("/", 1)[0].rsplit("/", 1)[1])
    get_library_store().update_song(song["id"], {"crate_id": crate, "mainGenre": "Techno"})

    assert [t["id"] for t in tools.search_tracks(crate=crate)["tracks"]] == [song["id"]]
    assert [t["id"] for t in tools.search_tracks(genre="Techno")["tracks"]] == [song["id"]]
    assert tools.search_tracks(crate="no-such-crate")["total"] == 0


def _crate_of(name: str) -> str:
    """The registry id a hand-made row's folder resolves to.

    A row posted straight to the API carries no crate id, so the scan's own
    rule is applied once here, the way a scan would.
    """
    from backend.storage import crate_registry

    crate = {
        "id": crate_registry.crate_id("/music", name),
        "name": name,
        "location_path": "/music",
    }
    config = get_library_store()._data.setdefault("_config", {})
    crates = crate_registry.crate_lookup(config)
    crates[crate["id"]] = crate
    config[crate_registry.CRATE_KEY] = list(crates.values())
    config[crate_registry.LOCATION_KEY] = [{"id": "loc", "path": "/music"}]
    return crate["id"]


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


def test_export_gives_a_summary_not_the_envelope(tmp_path, monkeypatch):
    """BC-17: a summary in the context, the bytes in a new file in the export folder."""
    monkeypatch.setenv("KLANGKURATOR_EXPORT_DIR", str(tmp_path / "exports"))
    summary = tools.export_library()
    assert set(summary) == {"format", "version", "exported_at", "counts"}

    written = tools.export_library("backup.json")
    target = tmp_path / "exports" / "backup.json"
    assert written["path"] == str(target.resolve())
    assert written["bytes"] == target.stat().st_size
    assert json.loads(target.read_text())["format"] == summary["format"]


def test_export_refuses_a_folder_inside_the_data_folder(monkeypatch):
    """BC-17: the app owns that folder, so it cannot be the export folder."""
    monkeypatch.setenv("KLANGKURATOR_EXPORT_DIR", str(Path(os.environ["HOME"]) / ".klangkurator"))

    with pytest.raises(ToolError, match="data folder"):
        tools.export_library("backup.json")


def test_export_writes_only_new_json_files_inside_the_export_folder(tmp_path, monkeypatch):
    """An export never replaces a file and never leaves its folder."""
    monkeypatch.setenv("KLANGKURATOR_EXPORT_DIR", str(tmp_path / "exports"))
    victim = tmp_path / "victim" / ".bashrc"
    victim.parent.mkdir()
    victim.write_text("keep me")

    tools.export_library("first.json")
    first = (tmp_path / "exports" / "first.json").read_text()

    with pytest.raises(ToolError, match="already exists"):
        tools.export_library("first.json")
    assert (tmp_path / "exports" / "first.json").read_text() == first
    for outside in (str(victim), "../victim/.bashrc", "../escape.json"):
        with pytest.raises(ToolError, match="outside the export folder"):
            tools.export_library(outside)
    with pytest.raises(ToolError, match="not a .json"):
        tools.export_library("notes.txt")
    assert victim.read_text() == "keep me"
    assert not (tmp_path / "escape.json").exists()


# ── The gates ───────────────────────────────────────────


def test_read_only_refuses_every_writing_tool(song, monkeypatch):
    """BC-20: 13 tools and the export file refused; reads and the export summary work."""
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
        "add_music_location": lambda: tools.add_music_location("/tmp"),
        "remove_music_location": lambda: tools.remove_music_location("loc"),
        "analyze_all": lambda: tools.analyze_all(),
        "analyze_track": lambda: tools.analyze_track(song["id"]),
        "scan_artwork": lambda: tools.scan_artwork(),
        "export_library to a file": lambda: tools.export_library("backup.json"),
    }
    for name, fn in calls.items():
        with pytest.raises(ToolError, match="KLANGKURATOR_READ_ONLY"):
            fn()

    assert path.stat().st_mtime_ns == before
    assert tools.list_tags() == []
    assert tools.export_library()["counts"]["songs"] == 1


def test_the_roots_allowlist_refuses_before_any_request(monkeypatch, tmp_path):
    """BC-21: a folder outside the roots is refused without a single request."""
    allowed = tmp_path / "music"
    allowed.mkdir()
    monkeypatch.setenv("KLANGKURATOR_ROOTS", str(allowed))
    requests = []
    monkeypatch.setattr(mcp_client, "_client", _recording_client(requests, answer=None))

    with pytest.raises(ToolError, match="outside the folders"):
        tools.scan_library(str(tmp_path / "elsewhere"))
    with pytest.raises(ToolError, match="outside the folders"):
        tools.add_music_location("/etc")
    assert requests == []


def test_an_unreachable_backend_is_one_actionable_message(monkeypatch):
    """BC-22: the URL and ./run.sh, never a traceback."""
    monkeypatch.setenv("KLANGKURATOR_URL", "http://127.0.0.1:9/")
    monkeypatch.setattr(mcp_client, "_client", _real_client)

    with pytest.raises(ToolError) as caught:
        tools.list_crates()

    message = str(caught.value)
    assert "http://127.0.0.1:9" in message
    assert "./run.sh" in message


class _Scripted:
    """A transport that records requests and answers from a script.

    `answer` is None to fail the test on any request, an exception to raise, a
    response to return, or "app" to forward to the in-process app.
    """

    def __init__(self, requests, answer):
        """Keep the shared request log and the scripted answer."""
        self.requests = requests
        self.answer = answer

    def __enter__(self):
        """httpx2 opens and closes its transport; this one holds no socket."""
        return self

    def __exit__(self, *exc_info):
        """Nothing to release."""
        return False

    def handle_request(self, request):
        """Record the request, then answer as scripted."""
        self.requests.append((request.method, request.url.raw_path.decode(), request.content))
        if self.answer is None:
            raise AssertionError(f"unexpected request: {request.method} {request.url}")
        if isinstance(self.answer, BaseException):
            raise self.answer
        if self.answer == "app":
            return _AppTransport().handle_request(request)
        return self.answer


def _recording_client(requests, answer):
    """A `_client` replacement built on `_Scripted`."""
    import httpx2

    return lambda: httpx2.Client(transport=_Scripted(requests, answer), timeout=5)


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


def test_a_url_without_a_scheme_is_one_message(monkeypatch):
    """BC-22: a host:port pasted into KLANGKURATOR_URL must not raise bare."""
    monkeypatch.setenv("KLANGKURATOR_URL", "127.0.0.1:8000")
    monkeypatch.setattr(mcp_client, "_client", _real_client)

    with pytest.raises(ToolError, match="127.0.0.1:8000"):
        tools.list_crates()


def test_a_failed_export_names_the_path_and_leaves_no_file(tmp_path, monkeypatch):
    """BC-17: a backup that cannot be written must say so, never half-write."""
    folder = tmp_path / "exports"
    folder.mkdir()
    monkeypatch.setenv("KLANGKURATOR_EXPORT_DIR", str(folder))
    blocker = folder / "not-a-dir"
    blocker.write_text("a file, not a folder")

    with pytest.raises(ToolError, match="Could not write"):
        tools.export_library("not-a-dir/backup.json")
    assert blocker.read_text() == "a file, not a folder"
    assert sorted(p.name for p in folder.iterdir()) == ["not-a-dir"]


def test_playlist_remove_reports_ok():
    """The published shape is `{status: "ok"}`, not the route's empty body."""
    song = app_client.post("/api/songs", json={
        "title": "t", "artist": "a", "file_path": "/m/t.mp3",
    }).json()
    playlist = tools.create_playlist("P")
    tools.playlist_add(playlist["id"], song["id"])

    assert tools.playlist_remove(playlist["id"], song["id"]) == {"status": "ok"}


# ── Ids, values and errors (issue #57) ──────────────────


def test_ids_that_could_leave_their_route_are_refused(song):
    """An id like "../../<song-id>" once reached DELETE /api/songs/<id>."""
    for bad in (f"../../{song['id']}", "..", "x#", "a/b", "a?b=1", "%2e%2e", ""):
        with pytest.raises(ToolError, match="is not a"):
            tools.untag_track("x", bad)
        with pytest.raises(ToolError, match="is not a"):
            tools.get_track(bad)
        with pytest.raises(ToolError, match="is not a"):
            tools.playlist_remove(bad, song["id"])
    assert tools.get_track(song["id"])["id"] == song["id"]


def test_the_client_refuses_a_path_that_leaves_its_route():
    """The guard under every tool: no dot segments, no ? # % or backslash."""
    for path in ("/api/songs/../tags/x", "/api/songs/x#", "/api/songs/a?b", "/api/songs/%2e%2e"):
        with pytest.raises(ToolError, match="Refusing the API path"):
            mcp_client.call("DELETE", path)


def test_update_track_refuses_values_the_app_would_not_allow(song):
    """Blank names and out-of-range numbers are refused; nothing is written."""
    for fields in (
        {"title": ""}, {"artist": "  "}, {"energy": 99}, {"people": -7},
        {"rank": 9}, {"bpm": 0}, {"bpm": 9999},
    ):
        with pytest.raises(ToolError, match="Nothing was written"):
            tools.update_track(song["id"], **fields)
    stored = tools.get_track(song["id"])
    assert (stored["title"], stored["bpm"], stored["energy"]) == ("Sequence", 130.0, 0)
    assert tools.update_track(song["id"], people=4.5, bpm=128)["people"] == 4.5


def _wait_for_scan(timeout: float = 5.0) -> None:
    """Block until no scan runs."""
    import time

    deadline = time.monotonic() + timeout
    while app_client.get("/api/library/scan-status").json()["running"]:
        assert time.monotonic() < deadline, "the scan did not finish"
        time.sleep(0.02)


def test_scan_library_sends_the_folder_it_checked(monkeypatch, tmp_path):
    """A relative path is resolved once, here; the app receives that result."""
    allowed = tmp_path / "music"
    allowed.mkdir()
    monkeypatch.setenv("KLANGKURATOR_ROOTS", str(allowed))
    monkeypatch.chdir(tmp_path)
    requests = []
    monkeypatch.setattr(mcp_client, "_client", _recording_client(requests, answer="app"))

    assert tools.scan_library("music")["started"] is True
    _wait_for_scan()

    method, path, body = requests[-1]
    assert (method, path) == ("POST", "/api/library/scan")
    assert json.loads(body)["root_path"] == str(allowed.resolve())


def test_a_timeout_is_not_reported_as_unreachable(monkeypatch):
    """The app is up but slow: say so, not "start ./run.sh"."""
    import httpx2

    monkeypatch.setattr(mcp_client, "_client", _recording_client([], answer=httpx2.ReadTimeout("slow")))
    with pytest.raises(ToolError) as caught:
        tools.list_crates()
    assert "did not answer within" in str(caught.value)
    assert "./run.sh" not in str(caught.value)


def test_a_timeout_of_zero_or_less_falls_back_to_the_default(monkeypatch):
    """Zero would fail every request at once and read as an outage."""
    for raw in ("0", "-5", "abc", "inf", "nan"):
        monkeypatch.setenv("KLANGKURATOR_TIMEOUT", raw)
        assert config.timeout() == config.DEFAULT_TIMEOUT


def test_a_body_that_is_not_json_is_one_message(monkeypatch):
    """Something else answering on the port gets one clear message."""
    import httpx2

    html = httpx2.Response(200, content=b"<html>not the app</html>", headers={"content-type": "text/html"})
    monkeypatch.setattr(mcp_client, "_client", _recording_client([], answer=html))
    with pytest.raises(ToolError, match="is not JSON"):
        tools.list_crates()


def test_playlist_add_twice_keeps_one_row(song):
    """A retry is safe: the track is in the playlist once."""
    playlist = tools.create_playlist("P")
    tools.playlist_add(playlist["id"], song["id"])
    tools.playlist_add(playlist["id"], song["id"])

    rows = [
        row for row in app_client.get("/api/playlist-songs").json()
        if row["playlist_id"] == playlist["id"]
    ]
    assert [row["song_id"] for row in rows] == [song["id"]]


def test_search_filters_ignore_case_and_empty_values(song):
    """Crate, key and genre match in any case; an empty one is no filter."""
    tools.update_track(song["id"], musical_key="Am", main_genre="Techno")

    assert tools.search_tracks(crate=song.get("crate_id") or "MUSIC")["total"] == 1
    assert tools.search_tracks(key="am")["total"] == 1
    assert tools.search_tracks(genre="techno")["total"] == 1
    assert tools.search_tracks(crate="", genre="", key="")["total"] == 1


# ── Success paths of the root, scan and analysis tools ──


def test_the_location_tools_add_list_and_remove_a_folder(monkeypatch, tmp_path):
    """add_music_location registers; list_music_locations reads it back."""
    monkeypatch.setenv("KLANGKURATOR_ROOTS", str(tmp_path))

    added = tools.add_music_location(str(tmp_path))
    assert added["path"] == str(tmp_path.resolve())
    assert added["exists"] is True
    assert [loc["id"] for loc in tools.list_music_locations()] == [added["id"]]

    removed = tools.remove_music_location(added["id"])
    assert removed["songs_flagged"] == 0
    assert tools.list_music_locations() == []


def test_scan_tools_start_a_scan_and_report_it(monkeypatch, tmp_path):
    """scan_library starts the job; scan_status reports its end."""
    monkeypatch.setenv("KLANGKURATOR_ROOTS", str(tmp_path))

    assert tools.scan_library(str(tmp_path)) == {"started": True, "total": 0}
    _wait_for_scan()
    status = tools.scan_status()
    assert status["running"] is False
    assert {"done", "total", "result"} <= set(status)


def test_analysis_tools_run_and_report(monkeypatch, tmp_path):
    """analyze_all starts a real job and reports its end; analyze_track answers at once."""
    import time

    from backend.api import library as library_api
    from backend.scanner import audio_analysis

    audio = tmp_path / "a.wav"
    audio.write_bytes(b"")
    song_id = app_client.post(
        "/api/songs", json={"title": "A", "artist": "B", "file_path": str(audio)}
    ).json()["id"]
    detected = {"bpm": 128.0, "musical_key": "Am", "duration": 200.0}
    monkeypatch.setattr(audio_analysis, "analyze_track", lambda path, **kwargs: dict(detected))
    monkeypatch.setattr(library_api, "analyze_track", lambda path, **kwargs: dict(detected))

    assert tools.analyze_all() == {"started": True, "total": 1}
    deadline = time.monotonic() + 5
    while tools.analyze_status()["running"]:
        assert time.monotonic() < deadline, "the analysis did not finish"
        time.sleep(0.02)
    assert tools.analyze_status()["result"]["analyzed"] == 1

    one = tools.analyze_track(song_id)
    assert (one["song_id"], one["bpm"]) == (song_id, 128.0)


def test_scan_artwork_reports_its_counts(song):
    """scan_artwork answers with the four counts the app reports."""
    counts = tools.scan_artwork()
    assert {"processed", "extracted", "skipped", "errors"} <= set(counts)


# ── Round two of the review (issue #57) ─────────────────


def test_update_track_refuses_values_that_would_empty_a_field(song):
    """The tool never clears a field: no empty text or list, no 0 rating or rank."""
    for fields in (
        {"album": ""}, {"lyrics": "   "}, {"subgenres": []}, {"vibe_tags": []},
        {"energy": 0}, {"people": 0}, {"rank": 0},
    ):
        with pytest.raises(ToolError, match="Nothing was written"):
            tools.update_track(song["id"], **fields)


def test_export_refuses_a_file_inside_the_data_folder_from_a_wider_folder(monkeypatch):
    """With the export folder set to $HOME, `.klangkurator/…` is still the app's."""
    home = Path(os.environ["HOME"])
    monkeypatch.setenv("KLANGKURATOR_EXPORT_DIR", str(home))

    with pytest.raises(ToolError, match="data folder"):
        tools.export_library(".klangkurator/sets-copy.json")
    assert not (home / ".klangkurator" / "sets-copy.json").exists()


def test_export_refuses_a_symlink_that_leads_out(tmp_path, monkeypatch):
    """A link inside the export folder is followed before the check."""
    folder = tmp_path / "exports"
    folder.mkdir()
    outside = tmp_path / "outside"
    outside.mkdir()
    (folder / "link").symlink_to(outside, target_is_directory=True)
    monkeypatch.setenv("KLANGKURATOR_EXPORT_DIR", str(folder))

    with pytest.raises(ToolError, match="outside the export folder"):
        tools.export_library("link/x.json")
    assert list(outside.iterdir()) == []


def test_export_refuses_a_name_that_is_not_a_file_name(tmp_path, monkeypatch):
    """A NUL byte is one clear message, not a bare error."""
    monkeypatch.setenv("KLANGKURATOR_EXPORT_DIR", str(tmp_path / "exports"))

    with pytest.raises(ToolError, match="not a usable file name"):
        tools.export_library("bad\x00name.json")


def test_a_write_that_fails_part_way_removes_only_its_own_file(tmp_path, monkeypatch):
    """A half-written backup is removed; an older one beside it is untouched."""
    folder = tmp_path / "exports"
    folder.mkdir()
    (folder / "older.json").write_text("an older backup")
    monkeypatch.setenv("KLANGKURATOR_EXPORT_DIR", str(folder))
    real_open = open

    class _DiskFull:
        """A file handle whose write fails after the first few bytes."""

        def __init__(self, handle):
            self.handle = handle

        def __enter__(self):
            return self

        def __exit__(self, *exc_info):
            self.handle.close()
            return False

        def write(self, text):
            self.handle.write(text[:10])
            raise OSError(28, "No space left on device")

    monkeypatch.setattr(tools, "open", lambda *a, **k: _DiskFull(real_open(*a, **k)), raising=False)

    with pytest.raises(ToolError, match="Could not write"):
        tools.export_library("new.json")
    assert sorted(p.name for p in folder.iterdir()) == ["older.json"]
    assert (folder / "older.json").read_text() == "an older backup"


def test_update_track_refuses_a_year_or_duration_that_would_clear_it(song):
    """The app reads a 0 year or duration as missing, so 0 would clear it."""
    for fields in ({"year": 0}, {"duration": 0}, {"year": -1}):
        with pytest.raises(ToolError, match="must be above 0"):
            tools.update_track(song["id"], **fields)


def test_a_range_error_does_not_talk_about_emptying(song):
    """The emptying hint belongs to emptying, not to a value that is too high."""
    with pytest.raises(ToolError) as caught:
        tools.update_track(song["id"], energy=9)
    assert "empty" not in str(caught.value)


def test_an_unencodable_export_name_is_one_message(tmp_path, monkeypatch):
    """A lone surrogate cannot become a file name; it is refused, not raised bare."""
    monkeypatch.setenv("KLANGKURATOR_EXPORT_DIR", str(tmp_path / "exports"))

    with pytest.raises(ToolError, match="not a usable file name|Could not write"):
        tools.export_library("\ud800.json")


def test_a_huge_timeout_is_capped(monkeypatch):
    """1e10 s would overflow the socket layer; it is capped at a day."""
    monkeypatch.setenv("KLANGKURATOR_TIMEOUT", "1e10")
    assert config.timeout() == config.MAX_TIMEOUT
