"""Import merge engine (issue #10, PF-83).

Pure planning + application of an exported-library envelope onto the local
stores. Envelope shape (see EXPORT_IMPORT_BEHAVIOR_CONTRACT.md):
{"format": "klangkurator-library", "version": 1, "exported_at": ..., "data":
 {songs, tags, song_tags, song_relationships, playlists, playlist_songs,
  blocks, sets}}

Principles (each carries its contract clause):
- fill-never-clobber (INV-5's principle): an empty local value is filled
  silently; a differing non-empty pair is a CONFLICT awaiting a resolution.
- identity is machine-agnostic: file_path match, else artist+title+duration
  within ±2 s, else artist+title (MC-1). file_path of a matched local track is
  never overwritten (MC-2). A matched local song keeps its id (INV-1); added
  songs mint fresh ids — a foreign uuid is never written verbatim (MC-5), so
  the uuid-collision hazard cannot corrupt an unrelated track.
- the old wholesale-replace behaviour of POST /api/import is gone; this module
  is the only importer now.
"""

from __future__ import annotations

from backend.models.song import SongBase

ENVELOPE_FORMAT = "klangkurator-library"
ENVELOPE_VERSION = 1
DATA_KEYS = (
    "songs", "tags", "song_tags", "song_relationships", "playlists",
    "playlist_songs", "blocks", "sets",
)
DURATION_TOLERANCE_S = 2.0

#: Every key a stored song row may carry: the model's field names plus their
#: aliases. Rows store `mainGenre`, the alias of `main_genre`; matching on the
#: field names alone dropped every imported main genre.
_SONG_KEYS = frozenset(
    key for name, field in SongBase.model_fields.items() for key in (name, field.alias) if key
)

# User-authored, conflict-resolvable song fields (MC-3), by their stored key:
# `mainGenre` is how rows hold the main genre (the model's alias). Ratings count as
# empty when 0 (0 = unrated across the app), strings when None/"", arrays
# when []. file_path is deliberately absent: paths are machine-truth (MC-2).
CONFLICT_FIELDS = (
    "energy", "people", "rank", "bpm",
    "musical_key", "year", "mainGenre", "drum_notes", "element_notes",
    "mixing_notes", "transition_notes", "lyrics", "phase_tags", "vibe_tags",
)


def _empty(field: str, value) -> bool:
    if value is None:
        return True
    if field in ("energy", "people", "rank"):
        return value == 0
    if field in ("phase_tags", "vibe_tags"):
        return len(value) == 0
    return value == ""


def _values_differ(field: str, a, b) -> bool:
    # Numbers compare numerically so a stored int 3 vs imported float 3.0 is
    # NOT a conflict (post-#13 ratings carry decimals).
    if field in ("energy", "people", "rank", "bpm", "year"):
        try:
            return float(a) != float(b)
        except (TypeError, ValueError):
            return a != b
    return a != b


def _composite_duration_ok(local: dict, imported: dict) -> bool:
    a, b = local.get("duration"), imported.get("duration")
    if a is None or b is None:
        return False
    return abs(float(a) - float(b)) <= DURATION_TOLERANCE_S


def _composite_duration_ok_safe(a: dict, b: dict) -> bool:
    try:
        return _composite_duration_ok(a, b)
    except (TypeError, ValueError):
        return False


class _Index:
    """Match indexes over the local songs, built once per planning run."""

    def __init__(self, songs: list[dict]):
        self.by_path: dict[str, dict] = {}
        self.by_artist_title: dict[tuple[str, str], list[dict]] = {}
        for s in songs:
            if s.get("file_path"):
                self.by_path.setdefault(s["file_path"], s)
            key = (s.get("artist") or "", s.get("title") or "")
            self.by_artist_title.setdefault(key, []).append(s)

    def match(self, imported: dict) -> tuple[dict | None, str | None]:
        """→ (local song, match kind) in the MC-1 precedence order."""
        s = self.by_path.get(imported.get("file_path") or "")
        if s is not None:
            return s, "path"
        key = (imported.get("artist") or "", imported.get("title") or "")
        candidates = self.by_artist_title.get(key, [])
        if not candidates:
            return None, None
        # ② the first artist+title candidate whose duration sits in the window
        for c in candidates:
            if _composite_duration_ok(c, imported):
                return c, "composite"
        # ③ plain artist+title
        return candidates[0], "artist_title"


def _song_conflicts(local: dict, imported: dict) -> list[tuple[str, object, object]]:
    out = []
    for f in CONFLICT_FIELDS:
        lv, iv = local.get(f), imported.get(f)
        if _empty(f, lv) or _empty(f, iv):
            continue  # fill or nothing — not a conflict (MC-3)
        if _values_differ(f, lv, iv):
            out.append((f, lv, iv))
    return out


def _envelope_error(envelope: dict) -> str | None:
    if not isinstance(envelope, dict):
        return "Not a Klangkurator export file."
    if envelope.get("format") != ENVELOPE_FORMAT:
        return f"Unknown export format: {envelope.get('format')!r}"
    v = envelope.get("version")
    if not isinstance(v, int) or v > ENVELOPE_VERSION:
        return f"Unsupported export version: {v!r}"
    if not isinstance(envelope.get("data"), dict):
        return "Export file has no data section."
    return None


def plan_import(envelope: dict, library, blocks, sets) -> dict:
    """Build the import plan without writing anything (read-only).

    `library`/`blocks`/`sets` are the stores. Returns a dict with `valid`,
    a human summary, the conflict list — and a private `_plan` carrying the
    write-time details (tags to create, other-store rows), which the API layer
    strips before answering.
    """
    error = _envelope_error(envelope)
    if error:
        return {"valid": False, "error": error}

    data = envelope["data"]
    index = _Index(library.get_songs())
    matched = filled = added = 0
    conflicts: list[dict] = []
    skipped_invalid: list[str] = []

    for s in data.get("songs", []):
        if not (s.get("title") and s.get("artist")):
            skipped_invalid.append(s.get("title") or s.get("file_path") or "<untitled>")
            continue  # add_song has no validation; garbage is reported, not written
        local, _kind = index.match(s)
        if local is None:
            added += 1
            continue
        matched += 1
        for f, lv, iv in _song_conflicts(local, s):
            conflicts.append(
                {"song_id": local["id"], "song": f"{s['title']} — {s['artist']}",
                 "field": f, "local": lv, "imported": iv}
            )
        # fill-empty counts (silent fills, no conflict)
        for f in CONFLICT_FIELDS:
            lv, iv = local.get(f), s.get(f)
            if _empty(f, lv) and not _empty(f, iv):
                filled += 1
                break  # one flag per song is enough for the summary

    # ── tags: match by exact name (TC-1) ───────────────────
    local_tags = {t["name"]: t for t in library.get_tags()}
    tags_to_create = [
        {"name": t["name"], "color": t.get("color") or "#888888"}
        for t in data.get("tags", []) if t.get("name") and t["name"] not in local_tags
    ]
    joins_in_file = data.get("song_tags", [])
    existing_pairs = {(j["song_id"], j["tag_id"]) for j in library.get_song_tags()}

    # ── other stores (OC-1): wholesale only into EMPTY stores ──
    skipped = {}
    remapped_other = {}
    other_specs = (
        ("song_relationships", "relationships", library, "get_relationships"),
        ("playlists", "playlists", library, "get_playlists"),
        ("playlist_songs", "playlist_songs", library, "get_playlist_songs"),
        ("blocks", "blocks", blocks, "get_blocks"),
        ("sets", "sets", sets, "get_sets"),
    )
    for file_key, _store_key, store, getter in other_specs:
        incoming = data.get(file_key) or []
        local_rows = getattr(store, getter)()
        if not incoming:
            continue
        if local_rows:
            skipped[file_key] = len(incoming)
        else:
            remapped_other[file_key] = incoming

    return {
        "valid": True,
        "summary": {
            "matched": matched, "filled": filled, "added": added,
            "conflicts": len(conflicts),
            "tags_to_create": len(tags_to_create),
            "joins_in_file": len(joins_in_file),
            "skipped": skipped,
            "skipped_invalid_songs": skipped_invalid,
        },
        "conflicts": conflicts,
        "_plan": {
            "tags_to_create": tags_to_create,
            "other_to_import": remapped_other,
            "skipped_other": skipped,
        },
    }


def apply_import(envelope: dict, resolutions: list[dict], library, blocks, sets) -> dict:
    """Execute a planned import. resolutions = [{song_id, field, overwrite}].

    Absent resolution ⇒ local value wins (fail-safe default, MC-4).

    Args:
        envelope (dict): The validated export envelope.
        resolutions (list[dict]): The user's per-field conflict answers.
        library: The library store.
        blocks: The blocks store.
        sets: The sets store.

    Returns:
        dict: The human-facing summary.
    """
    error = _envelope_error(envelope)
    if error:
        return {"valid": False, "error": error}

    plan = plan_import(envelope, library, blocks, sets)
    if not plan["valid"]:
        return plan
    data = envelope["data"]
    overwrite = {
        (r["song_id"], r["field"]) for r in resolutions if r.get("overwrite")
    }

    index = _Index(library.get_songs())
    applied_overwrites = filled_count = added_count = 0
    export_ids: dict[str | None, str] = {}  # exported song id → local id

    for s in data.get("songs", []):
        if not (s.get("title") and s.get("artist")):
            continue
        local, _kind = index.match(s)
        export_ids[s.get("id")] = local["id"] if local else None
        if local is None:
            # add_song mints a fresh machine-local id (MC-5) and returns it;
            # a foreign "id" key is dropped so it can never leak through.
            # Keys the model no longer has are dropped too: an export made
            # before a field was retired would otherwise write the dead key
            # into library.json, where it would ride into every later export.
            new_song = {k: v for k, v in s.items() if k in _SONG_KEYS}
            for f in CONFLICT_FIELDS:
                if _empty(f, new_song.get(f)):
                    new_song.pop(f, None)
            added_song = library.add_song(new_song)
            export_ids[s.get("id")] = added_song["id"]
            added_count += 1
            continue
        updates: dict = {}
        for f in CONFLICT_FIELDS:
            lv, iv = local.get(f), s.get(f)
            if _empty(f, lv) and not _empty(f, iv):
                updates[f] = iv  # fill-empty is always allowed (MC-3)
                filled_count += 1
            elif (local["id"], f) in overwrite and _values_differ(f, lv, iv):
                updates[f] = iv
                applied_overwrites += 1
            # else: conflict unresolved or resolution says keep → local stays
        # MC-2: file_path is not in CONFLICT_FIELDS → never overwritten.
        if updates:
            library.update_song(local["id"], updates)

    # ── tags + joins (TC-1/TC-2) ───────────────────────────
    name_to_id = {t["name"]: t["id"] for t in library.get_tags()}
    for t in plan["_plan"]["tags_to_create"]:
        created = library.add_tag(t)
        name_to_id[created["name"]] = created["id"]

    tag_name_by_file_id = {
        t.get("id"): t.get("name") for t in data.get("tags", []) if t.get("id")
    }

    joins_added = 0
    for j in data.get("song_tags", []):
        song_id = export_ids.get(j.get("song_id"))
        tag_id = name_to_id.get(tag_name_by_file_id.get(j.get("tag_id")))
        if song_id and tag_id:
            before = {(x["song_id"], x["tag_id"]) for x in library.get_song_tags()}
            if (song_id, tag_id) not in before:  # TC-2: never duplicate a join
                library.add_song_tag(song_id, tag_id)
                joins_added += 1

    # ── other stores (OC-1) empty-store wholesale, song-ids remapped ──
    remap = {k: v for k, v in export_ids.items() if v}
    other = plan["_plan"]["other_to_import"]
    if "song_relationships" in other:
        rows = [_remap_relationship(r, remap) for r in other["song_relationships"]]
        library._data["relationships"] = [r for r in rows if r]
    if "playlists" in other:
        library._data["playlists"] = other["playlists"]
    if "playlist_songs" in other:
        rows = []
        for r in other["playlist_songs"]:
            m = dict(r)
            if m.get("song_id") in remap:
                m["song_id"] = remap[m["song_id"]]
                rows.append(m)
        library._data["playlist_songs"] = rows
    if "blocks" in other:
        blocks._data["blocks"] = [_remap_block(b, remap) for b in other["blocks"]]
    if "sets" in other:
        sets._data["sets"] = [_remap_djset(s, remap) for s in other["sets"]]
    library._save_fn()
    blocks._save_fn()
    sets._save_fn()

    summary = plan["summary"]
    summary.update({"overwrites_applied": applied_overwrites,
                    "tags_created": len(plan["_plan"]["tags_to_create"]),
                    "joins_added": joins_added})
    return {"valid": True, "summary": summary}


def _remap_relationship(r: dict, remap: dict) -> dict | None:
    m = dict(r)
    ok = True
    for key in ("source_song_id", "target_song_id"):
        if m.get(key) not in remap:
            ok = False  # referenced song unknown locally — drop, never dangle
        else:
            m[key] = remap[m[key]]
    return m if ok else None


def _remap_block(block: dict, remap: dict) -> dict:
    """Block rows nest their song refs: songs[].song_id (BlockSong)."""
    m = dict(block)
    m["songs"] = [
        {**bs, "song_id": remap[bs["song_id"]]}
        for bs in m.get("songs", []) if bs.get("song_id") in remap
    ]
    return m


def _remap_djset(djset: dict, remap: dict) -> dict:
    """Set rows reference songs/blocks by id in items[].ref_id and
    phases[].items[].ref_id. Only song-item refs remap; block refs stay
    (block ids themselves are not remapped — an empty local blocks store that
    receives blocks gets consistent fresh rows, but set→block links keep the
    exported block ids, matching those imported blocks). (INV-7: references by
    id only, never embedded)."""
    m = dict(djset)

    def remap_items(items: list[dict]) -> list[dict]:
        out = []
        for it in items:
            if it.get("type") == "song" and it.get("ref_id") in remap:
                out.append({**it, "ref_id": remap[it["ref_id"]]})
            else:
                out.append(it)
        return out

    m["items"] = remap_items(m.get("items", []))
    m["phases"] = [
        {**p, "items": remap_items(p.get("items", []))} for p in m.get("phases", [])
    ]
    return m