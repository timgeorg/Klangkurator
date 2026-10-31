#!/usr/bin/env python3
"""Repair the Levex pair: one track, two files (issue #65).

The library holds the same recording twice — `40a2ace1…` is the `.mp3` and
`f08a9c70…` the `.wav`. This script attaches the `.wav` to the `.mp3` row as a
variant and then removes the emptied second row.

The row is removed **only after** the script confirms that no set, block,
playlist or relationship refers to its id. If one does, the script leaves both
rows alone and says which reference blocked it, because dropping a referenced row
would leave a set item pointing at nothing (INV-7).

Dry run by default. Nothing is written without `--apply`, and an `--apply` run
first copies every file it is about to write next to the original.

The `print` calls are the script's interface, which the code-standards gate
exempts for a CLI (`STD001`, the same rule `check_code_standards.py` holds for
itself). Run the gate with
`--allow 'scripts/repair_audio_variants.py:STD001'`.

Usage:
    python scripts/repair_audio_variants.py --home ~/.klangkurator
    python scripts/repair_audio_variants.py --home /tmp/kk-sandbox/.klangkurator --apply
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

#: The pair the ticket measured (2026-10-30). The mp3 keeps the row; the wav
#: becomes its variant.
MP3_ID = "40a2ace1-722c-4e61-a974-571fb9b783df"
WAV_ID = "f08a9c70-0a6f-4677-9d6a-fb0bd54af637"


def _load(path: Path) -> dict:
    """Read one JSON document, or an empty one when the file is absent."""
    if not path.is_file():
        return {}
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def _library_references(row_id: str, library: dict) -> list[str]:
    """Relationship and playlist references to `row_id`.

    Args:
        row_id (str): The song id about to be removed.
        library (dict): library.json's data.

    Returns:
        list[str]: One entry per reference.
    """
    found = [
        f"relationship {rel.get('relationship_type')} ({rel.get('id')})"
        for rel in library.get("relationships", [])
        if row_id in (rel.get("source_song_id"), rel.get("target_song_id"))
    ]
    found += [
        f"playlist {join.get('playlist_id')}"
        for join in library.get("playlist_songs", [])
        if join.get("song_id") == row_id
    ]
    return found


def _block_references(row_id: str, blocks: dict) -> list[str]:
    """Block references to `row_id`.

    Args:
        row_id (str): The song id about to be removed.
        blocks (dict): blocks.json's data.

    Returns:
        list[str]: One entry per block that names it.
    """
    return [
        f"block “{block.get('name')}”"
        for block in blocks.get("blocks", [])
        if any(bs.get("song_id") == row_id for bs in block.get("songs", []))
    ]


def _set_references(row_id: str, sets: dict) -> list[str]:
    """Set references to `row_id`, in its items and its phases' items.

    Args:
        row_id (str): The song id about to be removed.
        sets (dict): sets.json's data.

    Returns:
        list[str]: One entry per set that names it.
    """
    found = []
    for djset in sets.get("sets", []):
        items = list(djset.get("items", []))
        for phase in djset.get("phases", []):
            items.extend(phase.get("items", []))
        if any(row_id in (item.get("ref_id"), item.get("song_id")) for item in items):
            found.append(f"set “{djset.get('name')}”")
    return found


def _references(row_id: str, library: dict, blocks: dict, sets: dict) -> list[str]:
    """Every place that names `row_id`, as readable strings.

    Args:
        row_id (str): The song id about to be removed.
        library (dict): library.json's data.
        blocks (dict): blocks.json's data.
        sets (dict): sets.json's data.

    Returns:
        list[str]: One entry per reference, empty when the id is safe to drop.
    """
    return (
        _library_references(row_id, library)
        + _block_references(row_id, blocks)
        + _set_references(row_id, sets)
    )


def _variant_from(song: dict) -> dict:
    """The variant record for the song row about to be folded in.

    Args:
        song (dict): The row that becomes a variant.

    Returns:
        dict: The variant payload, with the facts the row already knows. The
        file's own bit depth and sample rate are not read here: this script runs
        outside the app, and `mutagen` may not be installed in the interpreter
        that runs it. The app fills them the next time the file is attached.
    """
    path = Path(song["file_path"])
    return {
        "id": "6f1c1a2e-0000-4000-8000-000000000065",
        "file_path": song["file_path"],
        "format": path.suffix.lstrip(".").lower(),
        "duration": song.get("duration"),
        "bitrate": None,
        "sample_rate": None,
        "bit_depth": None,
        "size_bytes": path.stat().st_size if path.is_file() else None,
        "added_at": datetime.now(timezone.utc).isoformat(),
        # The row's own BPM is what the second file read. It is advisory: the
        # track's BPM stays the mp3's, and the popup shows both (AC-13).
        "bpm_reading": song.get("bpm"),
    }


def repair(home: Path, apply: bool) -> int:
    """Plan, print, and (with `apply`) write the repair.

    Args:
        home (Path): The data folder holding library.json, blocks.json and sets.json.
        apply (bool): When False, write nothing.

    Returns:
        int: 0 on a plan that can be applied (or was), 1 when the repair does
        not apply to this library, 2 when a reference blocks the removal.
    """
    library_path = home / "library.json"
    library = _load(library_path)
    blocks = _load(home / "blocks.json")
    sets = _load(home / "sets.json")

    songs = library.get("songs", [])
    primary = next((s for s in songs if s.get("id") == MP3_ID), None)
    duplicate = next((s for s in songs if s.get("id") == WAV_ID), None)

    print(f"Data folder: {home}")
    refusal = _refuse(primary, duplicate)
    if refusal:
        print(refusal)
        return 1

    print(f"  keep   {primary['id']}  {primary['file_path']}")
    print(f"  attach {duplicate['id']}  {duplicate['file_path']}")
    print(f"  drop   {duplicate['id']} after the attach")

    blockers = _references(WAV_ID, library, blocks, sets)
    if blockers:
        print("\nRefusing: these reference the row that would be dropped.")
        for blocker in blockers:
            print(f"  - {blocker}")
        print("\nMove those references to the mp3 row first, then run this again.")
        return 2

    if not apply:
        print("\nDry run. Nothing written. Re-run with --apply to write the change.")
        return 0

    _write(home, library_path, library, songs, primary, duplicate)
    return 0


def _refuse(primary: dict | None, duplicate: dict | None) -> str | None:
    """Why this library needs no repair, or None when it does.

    Args:
        primary (dict | None): The mp3 row, when it exists.
        duplicate (dict | None): The wav row, when it exists.

    Returns:
        str | None: A sentence to print, or None to continue.
    """
    if primary is None:
        return f"No row {MP3_ID}. Nothing to repair in this library."
    if duplicate is None:
        return f"No row {WAV_ID}. The pair is already one row, or was never split."
    if any(v.get("file_path") == duplicate["file_path"] for v in primary.get("audio_variants", [])):
        return "The wav is already a variant of the mp3. Nothing to do."
    return None


def _write(
    home: Path, library_path: Path, library: dict, songs: list[dict], primary: dict, duplicate: dict
) -> None:
    """Back the data files up, then write the repair.

    Args:
        home (Path): The data folder.
        library_path (Path): library.json.
        library (dict): Its loaded data, mutated in place.
        songs (list[dict]): The song rows as loaded.
        primary (dict): The row that keeps the track.
        duplicate (dict): The row that becomes a variant.
    """
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    for name in ("library.json", "blocks.json", "sets.json"):
        source = home / name
        if source.is_file():
            backup = source.with_name(f"{name}.{stamp}.bak")
            shutil.copy2(source, backup)
            print(f"Backup: {backup}")

    primary.setdefault("audio_variants", []).append(_variant_from(duplicate))
    primary["updated_at"] = datetime.now(timezone.utc).isoformat()
    library["songs"] = [s for s in songs if s.get("id") != WAV_ID]

    with library_path.open("w", encoding="utf-8") as handle:
        json.dump(library, handle, ensure_ascii=False, indent=2)
    print(f"\nAttached the wav to {MP3_ID} and dropped {WAV_ID}.")
    print(f"Library now holds {len(library['songs'])} songs.")


def main(argv: list[str] | None = None) -> int:
    """Parse arguments and run the repair.

    Args:
        argv (list[str] | None): Arguments, for tests. None reads the command line.

    Returns:
        int: The process exit code.
    """
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--home",
        type=Path,
        default=Path("~/.klangkurator").expanduser(),
        help="The Klangkurator data folder (default: ~/.klangkurator).",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write the change. Without it the script only prints what it would do.",
    )
    args = parser.parse_args(argv)
    if not args.home.is_dir():
        print(f"Not a folder: {args.home}", file=sys.stderr)
        return 1
    return repair(args.home, args.apply)


if __name__ == "__main__":
    sys.exit(main())
