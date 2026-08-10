"""Blocks store — wraps blocks.json."""

import uuid
from datetime import datetime, timezone


def _new_id() -> str:
    return str(uuid.uuid4())


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class BlocksStore:
    def __init__(self, base_store):
        self._data = base_store._data
        self._save_fn = base_store._save

        if "blocks" not in self._data:
            self._data["blocks"] = []

    def get_blocks(self) -> list[dict]:
        return self._data["blocks"]

    def get_block(self, block_id: str) -> dict | None:
        for b in self._data["blocks"]:
            if b["id"] == block_id:
                return b
        return None

    def add_block(self, block_data: dict) -> dict:
        block = {
            **block_data,
            "id": _new_id(),
            "created_at": _now(),
            "updated_at": _now(),
        }
        self._data["blocks"].append(block)
        self._save_fn()
        return block

    def update_block(self, block_id: str, updates: dict) -> dict | None:
        for b in self._data["blocks"]:
            if b["id"] == block_id:
                b.update(updates)
                b["updated_at"] = _now()
                self._save_fn()
                return b
        return None

    def delete_block(self, block_id: str) -> bool:
        before = len(self._data["blocks"])
        self._data["blocks"] = [b for b in self._data["blocks"] if b["id"] != block_id]
        if len(self._data["blocks"]) == before:
            return False
        self._save_fn()
        return True
