# Technical plan — MCP server (issue #47)

Spec: `docs/requirements/34_MCP_SERVER.md` (REQ-34-PR, -TS, -CT, -AX) plus
`10_LIBRARY_AND_FILE_LOADING.md` REQ-10-SL and REQ-10-BW. Contract:
`MCP_SERVER_BEHAVIOR_CONTRACT.md`. Branch: `feature_47_mcp-server` from `int`.
Depends on #46 (the scan job).

## Verified facts (2026-10-23, `int` @ 6fe0642, venv `/home/tim/Vault/.venv`)

- **`mcp.server.mcpserver.MCPServer`, not FastMCP.** `import
  mcp.server.fastmcp` raises `ModuleNotFoundError` with a migration message
  (`site-packages/mcp/server/fastmcp.py:16`); `mcp` is 2.3.0. A **sync** tool
  runs via `anyio.to_thread.run_sync`
  (`mcp/server/mcpserver/utilities/func_metadata.py:163-164`), so blocking HTTP
  needs no `async` rewrite. `mcp --help` needs the `cli` extra, so `mcp dev` is
  no gate; a `ClientSession` over `stdio_client` is, and it lists and calls a
  bare `MCPServer` (probed). **Errors must be `ToolError`** — only that reaches
  the client verbatim (probed with `ValueError` and `httpx2.ConnectError`).
- **`httpx` is not an app dependency, `httpx2` is mcp's.** `httpx` 0.28.1 is
  installed but nothing in `requirements.txt` pulls it (`pip show` →
  Required-by `huggingface_hub, ollama`; fastapi wants it only under its
  `standard` extra). `mcp` 2.3.0 requires **`httpx2>=2.10.0`** (2.16.0
  installed) — a separate distribution with its own `Client` and error tree.
- **`slim` must project after validation.** `GET /api/songs` has a response
  model (`songs.py:12`) that fills defaults a legacy row lacks — 29 keys out of
  a 21-key stored row, gaining `rank: 0`, `phase_tags: []`, `vibe_tags: []`;
  raw dicts would drop `rank` from 1,907 rows. **The share is 62–71 % depending on the measurement, not a fixed 62 %**:
  3,735,141 B full / 1,110,193 B slim at 1,907 tracks, 1,187 B of peaks each
  (the issue's figure was a 499-track sample). 200 floats per row
  (`backend/scanner/waveform.py:4`); 27 crates, 107 tracks with a BPM.
- **`_CLEARABLE` + `exclude_unset` make a partial PUT safe; an *empty* PUT still
  writes.** `_CLEARABLE` is the 16 optional fields (`songs.py:49-51`); nulls on
  them clear, nulls on `title`/`artist`/`rank`/`subgenres` are dropped (`:58`);
  an omitted field is never touched (`:57`). But `PUT {}` answers 200, rewrites
  `library.json` and moves `updated_at` (verified) — the *tool* must refuse it.
- **Three backend gaps the tools must cover.** `POST /api/playlists/{id}/songs`
  answers 201 for `playlist_id: "nope"` and an unknown `song_id`
  (`library_store.py:231-243`); `relationship_type` is a plain `str`
  (`backend/models/relationship.py:9`) while the app knows eight
  (`src/lib/storage.ts:84`); browse stops at `$HOME` (`library.py:152,163-170`),
  so `/media/tim/Extreme SSD/#MUSIC` gives 403 under `HOME=/tmp/kk-sandbox`
  while `POST /scan` (`:31-34`) and `PUT /root` (`:213-218`) accept it.
- **Three shapes to copy, not invent.** `GET /api/library/scan-status` is 404
  today (:8011) and P1 mirrors `analyze-status` (`:253-262`, `:413-418`);
  `GET /api/export` is 3.4 MB and 654 ms (`misc.py:68-87`); the filter rules are
  the table's (`libraryTable.ts:110-134` — query over title/artist/`mainGenre`/
  `subgenres`/`genres`/`genre`/`musical_key`, crate via `crateOf`
  (`src/lib/trackFormat.ts:88-92`), genre as `mainGenre ∪ genres ∪ genre`, key
  exact, a BPM bound dropping null-BPM rows). The backend `search`
  (`songs.py:16-26`) covers another field set and would disagree.
- **`backend/` imports no `mcp`**; `import backend.main` succeeds with
  `sys.modules["mcp"] = None`, so REQ-34-PR's last clause already holds.
  Baseline: 52 tests pass.

## Decisions

1. **No `dry_run` on `scan_library`; it starts the job.** The acceptance line is
   `scan_library(root_path)` and P1 ships no count-only path. A preview would
   have to walk the tree in the MCP server, duplicating the extension list, the
   `rglob` pattern, the uppercase pass and the crate rule
   (`library.py:38-42,64-69`) — the second implementation the thin-client
   principle forbids, with a count the backend would not reproduce. The tool
   returns `{started, total}` at once and `scan_status` is the honest progress;
   a dry run needs a backend route counting through that same walk (follow-up).
2. **In this repo, as a top-level `mcp_server/` package — not in the app, not a
   separate distribution.** `import backend.main` must succeed with `mcp`
   uninstalled (AX-17), so nothing under `backend/` may import it; a separate
   distribution buys nothing, since it duplicates the tool table, drifts from
   the spec this changelog tracks, and has no publishing step here.
   `mcp_server/` sits beside `backend/`, never imports it, and runs as
   `python -m mcp_server`. `mcp>=2.3,<3` and `httpx2>=2.10` become
   `requirements.txt` entries seven and eight; tests skip without `mcp`.
3. **Keep the PUT; no PATCH route.** Measured: `PUT {"energy": 3.5}` leaves
   `bpm`, `album`, `rank`, `subgenres` and `waveform_peaks` untouched; a null on
   a non-clearable field is filtered out (`songs.py:58`); a null on a clearable
   one clears it, and the tool never sends one. A PATCH would be a second write
   path over the same store for no behavioural gain — the app inline-edits
   through this PUT too (`src/lib/storage.ts:393`). The tool's rule: **send only
   the arguments the caller set, omit every `None`, refuse an empty body.**

## Files in scope

Nothing outside this list. Paths are relative to the repo root.

- `backend/api/songs.py`, `backend/api/library.py`
- `backend/tests/`: `test_slim_listing.py`, `test_browse_sandbox.py`,
  `test_mcp_server.py`, `00_Index.md`
- `mcp_server/`: `__init__.py`, `__main__.py`, `config.py`, `client.py`,
  `tools.py`, `00_Index.md`
- `requirements.txt`, `README.md`
- `docs/requirements/`: `34_MCP_SERVER.md`, `10_LIBRARY_AND_FILE_LOADING.md`,
  `92_PLANNED_FEATURES.md`, `99_CHANGELOG.md`, `00_Index.md`
- `docs/plans/`: `MCP_SERVER_PLAN.md`, `MCP_SERVER_BEHAVIOR_CONTRACT.md`,
  `00_Index.md`

## Steps

1. **`slim` on `GET /api/songs`** (`songs.py:12-27`): a `slim: bool =
   Query(False)` parameter; when true, validate each row into `Song` and return
   `model_dump(by_alias=True, exclude={"waveform_peaks"})` via `JSONResponse` —
   validation first keeps the model defaults. The app's call
   (`src/lib/storage.ts:390`) keeps the default; no frontend change.
2. **Widen the browse sandbox** (`library.py:152-170`): allow home, the
   configured root (`get_config("root_path")`, resolved, when set) and anything
   inside either; `parent` is `null` at both boundaries. Other paths keep the
   403 and its message shape.
3. **Skeleton.** `config.py` (four env vars, `os.pathsep` split); `client.py`
   (`httpx2.Client`, one wrapper mapping `ConnectError`/`TimeoutException` to
   the `./run.sh` message and `HTTPStatusError` to `"<status>: <detail>"`, both
   `ToolError`); `tools.py` (the 24 functions plus the `MCPServer` instance);
   `__main__.py`.
4. **Two gates, both before any request.** *Roots:* `KLANGKURATOR_ROOTS` if set,
   else one lazy `GET /api/library/root`; a resolved target must equal or sit
   inside an allowed root. *Read-only:* one decorator on the 13 library-writing
   tools; `export_library` keeps its summary in read-only mode and refuses the file (#57). A
   gated tool stays **listed** and fails on call.
5. **The tools.** Thin functions: build params, call, project; every
   track-bearing result drops `waveform_peaks`. `search_tracks` fetches
   `slim=true` once, filters in-process with the table's rules, then pages;
   `missing_bpm` is `bpm is None` and excludes the BPM bounds. `update_track`
   sends only non-`None` arguments and refuses `{}`. `list_playlists` joins
   `/api/playlists` with `/api/playlist-songs`. `export_library` returns a
   summary, or writes the envelope to a new `.json` file in the export folder
   (`KLANGKURATOR_EXPORT_DIR`; #57 replaced "any path outside the data folder").
6. **Tests and docs.** Tests live in `backend/tests/`, so `conftest.py`'s
   throwaway `HOME` applies: `pytest.importorskip("mcp")`, tools driven through
   the `MCPServer` object, HTTP via a `transport=` seam in `client.py` pointed
   at a `TestClient` of the app. Docs (spec, contract, PF-85, changelog, both
   indexes, README) land in the same change as the code (AGENTS.md).

## Tests

- `test_slim_listing.py`: no `waveform_peaks` key on any slim row (not even
  null), same length and identical shared values as the full listing, a legacy
  row without `rank` still reporting `rank: 0`, ≥ 55 % smaller on a fixture with
  200-float peaks, the default listing still carrying peaks.
- `test_browse_sandbox.py`: home, the root (`parent: null`) and a child of the
  root → 200; `/etc` and a sibling outside both → 403; no root → home only.
- `test_mcp_server.py`: the 24 names and annotations (10 read-only; 14 write
  with `destructive_hint is False`; all `open_world_hint is False`);
  `search_tracks` paging, BPM bounds, `missing_bpm`; peaks only from
  `get_track`; `update_track({})` raises with the mtime unchanged; read-only
  blocks the 13 and leaves `export_library` working; an unreachable URL raises
  the `./run.sh` message; a roots miss raises before any request (dead port →
  the roots message); `playlist_add` refuses an unknown playlist or song;
  `link_tracks` refuses an unknown type; `create_tag` defaults the colour.

## Gates

`python -m pytest backend/tests` · `python -c "import backend.main"` with `mcp`
unavailable · a stdio handshake listing 24 tools with the backend stopped, and
again against the sandbox (`HOME=/tmp/kk-sandbox`, :8011) · full vs slim sizes
there (≥ 55 %) · `browse` at the root and at `/etc` · `npx tsc --noEmit -p
tsconfig.app.json` and `npx vite build` (frontend unchanged, no new errors).

## Merge order

#46 rewrites `backend/api/library.py` (scan handler, job state) and adds
`test_scan_job.py`; this branch touches that file for the browse sandbox only,
plus `songs.py` for `slim`. #48/#49 are frontend plus the song model — no
overlap. Land #46 first; rebase on `int`, re-run the scan checks against the
job-based handler, and confirm the field names P1 shipped before `scan_status`
and `scan_library` are written.

## PR

Into `int`, titled for #47, body naming the contract clauses checked and the
three decisions. No `Closes` keyword (the issue closes at the `int` → `main`
release).
