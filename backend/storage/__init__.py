"""Store initialization — singleton stores backed by JSON files."""

from backend.config import ensure_data_dir, LIBRARY_FILE, BLOCKS_FILE, SETS_FILE
from backend.storage.base_store import BaseStore
from backend.storage.library_store import LibraryStore
from backend.storage.blocks_store import BlocksStore
from backend.storage.sets_store import SetsStore

_library_store: LibraryStore | None = None
_blocks_store: BlocksStore | None = None
_sets_store: SetsStore | None = None


def get_library_store() -> LibraryStore:
    global _library_store
    if _library_store is None:
        ensure_data_dir()
        base = BaseStore(LIBRARY_FILE)
        _library_store = LibraryStore(base)
    return _library_store


def get_blocks_store() -> BlocksStore:
    global _blocks_store
    if _blocks_store is None:
        ensure_data_dir()
        base = BaseStore(BLOCKS_FILE)
        _blocks_store = BlocksStore(base)
    return _blocks_store


def get_sets_store() -> SetsStore:
    global _sets_store
    if _sets_store is None:
        ensure_data_dir()
        base = BaseStore(SETS_FILE)
        _sets_store = SetsStore(base)
    return _sets_store
