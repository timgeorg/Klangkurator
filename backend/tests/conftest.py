"""Test isolation: every test session gets its own throwaway HOME.

The backend resolves its data directory (~/.klangkurator) when it is first
imported, so HOME is pointed at a temporary folder here, before any test
module imports `backend`. Tests never see the user's real library.
"""

import os
import tempfile

import pytest

_HOME = tempfile.mkdtemp(prefix="klangkurator-test-home-")
os.environ["HOME"] = _HOME


@pytest.fixture(autouse=True)
def _fresh_library_between_tests():
    """Store data is an in-process singleton; tests that add songs must not
    see each other's rows (issue #10 tests build their own small fixtures)."""
    yield
    from backend.storage import get_blocks_store, get_library_store, get_sets_store
    for store, keys in (
        (get_library_store(),
         ("songs", "tags", "song_tags", "relationships", "playlists",
          "playlist_songs")),
        (get_blocks_store(), ("blocks",)),
        (get_sets_store(), ("sets",)),
    ):
        for k in keys:
            store._data[k] = []
