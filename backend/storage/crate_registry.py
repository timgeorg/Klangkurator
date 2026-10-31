"""Crate registry — crates and music locations as real entities (issue #11).

A crate used to be a derived string on the song (`root_folder`), so two
folders with the same name in different places collapsed into one crate. A
crate is now an entry in `_config.crates` with an `id`, a `name` and the
`location_path` of the music location that holds it. Songs store only the id.

Every function here is pure: it reads and writes the plain `library.json`
dictionary and never touches a file. That keeps the migration testable on a
copy of the real library, and it keeps the store free of the rules.

Ids are derived from content, not minted at random. The same crate path
therefore yields the same id on every run and on every machine, so
re-adding a location re-resolves its songs by path.
"""

import hashlib
import logging
import posixpath
from pathlib import PurePosixPath

logger = logging.getLogger(__name__)

#: The `_config` keys this module owns.
CRATE_KEY = "crates"
LOCATION_KEY = "music_locations"

#: The `_config` key the single-root model wrote. It is consumed on migration.
LEGACY_ROOT_KEY = "root_path"

#: The song field the single-root model wrote. It is consumed on migration.
LEGACY_SONG_KEY = "root_folder"

#: The song field that holds the crate id.
SONG_KEY = "crate_id"

#: The song field that marks a song whose location was removed.
MISSING_KEY = "missing_since"

#: How many hex characters of the path digest an id keeps. 16 hex digits is
#: far more than a library of crates can collide in, and it stays a plain id.
_ID_HEX = 16


def _digest(*parts: str) -> str:
    """A short, stable hex digest of the given parts.

    Args:
        *parts (str): The values that identify the entity, in order.

    Returns:
        str: 16 lowercase hex characters.
    """
    joined = "\0".join(parts).encode("utf-8")
    return hashlib.sha1(joined).hexdigest()[:_ID_HEX]


def crate_id(location_path: str, name: str) -> str:
    """The id of the crate `name` inside `location_path`.

    Args:
        location_path (str): The music location that holds the crate.
        name (str): The crate name, relative to the location.

    Returns:
        str: A stable id such as `crate_1f2e3d4c5b6a7980`.
    """
    return "crate_" + _digest(location_path, name)


def location_id(path: str) -> str:
    """The id of a music location.

    Args:
        path (str): The location's folder path.

    Returns:
        str: A stable id such as `loc_1f2e3d4c5b6a7980`.
    """
    return "loc_" + _digest(path)


def normalize_path(raw: str) -> str:
    """A folder path in one shape: no `~`, no `\\`, no trailing slash.

    Args:
        raw (str): The path a user or a stored row gives.

    Returns:
        str: The path with `/` separators and no trailing slash. An empty or
        unusable value comes back as an empty string.
    """
    if not isinstance(raw, str):
        return ""
    text = raw.strip().replace("\\", "/")
    if not text:
        return ""
    text = posixpath.normpath(posixpath.expanduser(text))
    return text.rstrip("/") or "/"


def crate_name_for(location_path: str, file_path: str) -> str:
    """The crate a file belongs to, relative to its music location.

    This is the rule the scan has always used: the file's folder below the
    location, and the location's own name for a file that sits directly in it.

    Args:
        location_path (str): The music location that holds the file.
        file_path (str): The audio file.

    Returns:
        str: The crate name, e.g. `house/deep` or `#MUSIC`.
    """
    location = normalize_path(location_path)
    parent = posixpath.dirname(normalize_path(file_path))
    if not location:
        return posixpath.basename(parent) or "Unknown"
    if parent == location:
        return posixpath.basename(location) or location
    prefix = location.rstrip("/") + "/"
    if parent.startswith(prefix):
        return parent[len(prefix):]
    return posixpath.basename(parent) or "Unknown"


def location_of(location_paths, file_path: str) -> str | None:
    """The music location that holds `file_path`, the most specific one first.

    A crate folder that is itself a location wins over its parent, so a nested
    location keeps its own crates.

    Args:
        location_paths: Paths of the known music locations.
        file_path (str): The audio file.

    Returns:
        str | None: The matching location path, or None when the file sits
        outside every location.
    """
    target = normalize_path(file_path)
    matches = [
        normalize_path(path)
        for path in location_paths or []
        if normalize_path(path)
        and (target == normalize_path(path) or target.startswith(normalize_path(path).rstrip("/") + "/"))
    ]
    if not matches:
        return None
    return max(matches, key=len)


def new_report() -> dict:
    """A fresh migration report.

    Returns:
        dict: Zeroed counters, an empty warning list and empty id lists.
    """
    return {
        "changed": False,
        "songs_migrated": 0,
        "songs_unresolved": [],
        "orphan_repairs": 0,
        "crates": 0,
        "locations": 0,
        "warnings": [],
    }


def _valid_location(entry) -> dict | None:
    """One stored location entry, or None when it is unusable.

    Args:
        entry: A value from `_config.music_locations`.

    Returns:
        dict | None: `{id, path}` with a derived id.
    """
    raw = entry.get("path") if isinstance(entry, dict) else entry
    if not isinstance(raw, str):
        return None
    path = normalize_path(raw)
    if not path:
        return None
    return {"id": location_id(path), "path": path}


def _valid_crate(entry) -> dict | None:
    """One stored crate entry, or None when it is unusable.

    Args:
        entry: A value from `_config.crates`.

    Returns:
        dict | None: `{id, name, location_path}`.
    """
    if not isinstance(entry, dict):
        return None
    name = entry.get("name")
    location = entry.get("location_path")
    if not isinstance(name, str) or not name.strip():
        return None
    if not isinstance(location, str) or not normalize_path(location):
        return None
    location = normalize_path(location)
    name = name.strip().strip("/")
    return {"id": crate_id(location, name), "name": name, "location_path": location}


def _load_registry(config: dict, report: dict) -> tuple[dict, dict]:
    """The usable locations and crates already stored, self-healed.

    A missing or malformed registry is rebuilt from what is readable instead of
    raising: a hand-edited or truncated `_config` must never cost the library.

    Args:
        config (dict): The `_config` block.
        report (dict): The migration report to record warnings in.

    Returns:
        tuple[dict, dict]: Locations by path, and crates by id.
    """
    raw_locations = config.get(LOCATION_KEY)
    raw_crates = config.get(CRATE_KEY)
    locations: dict[str, dict] = {}
    crates: dict[str, dict] = {}

    if raw_locations is not None and not isinstance(raw_locations, list):
        report["warnings"].append(f"{LOCATION_KEY} was not a list; it was rebuilt")
        report["changed"] = True
    for entry in raw_locations if isinstance(raw_locations, list) else []:
        location = _valid_location(entry)
        if location is None:
            report["warnings"].append(f"A music location entry was unreadable and was skipped: {entry!r}")
            report["changed"] = True
            continue
        locations[location["path"]] = location

    if raw_crates is not None and not isinstance(raw_crates, list):
        report["warnings"].append(f"{CRATE_KEY} was not a list; it was rebuilt")
        report["changed"] = True
    for entry in raw_crates if isinstance(raw_crates, list) else []:
        crate = _valid_crate(entry)
        if crate is None:
            report["warnings"].append(f"A crate entry was unreadable and was skipped: {entry!r}")
            report["changed"] = True
            continue
        crates.setdefault(crate["id"], crate)

    return locations, crates


def _register(crates: dict, location_path: str, name: str) -> dict:
    """Add a crate to the registry when it is new.

    Args:
        crates (dict): The registry, by id.
        location_path (str): The music location that holds the crate.
        name (str): The crate name.

    Returns:
        dict: The stored crate entry.
    """
    crate = {"id": crate_id(location_path, name), "name": name, "location_path": location_path}
    return crates.setdefault(crate["id"], crate)


def _legacy_location(crate_path: str, old_name: str, legacy_root: str) -> tuple[str, str]:
    """The location and crate name an old `root_folder` string maps to.

    The crate **name is preserved exactly** whenever a location can be found
    that holds its files. A rename would move a crate under the user's eyes
    during an upgrade, so only a name that cannot be placed is adjusted, and
    the report says so.

    Args:
        crate_path (str): The folder that holds the files.
        old_name (str): The stored `root_folder` value.
        legacy_root (str): The configured root before migration, or "".

    Returns:
        tuple[str, str]: The location path and the crate name.
    """
    crate_path = normalize_path(crate_path)
    root = normalize_path(legacy_root)
    name = (old_name or "").strip().strip("/")

    # 1. Every crate the single-root model scanned sits under that root: the
    #    root stays the location and the name is its own relative path.
    if root and (crate_path == root or crate_path.startswith(root + "/")):
        relative = crate_path[len(root):].lstrip("/") or posixpath.basename(root)
        return root, relative

    # 2. The crate folder is itself a music location (a folder adopted from
    #    outside the root). The narrowest location keeps the name intact.
    return crate_path, posixpath.basename(crate_path) or name or "Unknown"


def _migrate_song(song: dict, locations: dict, crates: dict, legacy_root: str, report: dict) -> None:
    """Move one legacy song row onto a crate id, in place.

    The file's folder is the truth and the stored name is checked against it.
    A row the migration cannot place keeps its old value and is reported. It is
    never dropped and never blanked.

    Args:
        song (dict): The stored song row.
        locations (dict): The location registry, by path, updated in place.
        crates (dict): The crate registry, by id, updated in place.
        legacy_root (str): The configured root before migration, or "".
        report (dict): The migration report.
    """
    if LEGACY_SONG_KEY not in song:
        return
    old_name = song.get(LEGACY_SONG_KEY)
    file_path = song.get("file_path")
    if not isinstance(old_name, str) or not old_name.strip() or not isinstance(file_path, str) or not file_path:
        report["songs_unresolved"].append(song.get("id"))
        report["warnings"].append(
            f"Song {song.get('id')} keeps its unreadable {LEGACY_SONG_KEY} value: {old_name!r}"
        )
        return

    crate_path = posixpath.dirname(normalize_path(file_path))
    location_path, name = _legacy_location(crate_path, old_name, legacy_root)
    if name != old_name.strip().strip("/"):
        # The paths did not line up with the stored name. The path wins, and
        # the report names both so the change is never silent.
        report["warnings"].append(
            f"Crate “{old_name.strip()}” did not match its files; it was placed at "
            f"{location_path} as “{name}”"
        )

    crate = _register(crates, location_path, name)
    locations.setdefault(location_path, {"id": location_id(location_path), "path": location_path})
    song[SONG_KEY] = crate["id"]
    del song[LEGACY_SONG_KEY]
    report["songs_migrated"] += 1
    report["changed"] = True


def _heal_song(song: dict, locations: dict, crates: dict, report: dict) -> None:
    """Re-resolve a song whose crate id is unknown to the registry.

    A crate id can arrive from an imported envelope written on another machine,
    or from a registry that lost an entry. The file path is the truth, so the
    crate is derived from it again. When no known location holds the file, its
    own folder becomes the location — the narrowest reconstruction there is —
    and a warning says how many rows were repaired that way.

    Args:
        song (dict): The stored song row.
        locations (dict): The location registry, by path, updated in place.
        crates (dict): The crate registry, by id, updated in place.
        report (dict): The migration report.
    """
    known = song.get(SONG_KEY)
    if known is not None and known in crates:
        return
    if song.get(MISSING_KEY):
        # The crate is gone because its music location was removed, and the
        # song is flagged for exactly that reason. Healing it from the path
        # would resurrect the crate and erase the flag, so a removal would
        # undo itself on the next read. The flag is the answer here.
        return
    file_path = song.get("file_path")
    if not isinstance(file_path, str) or not normalize_path(file_path):
        if known is not None:
            report["warnings"].append(f"Song {song.get('id')} names an unknown crate and has no file path")
        return

    location_path = location_of(locations.keys(), file_path)
    if location_path is None:
        if known is None:
            # A row created by hand, or from a file outside every location:
            # nothing to resolve it against, and inventing a location for it
            # would turn any stray path into a music folder.
            return
        # A crate id no location can explain — the registry lost an entry, or
        # the row came from another machine. Its own folder is the narrowest
        # reconstruction, and the count is reported rather than hidden.
        location_path = posixpath.dirname(normalize_path(file_path))
        report["orphan_repairs"] += 1

    name = crate_name_for(location_path, file_path)
    crate = _register(crates, location_path, name)
    locations.setdefault(location_path, {"id": location_id(location_path), "path": location_path})
    song[SONG_KEY] = crate["id"]
    report["changed"] = True


def migrate(config: dict, songs: list) -> dict:
    """Bring a `library.json` block up to the crate-registry model, in place.

    This is the one-time pass the app runs when it reads the file. It is
    idempotent: a second run finds nothing to change and reports
    `changed: False`, so the file is not rewritten.

    It never deletes a song and never blanks a value it cannot interpret. A row
    it cannot place keeps its old field and appears in `songs_unresolved`.

    Args:
        config (dict): The `_config` block of `library.json`.
        songs (list): The `songs` list of `library.json`.

    Returns:
        dict: The report: counters, warning strings and unresolved song ids.
    """
    report = new_report()
    config = config if isinstance(config, dict) else {}
    songs = songs if isinstance(songs, list) else []

    locations, crates = _load_registry(config, report)
    legacy_root = config.get(LEGACY_ROOT_KEY)
    legacy_root = legacy_root if isinstance(legacy_root, str) else ""
    if LEGACY_ROOT_KEY in config:
        config.pop(LEGACY_ROOT_KEY, None)
        report["changed"] = True
        if not normalize_path(legacy_root):
            report["warnings"].append("The old root folder was empty and was dropped")
            legacy_root = ""

    for song in songs:
        if isinstance(song, dict):
            _migrate_song(song, locations, crates, legacy_root, report)

    if normalize_path(legacy_root):
        locations.setdefault(
            normalize_path(legacy_root),
            {"id": location_id(normalize_path(legacy_root)), "path": normalize_path(legacy_root)},
        )

    for song in songs:
        if isinstance(song, dict):
            _heal_song(song, locations, crates, report)

    # Every crate's location must exist, or a rescan of that crate is
    # impossible after a malformed registry dropped the location entry.
    for crate in crates.values():
        locations.setdefault(
            crate["location_path"],
            {"id": location_id(crate["location_path"]), "path": crate["location_path"]},
        )

    ordered_locations = [locations[path] for path in sorted(locations)]
    ordered_crates = [
        crates[key]
        for key in sorted(crates, key=lambda key: (crates[key]["name"].casefold(), crates[key]["location_path"]))
    ]
    if config.get(LOCATION_KEY) != ordered_locations:
        config[LOCATION_KEY] = ordered_locations
        report["changed"] = True
    if config.get(CRATE_KEY) != ordered_crates:
        config[CRATE_KEY] = ordered_crates
        report["changed"] = True

    if report["orphan_repairs"]:
        report["warnings"].append(
            f"{report['orphan_repairs']} songs named a crate the registry had lost; "
            "each crate was rebuilt from its file's own folder"
        )

    report["crates"] = len(ordered_crates)
    report["locations"] = len(ordered_locations)
    return report


def crate_lookup(config: dict) -> dict:
    """The crates of a `_config` block, by id.

    Args:
        config (dict): The `_config` block.

    Returns:
        dict: Crate entries by id; empty when the registry is unusable.
    """
    entries = config.get(CRATE_KEY) if isinstance(config, dict) else None
    if not isinstance(entries, list):
        return {}
    found = {}
    for entry in entries:
        crate = _valid_crate(entry)
        if crate:
            found[crate["id"]] = crate
    return found


def location_lookup(config: dict) -> dict:
    """The music locations of a `_config` block, by id.

    Args:
        config (dict): The `_config` block.

    Returns:
        dict: Location entries by id; empty when the registry is unusable.
    """
    entries = config.get(LOCATION_KEY) if isinstance(config, dict) else None
    if not isinstance(entries, list):
        return {}
    found = {}
    for entry in entries:
        location = _valid_location(entry)
        if location:
            found[location["id"]] = location
    return found
