# Behavior contract — MCP server (issue #47)

Written **before** implementation (Feature-Development-Playbook: user-facing
behavior change → behavior contract, judged source-blind by the Validator).
Spec: `docs/requirements/34_MCP_SERVER.md` (REQ-34-PR, -TS, -CT, -AX). Run
against the sandbox library (`HOME=/tmp/kk-sandbox`, backend on :8001), never
the real one. Two instruments: `curl` for the prerequisites, an MCP client over
stdio for the server. For each clause, record the command and the observed
result.

## Prerequisites

### BC-1 — a scan starts at once
**When** I `POST /api/library/scan` with the configured root **then** it answers
within 1 s with `{"started": true, "total": N}`, and a second immediate `POST`
answers 409 naming the running job.

### BC-2 — the scan is observable
**Given** a scan started **when** I poll `GET /api/library/scan-status`
**then** `done` rises monotonically to `total == N` while `running` is true, and
the last status has `running: false` with `result.added + result.skipped == N`.

### BC-3 — slim listings
**When** I compare `GET /api/songs` with `GET /api/songs?slim=true` on the same
library **then** the slim body is at least 55 % smaller, both have the same
`len()`, every shared field is identical value for value, and **no** slim row
contains a `waveform_peaks` key (not even null).

### BC-4 — browse reaches the music
**Given** a configured root **when** I browse the root and any of its children
**then** each answers 200 and lists its subfolders. `?path=/etc` → 403, and any
other path outside both the home folder and the root → 403 with the same
message shape as today. At the root and at `$HOME`, `parent` is `null`.

### BC-5 — the app is unchanged
**When** I run `python -m pytest backend/tests` **then** it passes without edits
to existing test files, and `GET /api/songs` without `slim` still returns
`waveform_peaks`.

## The tool surface

### BC-6 — exactly the curated list
**Given** the server launched over stdio **when** a client lists its tools
**then** there are exactly 24, with the names in the spec's table, and none
starts with `delete_`. No resource, prompt or generated endpoint appears.

### BC-7 — the tools are annotated
**When** I list the tools **then** each of the 10 read tools carries
`readOnlyHint: true`, and each of the other 14 carries `readOnlyHint: false`
**and** `destructiveHint: false`; all 24 carry `openWorldHint: false`.

### BC-8 — crates
**When** I call `list_crates` **then** it returns one entry per crate with
`{name, track_count}`, and the counts sum to the library's track total.

### BC-9 — search paging and projection
**When** I call `search_tracks(bpm_min=128, bpm_max=132, limit=5)` **then** at
most 5 tracks come back, every one has a BPM inside the range, `total` is at
least `returned`, `offset` echoes what I sent, and no row contains a
`waveform_peaks` key.
**When** I call it twice with `offset=0` and `offset=25` at the same filters
**then** the two sets of ids are disjoint and together they are in the same
order as the unpaged list.

### BC-10 — the filters match the table
**Given** a crate, a genre and a key that exist **when** I filter by each
**then** every returned track matches on that field, and a track the app's
table keeps is not dropped. `missing_bpm=true` returns only tracks whose `bpm`
is null or absent, and combining it with `bpm_min`/`bpm_max` is refused.

### BC-11 — only one tool carries peaks
**When** I call `get_track(<id>)` **then** `waveform_peaks` is a list of 200
numbers. No other tool's output contains that key.

### BC-12 — a partial update changes one field
**Given** a track **when** I call `update_track(<id>, energy=3.5)` **then**
`energy` reads 3.5 afterwards and every other field — `title`, `artist`, `bpm`,
`album`, `rank`, `subgenres`, `waveform_peaks` — is what it was before; only
`updated_at` moved. **When** I call it a second time with the same value
**then** the result is the same and nothing else changes.

### BC-13 — an empty update is refused
**When** I call `update_track(<id>)` with no fields **then** it fails with a
message saying at least one field is needed and `library.json`'s modification
time is unchanged.

### BC-14 — tags
**When** I call `create_tag("peak time")` without a colour **then** a tag comes
back with a colour and an id, and `list_tags` contains it. **When** I then call
`tag_track(song, tag)` **then** `curl GET /api/songs/<id>/tags` (the surface has
no per-song read, so the API is the witness) lists it, a second identical
`tag_track` does not fail, `untag_track` removes it, and `untag_track` again
fails with a message naming the missing association.

### BC-15 — playlists refuse rubbish
**When** I call `playlist_add` with an unknown playlist id or an unknown song
id **then** it fails and `list_playlists` is unchanged (the API alone answers
201 for both). A valid call appends, and `playlist_remove` removes;
`playlist_remove` again fails.

### BC-16 — relationships
**When** I call `link_tracks(A, B, "transition")` **then** the relationship
comes back and `list_relationships(song_id=A)` contains it, and
`get_transitions(A)` lists B with its notes and slim song rows. **When** the
type is not one of the eight the app knows **then** it is refused.

### BC-17 — export stays out of the context
**When** I call `export_library()` without a path **then** the answer is a
summary (format, version, `exported_at`, counts) and **not** the envelope.
**When** I give a new `.json` file name **then** the file is created inside the
export folder (`KLANGKURATOR_EXPORT_DIR`, default `~/klangkurator-exports`), it
parses as the envelope, and the answer names the path and the byte size. A path
outside that folder, a name that is not `.json`, and an existing file are
refused, and an existing file is left as it was (issue #57).

### BC-18 — the scan tools
**When** I call `scan_library(root_path=<the configured root>)` **then** it
answers with `{started, total}` and `scan_status` then shows the same `total`.
`get_library_root` returns the configured path; `set_library_root` on a real
folder changes it and is visible in `get_library_root`.

### BC-19 — analysis tools
**When** I call `analyze_all` **then** it answers `{started, total}` and
`analyze_status` reports the same `total` with `done` climbing.
`analyze_track(<id>)` returns `bpm`, `musical_key`, `bpm_fit` and the `applied`
map, and `scan_artwork` returns `processed`, `extracted`, `skipped`, `errors`.

## The contract

### BC-20 — read-only mode
**Given** `KLANGKURATOR_READ_ONLY=1` **when** I call any of the 13 tools that
change the library (`update_track`, `create_tag`, `tag_track`, `untag_track`,
`create_playlist`, `playlist_add`, `playlist_remove`, `link_tracks`,
`scan_library`, `set_library_root`, `analyze_all`, `analyze_track`,
`scan_artwork`) **then** each fails with a message naming
`KLANGKURATOR_READ_ONLY` and `library.json`'s modification time is unchanged.
Reads and the `export_library` summary still work; writing the export file is
refused.

### BC-21 — the roots allowlist
**Given** an allowlist **when** I call `scan_library` or `set_library_root` with
a path outside it **then** it is refused, and the refusal comes **before** any
request: with `KLANGKURATOR_URL` pointed at a dead port the message is about the
allowed roots, not about the unreachable backend.

### BC-22 — an unreachable backend is one message
**Given** `KLANGKURATOR_URL=http://127.0.0.1:9/` **when** I call any tool
**then** it returns one message naming that URL and `./run.sh`; there is no
traceback and no wait beyond `KLANGKURATOR_TIMEOUT`.

### BC-23 — a backend error keeps its detail
**When** I call `get_track` with an unknown id **then** the failure names the
status and the API's own `detail` ("Song not found"), not a bare "Error
executing tool".

### BC-24 — it starts with the backend down
**Given** no backend listening **when** a client connects **then** the handshake
succeeds and all 24 tools are listed (startup does no I/O).

### BC-25 — the app runs without the package
**When** `mcp` cannot be imported **then** `python -c "import backend.main"`
still succeeds, and the MCP tests skip rather than fail.

### BC-26 — local only
**When** the server runs **then** it opens no listening socket: it is reachable
only through the stdio pipe its client created, and it needs no token,
certificate or CORS origin.

## Out of scope

Deleting anything from an agent · audio or artwork over MCP · remote access or
authentication · a second writer to `~/.klangkurator/` · a dry-run or count-only
scan · Rekordbox export · changing what a scan imports.
