---
source: auto
tags:
  - index
---
# Index — mcp_server

- [[__init__.py]] — The package docstring: the thin-client rule (no state, no file under `~/.klangkurator/`) and why it sits outside `backend/` (the app must run with `mcp` absent).
- [[__main__.py]] — `python -m mcp_server`: runs the server on stdio, with no I/O at startup so a client can connect with the backend down.
- [[config.py]] — The five environment variables (`KLANGKURATOR_URL`, `_TIMEOUT`, `_READ_ONLY`, `_ROOTS`, `_EXPORT_DIR`), read when used, with no I/O.
- [[client.py]] — The one HTTP path every tool uses: `httpx2` with the configured timeout, `ToolError` on a 4xx/5xx carrying the API's `detail`, and one actionable message naming the URL and `./run.sh` when the backend is down.
- [[tools.py]] — The curated 24-tool surface: library reads and search with the table's filter rules, one-field updates, the two import jobs and their statuses, per-track analysis and artwork backfill, tags, playlists, relationships and transitions, and a library export that stays out of the context; plus the read-only and roots gates.
