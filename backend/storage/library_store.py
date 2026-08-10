"""Library store — wraps library.json (songs, tags, song_tags, relationships, playlists)."""

import uuid
from datetime import datetime, timezone


def _new_id() -> str:
    return str(uuid.uuid4())


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class LibraryStore:
    """CRUD for songs, tags, song_tags, relationships, playlists, playlist_songs.

    Data is kept in memory and written back to library.json on every mutation.
    """

    def __init__(self, base_store):
        self._file = base_store._file_path
        self._data = base_store._data
        self._save_fn = base_store._save

        # Ensure all top-level keys exist
        for key in ("songs", "tags", "song_tags", "relationships", "playlists", "playlist_songs"):
            if key not in self._data:
                self._data[key] = []

    # ── Songs ──────────────────────────────────────────────

    def get_songs(self) -> list[dict]:
        return self._data["songs"]

    def get_song(self, song_id: str) -> dict | None:
        for s in self._data["songs"]:
            if s["id"] == song_id:
                return s
        return None

    def add_song(self, song_data: dict) -> dict:
        song = {
            **song_data,
            "id": _new_id(),
            "created_at": _now(),
            "updated_at": _now(),
        }
        self._data["songs"].append(song)
        self._save_fn()
        return song

    def update_song(self, song_id: str, updates: dict) -> dict | None:
        for s in self._data["songs"]:
            if s["id"] == song_id:
                s.update(updates)
                s["updated_at"] = _now()
                self._save_fn()
                return s
        return None

    def delete_song(self, song_id: str) -> bool:
        before = len(self._data["songs"])
        self._data["songs"] = [s for s in self._data["songs"] if s["id"] != song_id]
        if len(self._data["songs"]) == before:
            return False

        # Cascade: remove song_tags, relationships, playlist_songs
        self._data["song_tags"] = [st for st in self._data["song_tags"] if st["song_id"] != song_id]
        self._data["relationships"] = [
            r for r in self._data["relationships"]
            if r["source_song_id"] != song_id and r["target_song_id"] != song_id
        ]
        self._data["playlist_songs"] = [ps for ps in self._data["playlist_songs"] if ps["song_id"] != song_id]
        self._save_fn()
        return True

    def find_song_by_path(self, file_path: str) -> dict | None:
        for s in self._data["songs"]:
            if s["file_path"] == file_path:
                return s
        return None

    def find_song_by_artist_title(self, artist: str, title: str) -> dict | None:
        for s in self._data["songs"]:
            if s["artist"] == artist and s["title"] == title:
                return s
        return None

    # ── Tags ───────────────────────────────────────────────

    def get_tags(self) -> list[dict]:
        return self._data["tags"]

    def get_tag(self, tag_id: str) -> dict | None:
        for t in self._data["tags"]:
            if t["id"] == tag_id:
                return t
        return None

    def add_tag(self, tag_data: dict) -> dict:
        tag = {
            **tag_data,
            "id": _new_id(),
            "created_at": _now(),
        }
        self._data["tags"].append(tag)
        self._save_fn()
        return tag

    def update_tag(self, tag_id: str, updates: dict) -> dict | None:
        for t in self._data["tags"]:
            if t["id"] == tag_id:
                t.update(updates)
                self._save_fn()
                return t
        return None

    def delete_tag(self, tag_id: str) -> bool:
        before = len(self._data["tags"])
        self._data["tags"] = [t for t in self._data["tags"] if t["id"] != tag_id]
        if len(self._data["tags"]) == before:
            return False
        # Cascade
        self._data["song_tags"] = [st for st in self._data["song_tags"] if st["tag_id"] != tag_id]
        self._save_fn()
        return True

    # ── Song-Tags ──────────────────────────────────────────

    def get_song_tags(self) -> list[dict]:
        return self._data["song_tags"]

    def add_song_tag(self, song_id: str, tag_id: str) -> None:
        # Avoid duplicates
        for st in self._data["song_tags"]:
            if st["song_id"] == song_id and st["tag_id"] == tag_id:
                return
        self._data["song_tags"].append({"song_id": song_id, "tag_id": tag_id})
        self._save_fn()

    def remove_song_tag(self, song_id: str, tag_id: str) -> bool:
        before = len(self._data["song_tags"])
        self._data["song_tags"] = [
            st for st in self._data["song_tags"]
            if not (st["song_id"] == song_id and st["tag_id"] == tag_id)
        ]
        if len(self._data["song_tags"]) == before:
            return False
        self._save_fn()
        return True

    # ── Relationships ──────────────────────────────────────

    def get_relationships(self) -> list[dict]:
        return self._data["relationships"]

    def add_relationship(self, rel_data: dict) -> dict:
        rel = {
            **rel_data,
            "id": _new_id(),
            "created_at": _now(),
        }
        self._data["relationships"].append(rel)
        self._save_fn()
        return rel

    def delete_relationship(self, rel_id: str) -> bool:
        before = len(self._data["relationships"])
        self._data["relationships"] = [r for r in self._data["relationships"] if r["id"] != rel_id]
        if len(self._data["relationships"]) == before:
            return False
        self._save_fn()
        return True

    def get_relationships_for_song(self, song_id: str) -> list[dict]:
        return [
            r for r in self._data["relationships"]
            if r["source_song_id"] == song_id or r["target_song_id"] == song_id
        ]

    # ── Playlists ──────────────────────────────────────────

    def get_playlists(self) -> list[dict]:
        return self._data["playlists"]

    def get_playlist(self, playlist_id: str) -> dict | None:
        for p in self._data["playlists"]:
            if p["id"] == playlist_id:
                return p
        return None

    def add_playlist(self, playlist_data: dict) -> dict:
        playlist = {
            **playlist_data,
            "id": _new_id(),
            "created_at": _now(),
            "updated_at": _now(),
        }
        self._data["playlists"].append(playlist)
        self._save_fn()
        return playlist

    def update_playlist(self, playlist_id: str, updates: dict) -> dict | None:
        for p in self._data["playlists"]:
            if p["id"] == playlist_id:
                p.update(updates)
                p["updated_at"] = _now()
                self._save_fn()
                return p
        return None

    def delete_playlist(self, playlist_id: str) -> bool:
        before = len(self._data["playlists"])
        self._data["playlists"] = [p for p in self._data["playlists"] if p["id"] != playlist_id]
        if len(self._data["playlists"]) == before:
            return False
        self._data["playlist_songs"] = [ps for ps in self._data["playlist_songs"] if ps["playlist_id"] != playlist_id]
        self._save_fn()
        return True

    # ── Playlist-Songs ─────────────────────────────────────

    def get_playlist_songs(self) -> list[dict]:
        return self._data["playlist_songs"]

    def add_playlist_song(self, playlist_id: str, song_id: str, position: int | None = None) -> dict:
        if position is None:
            # Append at end
            max_pos = max(
                (ps["position"] for ps in self._data["playlist_songs"] if ps["playlist_id"] == playlist_id),
                default=-1,
            )
            position = max_pos + 1
        ps = {"playlist_id": playlist_id, "song_id": song_id, "position": position}
        self._data["playlist_songs"].append(ps)
        self._save_fn()
        return ps

    def remove_playlist_song(self, playlist_id: str, song_id: str) -> bool:
        before = len(self._data["playlist_songs"])
        self._data["playlist_songs"] = [
            ps for ps in self._data["playlist_songs"]
            if not (ps["playlist_id"] == playlist_id and ps["song_id"] == song_id)
        ]
        if len(self._data["playlist_songs"]) == before:
            return False
        self._save_fn()
        return True

    # ── Queries ────────────────────────────────────────────

    def get_tags_for_song(self, song_id: str) -> list[dict]:
        tag_ids = {st["tag_id"] for st in self._data["song_tags"] if st["song_id"] == song_id}
        return [t for t in self._data["tags"] if t["id"] in tag_ids]

    def get_songs_for_tag(self, tag_id: str) -> list[dict]:
        song_ids = {st["song_id"] for st in self._data["song_tags"] if st["tag_id"] == tag_id}
        return [s for s in self._data["songs"] if s["id"] in song_ids]

    def get_related_songs(self, song_id: str) -> list[dict]:
        results = []
        for r in self._data["relationships"]:
            if r["source_song_id"] == song_id:
                target = self.get_song(r["target_song_id"])
                if target:
                    results.append({"song": target, "relationship": r, "direction": "source"})
            elif r["target_song_id"] == song_id:
                source = self.get_song(r["source_song_id"])
                if source:
                    results.append({"song": source, "relationship": r, "direction": "target"})
        return results

    def get_transition_suggestions(self, song_id: str) -> list[dict]:
        suggestions = []
        for r in self._data["relationships"]:
            if r["source_song_id"] == song_id and r["relationship_type"] == "transition":
                target = self.get_song(r["target_song_id"])
                if target:
                    suggestions.append({"song": target, "notes": r.get("notes")})
        return suggestions

    def get_playlists_for_song(self, song_id: str) -> list[dict]:
        results = []
        for ps in self._data["playlist_songs"]:
            if ps["song_id"] == song_id:
                playlist = self.get_playlist(ps["playlist_id"])
                if playlist:
                    results.append({"playlist": playlist, "position": ps["position"]})
        return results

    # ── Config ─────────────────────────────────────────────

    def get_config(self, key: str, default=None):
        """Read a config value from library.json."""
        config = self._data.get("_config", {})
        return config.get(key, default)

    def set_config(self, key: str, value) -> None:
        """Write a config value to library.json."""
        if "_config" not in self._data:
            self._data["_config"] = {}
        self._data["_config"][key] = value
        self._save_fn()
