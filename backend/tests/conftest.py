"""Test isolation: every test session gets its own throwaway HOME.

The backend resolves its data directory (~/.klangkurator) when it is first
imported, so HOME is pointed at a temporary folder here, before any test
module imports `backend`. Tests never see the user's real library.
"""

import os
import tempfile

_HOME = tempfile.mkdtemp(prefix="klangkurator-test-home-")
os.environ["HOME"] = _HOME
