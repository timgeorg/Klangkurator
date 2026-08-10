"""Sets store — wraps sets.json."""

import uuid
from datetime import datetime, timezone


def _new_id() -> str:
    return str(uuid.uuid4())


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class SetsStore:
    def __init__(self, base_store):
        self._data = base_store._data
        self._save_fn = base_store._save

        if "sets" not in self._data:
            self._data["sets"] = []

    def get_sets(self) -> list[dict]:
        return self._data["sets"]

    def get_set(self, set_id: str) -> dict | None:
        for s in self._data["sets"]:
            if s["id"] == set_id:
                return s
        return None

    def add_set(self, set_data: dict) -> dict:
        dj_set = {
            **set_data,
            "id": _new_id(),
            "created_at": _now(),
            "updated_at": _now(),
        }
        self._data["sets"].append(dj_set)
        self._save_fn()
        return dj_set

    def update_set(self, set_id: str, updates: dict) -> dict | None:
        for s in self._data["sets"]:
            if s["id"] == set_id:
                s.update(updates)
                s["updated_at"] = _now()
                self._save_fn()
                return s
        return None

    def delete_set(self, set_id: str) -> bool:
        before = len(self._data["sets"])
        self._data["sets"] = [s for s in self._data["sets"] if s["id"] != set_id]
        if len(self._data["sets"]) == before:
            return False
        self._save_fn()
        return True
