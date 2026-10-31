"""Test isolation: every test session gets its own throwaway HOME.

The backend resolves its data directory (~/.klangkurator) when it is first
imported, so HOME is pointed at a temporary folder here, before any test
module imports `backend`. Tests never see the user's real library.

The isolation is enforced, not just intended: `KLANGKURATOR_REQUIRE_HOME`
makes the store refuse to write outside this folder, so an import order that
resolved the real home fails loudly instead of writing the real library.
"""

import os
import tempfile

import pytest

_HOME = tempfile.mkdtemp(prefix="klangkurator-test-home-")
os.environ["HOME"] = _HOME
os.environ["KLANGKURATOR_REQUIRE_HOME"] = _HOME


@pytest.fixture(autouse=True)
def _fresh_library_between_tests():
    """Store data is an in-process singleton; tests that add songs must not
    see each other's rows (issue #10 tests build their own small fixtures)."""
    yield
    from backend.storage import get_blocks_store, get_library_store, get_sets_store
    for store, keys in (
        # `_config` holds the crate registry and the music locations (issue
        # #11), so it is state like the rows: a test that adds a location must
        # not leave it for the next one.
        (get_library_store(),
         ("songs", "tags", "song_tags", "relationships", "playlists",
          "playlist_songs", "genres")),
        (get_blocks_store(), ("blocks",)),
        (get_sets_store(), ("sets",)),
    ):
        for k in keys:
            store._data[k] = []
    # `_config` holds the crate registry and the music locations (issue #11),
    # so it is state like the rows: a test that adds a location must not leave
    # it for the next one. It is a dict, not a list.
    get_library_store()._data["_config"] = {}
