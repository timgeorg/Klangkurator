"""The Klangkurator MCP server: the library, for a local agent (issue #47).

A thin HTTP client over the app's own API. It holds no state and writes no file
under ``~/.klangkurator/`` — two processes saving the same ``library.json``
would lose data, because ``BaseStore._save`` writes one shared ``.tmp`` file and
renames it. Every tool forwards to the running app.

The package is deliberately outside ``backend/``: the app must keep running
with ``mcp`` absent, so nothing under ``backend/`` may import this.
"""
