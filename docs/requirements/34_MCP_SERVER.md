# MCP Server

Status: Active
Last Updated: 2026-10-23
Source: issue #47 (Tim, 2026-10-23: *"Would you need MCP to better interact with
Klangkurator? What would MCP need for that tool?"*). Plan:
[`docs/plans/MCP_SERVER_PLAN.md`](../plans/MCP_SERVER_PLAN.md). Contract:
`MCP_SERVER_BEHAVIOR_CONTRACT.md`.

A local agent (Claude Desktop, Copilot, Cursor, any MCP client) reads and edits
the library through a curated set of tools, without a second process writing
`~/.klangkurator/`.

## The thin-client principle (REQ-34-PR)

- The MCP server **holds no library state and opens no file under
  `~/.klangkurator/`**. Every tool forwards to the running backend over
  loopback HTTP; the backend stays the only writer.
- This is not stylistic. `BaseStore._save` writes one shared `.tmp` file and
  renames it (`backend/storage/base_store.py:34-41`); two processes doing that
  to the same library lose writes.
- **Curated, not generated.** 38 paths in `/openapi.json` is noise, and a
  generated surface would offer `DELETE /api/songs/{song_id}`. The 24 tools
  below are the whole surface; deletion is absent on purpose (a track or
  playlist should be removed in the app, where the user sees what is going).
- **Local only.** stdio transport, no listener, no auth, no CORS change
  (`backend/main.py:22-36`). The server is a local process, not a browser
  origin; NFR-1 stands.
- **Startup does no I/O.** The tool list is static; nothing is fetched at
  import, so the server starts and lists its tools with the backend stopped.
- **The app runs without it.** `backend/` never imports `mcp`. The server lives
  in its own top-level package (`mcp_server/`), and `python -c "import
  backend.main"` must succeed with the package uninstalled.

## Surface (REQ-34-TS)

| # | Tool | Forwards to | Arguments | Returns |
|---|---|---|---|---|
| 1 | `list_crates` | `GET /api/library/crates` | — | `[{name, track_count}]` |
| 2 | `search_tracks` | `GET /api/songs?slim=true` | `query`, `crate`, `genre`, `key`, `bpm_min`, `bpm_max`, `missing_bpm`, `limit=50`, `offset=0` | `{total, returned, offset, tracks}` |
| 3 | `get_track` | `GET /api/songs/{id}` | `song_id` | the full song, `waveform_peaks` included |
| 4 | `update_track` | `PUT /api/songs/{id}` | `song_id` + any writable field | the updated song, slim |
| 5 | `scan_library` | `POST /api/library/scan` | `root_path` | `{started, total}` |
| 6 | `scan_status` | `GET /api/library/scan-status` | — | the job state (REQ-10-SP) |
| 7 | `get_library_root` | `GET /api/library/root` | — | `{root_path}` |
| 8 | `set_library_root` | `PUT /api/library/root` | `root_path` | `{root_path}` |
| 9 | `analyze_all` | `POST /api/library/analyze-all` | — | `{started, total}` |
| 10 | `analyze_status` | `GET /api/library/analyze-status` | — | the job state (REQ-10-AP) |
| 11 | `analyze_track` | `POST /api/library/analyze/{id}` | `song_id`, `bpm_min`, `bpm_max` | `{song_id, bpm, musical_key, duration, bpm_fit, applied}` |
| 12 | `scan_artwork` | `POST /api/library/scan-artwork` | — | `{processed, extracted, skipped, errors}` |
| 13 | `list_tags` | `GET /api/tags` | — | `[{id, name, color}]` |
| 14 | `create_tag` | `POST /api/tags` | `name`, `color` | the tag |
| 15 | `tag_track` | `POST /api/songs/{id}/tags` | `song_id`, `tag_id` | `{status: "ok"}` |
| 16 | `untag_track` | `DELETE /api/songs/{id}/tags/{tag_id}` | `song_id`, `tag_id` | `{status: "ok"}` |
| 17 | `list_playlists` | `GET /api/playlists` + `GET /api/playlist-songs` | — | playlists, each with `tracks: [{song_id, position}]` |
| 18 | `create_playlist` | `POST /api/playlists` | `name`, `color`, `description` | the playlist |
| 19 | `playlist_add` | `POST /api/playlists/{id}/songs` | `playlist_id`, `song_id`, `position` | `{playlist_id, song_id, position}` |
| 20 | `playlist_remove` | `DELETE /api/playlists/{id}/songs/{song_id}` | `playlist_id`, `song_id` | `{status: "ok"}` |
| 21 | `list_relationships` | `GET /api/relationships` | `song_id` (optional) | relationship rows |
| 22 | `link_tracks` | `POST /api/relationships` | `source_song_id`, `target_song_id`, `relationship_type`, `notes` | the relationship |
| 23 | `get_transitions` | `GET /api/songs/{id}/transition-suggestions` | `song_id` | `[{song, notes}]`, songs slim |
| 24 | `export_library` | `GET /api/export` | `output_path` (optional) | a summary, or `{path, bytes, counts}` |

Rules that belong to the tool layer, not the backend:

- **`slim` projection.** Every track-bearing result drops `waveform_peaks`
  (REQ-10-SL) except `get_track`, the one tool that carries them. Measured on
  the 1,907-track library: 67.1 % smaller rows, 1.19 KB/track of peaks gone.
- **Filter semantics are the table's.** `search_tracks` filters in the server
  process over one slim listing, using the same rules as
  `src/components/dj/libraryTable.ts:110-134`: `query` matches title, artist,
  `mainGenre`, `subgenres`, `genres`, `genre`, `musical_key`; `crate` is the
  exact `root_folder` (the app's `crateOf`, `src/lib/trackFormat.ts:88-92`);
  `genre` matches `mainGenre` ∪ `genres` ∪ `genre`; `key` is exact. `bpm_min`/
  `bpm_max` and `missing_bpm` are mutually exclusive. The backend's own
  `search` parameter (`backend/api/songs.py:13-26`) is not used: it covers a
  different field set, so narrowing with it would drop rows the app keeps.
- **`update_track` sends only what the caller set.** `PUT` with
  `exclude_unset` plus `_CLEARABLE` (`backend/api/songs.py:49-62`) means an
  omitted field is untouched and a partial body cannot blank one. An argument
  left `None` is **not sent**, so the tool cannot clear a field at all — a
  caller who wants a field emptied does it in the app. An empty call is refused
  before any HTTP request (the backend answers 200 and rewrites `library.json`
  for an empty body — verified).
- **`playlist_add` checks first.** `POST /api/playlists/{id}/songs` accepts a
  nonexistent playlist and a nonexistent song (`201`):
  `library_store.add_playlist_song` (`:231-243`) validates nothing. The tool
  verifies the playlist and the song exist before writing.
- **`link_tracks` validates the type** against the eight the app knows
  (`src/lib/storage.ts:84`): remix, same_sample, cover, mashup, edit, bootleg,
  in_playlist, transition. The API takes any string.
- **`create_tag` defaults the colour** to `#A1A2B3` (the palette's
  `FALLBACK_COLOR`, `src/lib/palette.ts:38`). The app's name hash
  (`colorForName`, `:41-45`) is not ported; the user recolours in Settings.
- **`export_library` writes outside the library only.** Without `output_path`
  it returns format, version, `exported_at` and the entity counts, never the
  3.4 MB envelope. With a path it streams the envelope there and returns
  `{path, bytes, counts}`. A path inside `~/.klangkurator/` is refused.

## Contract (REQ-34-CT)

- **Transport.** stdio. Launch: `python -m mcp_server` from the app folder on
  the venv that runs the backend. It targets the `mcp` 2.x API —
  `mcp.server.mcpserver.MCPServer` — because `mcp.server.fastmcp` raises
  `ModuleNotFoundError` in 2.3.0 with a migration message. `requirements.txt`
  pins `mcp>=2.3,<3` and declares `httpx2>=2.10` (the HTTP client the server
  imports directly; it arrives transitively with `mcp`, which is not a
  contract).
- **Configuration** (read at import, no I/O):
  `KLANGKURATOR_URL` (default `http://127.0.0.1:8000`) ·
  `KLANGKURATOR_TIMEOUT` (default 30 s, per request) ·
  `KLANGKURATOR_READ_ONLY` (`1` refuses the 13 tools that change the library;
  unset or empty is off) ·
  `KLANGKURATOR_ROOTS` (`os.pathsep`-separated allowlist for `scan_library`
  and `set_library_root`; default: the configured root only, read once from
  `GET /api/library/root`).
- **Annotations.** All 24 tools carry `openWorldHint: false` — the domain is
  one local library. The 10 read tools carry `readOnlyHint: true`. The other
  14 carry `readOnlyHint: false` and, because `destructiveHint` defaults to
  **true** when omitted, an explicit `destructiveHint: false`. (13 of the 14
  change the library; `export_library` does not, which is why read-only mode
  gates the 13 and not it.)
  `idempotentHint: true` only where a repeat call leaves the same state:
  `update_track`, `tag_track` (a second insert is a no-op — 201 both times)
  and `set_library_root`. Not on `untag_track` (a second call is a 404), on
  `scan_library`/`analyze_all` (a second call while one runs is a 409), on
  `playlist_add`/`link_tracks`/`create_*` (they append a row) or on
  `export_library` (`exported_at` moves).
- **Errors.** One `ToolError` per failure, never a bare raise — a bare
  exception reaches the client as "Error executing tool <name>" with no
  detail. An unreachable backend is one message naming the URL and `./run.sh`.
  An HTTP 4xx/5xx carries the status and the API's own `detail`.
- **Read-only mode.** With `KLANGKURATOR_READ_ONLY=1` the **13 tools that
  change the library** fail before any HTTP request; reads still work.
  `export_library` stays available: it never writes `~/.klangkurator/`, and a
  read-only session being unable to back the library up would be the opposite
  of safe. It still refuses an `output_path` inside the data directory.
- **Roots allowlist.** `scan_library` and `set_library_root` resolve the path,
  compare it against the allowlist, and refuse a path outside it **before**
  making any request. The allowlist default is the configured root, so a
  fresh install can scan its own root and nothing else.
- **The widened browse sandbox** (REQ-10-BW) exists so an agent can see the
  folders it may scan: `GET /api/library/browse` allows `$HOME` **and** the
  configured root, and reports `parent: null` at either boundary.

## Acceptance (REQ-34-AX)

Checked by a reviewer with `curl` and an MCP client, without reading the diff:

| # | Observable |
|---|---|
| AX-1 | `POST /api/library/scan` answers within 1 s with `{started: true, total: N}`; a second immediate `POST` → 409 (#46) |
| AX-2 | `GET /api/library/scan-status` climbs to `total == N`, then `running: false` with `result.added + result.skipped == N` |
| AX-3 | `GET /api/songs?slim=true` is ≥ 55 % smaller than `GET /api/songs`, same `len()`, and no row carries a `waveform_peaks` key |
| AX-4 | `GET /api/library/browse?path=<configured root>` → 200 listing the crates; `?path=/etc` → 403; any other path outside home and root → 403 |
| AX-5 | `python -m pytest backend/tests` passes with no existing test edited |
| AX-6 | A client over stdio lists exactly the 24 tools above: no `delete_*`, no generated extras |
| AX-7 | `list_crates` returns one entry per crate and the counts sum to the track total (27 today) |
| AX-8 | `search_tracks(bpm_min=128, bpm_max=132, limit=5)` returns ≤ 5 tracks, all in range, `total ≥ returned`, no `waveform_peaks` key on any row |
| AX-9 | `search_tracks(offset=25, limit=25)` is disjoint from `offset=0, limit=25` for the same filters |
| AX-10 | `get_track(<id>)` returns `waveform_peaks`: a list of 200 floats |
| AX-11 | `update_track(<id>, energy=3.5)` changes only `energy` and `updated_at`; a second call leaves the same values |
| AX-12 | `update_track(<id>)` with no fields is refused with a clear message and writes nothing |
| AX-13 | `KLANGKURATOR_READ_ONLY=1` makes each of the 13 library-writing tools fail with `library.json`'s mtime unchanged; reads and `export_library` still work |
| AX-14 | `KLANGKURATOR_URL=http://127.0.0.1:9/` → every tool returns one message naming the URL and `./run.sh`, no traceback, no hang past the timeout |
| AX-15 | With the backend stopped the server still starts and lists its 24 tools |
| AX-16 | `scan_library(<path outside the allowlist>)` is refused and no request is made (proved by pointing `KLANGKURATOR_URL` at a dead port and getting the roots message, not the unreachable one) |
| AX-17 | `python -c "import backend.main"` succeeds with `mcp` unavailable |

Four lines are restated because the issue's wording cannot be met as written:
`mcp dev` needs the `cli` extra (not installed), so a `ClientSession` is the
instrument; `updated_at` *does* move on every update (`library_store.py:61`), so
AX-11 reads "only `energy` and `updated_at`"; an empty `PUT` is accepted and
writes, so AX-12 is the tool's refusal, not the API's; and the library has 27
crates, not the 25 the issue counted. AX-3 and AX-13 name the exact projection
and the exact tool set instead of "55 %" and "every write tool".

## Out of scope

Deleting tracks, playlists, tags or relationships from an agent · serving audio
or artwork over MCP (the player stays in the app) · any remote or multi-user
access, any authentication · a second process writing `~/.klangkurator/` ·
Rekordbox export (`30_REKORDBOX_INTEGRATION.md` unchanged) · changing what a
scan imports or how crates are named · a dry-run scan (see the plan's
Decisions: an honest preview needs a backend count-only path).
