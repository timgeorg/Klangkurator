"""The one-off Levex repair (issue #65, AC-20, AC-21).

The script folds the `.wav` row into the `.mp3` row. These tests use small
fixtures rather than the real library, because the real one is the author's.
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
import repair_audio_variants as repair  # noqa: E402

MP3 = "/music/house/Levex Remix.mp3"
WAV = "/music/house/Levex Remix.wav"


def _row(song_id: str, path: str, **extra) -> dict:
    return {
        "id": song_id,
        "title": "Scary Monsters (Levex Remix)",
        "artist": "Levex",
        "file_path": path,
        "bpm": 132.0,
        "musical_key": "Gm",
        "duration": 204.6,
        "energy": 4.2,
        "mixing_notes": "Out on the second drop.",
        "created_at": "2026-10-30T00:00:00Z",
        "updated_at": "2026-10-30T00:00:00Z",
        **extra,
    }


@pytest.fixture
def home(tmp_path) -> Path:
    """A data folder with the pair as two rows."""
    data = {
        "songs": [_row(repair.MP3_ID, MP3), _row(repair.WAV_ID, WAV, artist="Skrillex")],
        "tags": [], "genres": [], "song_tags": [], "relationships": [],
        "playlists": [], "playlist_songs": [],
    }
    (tmp_path / "library.json").write_text(json.dumps(data))
    (tmp_path / "blocks.json").write_text(json.dumps({"blocks": []}))
    (tmp_path / "sets.json").write_text(json.dumps({"sets": []}))
    return tmp_path


def _songs(home: Path) -> list[dict]:
    return json.loads((home / "library.json").read_text())["songs"]


def test_a_dry_run_writes_nothing(home):
    """The default is a report, never a change."""
    before = (home / "library.json").read_text()
    assert repair.repair(home, apply=False) == 0
    assert (home / "library.json").read_text() == before
    assert len(_songs(home)) == 2


def test_apply_folds_the_pair_into_one_row(home):
    """AC-20: one row, two files."""
    assert repair.repair(home, apply=True) == 0
    songs = _songs(home)
    assert len(songs) == 1
    assert songs[0]["id"] == repair.MP3_ID
    assert songs[0]["file_path"] == MP3
    assert [v["file_path"] for v in songs[0]["audio_variants"]] == [WAV]


def test_the_surviving_row_keeps_its_own_fields(home):
    """The mp3's ratings, notes, key and BPM are the track's — they do not move."""
    repair.repair(home, apply=True)
    song = _songs(home)[0]
    assert song["bpm"] == 132.0
    assert song["musical_key"] == "Gm"
    assert song["energy"] == 4.2
    assert song["artist"] == "Levex"
    assert song["mixing_notes"] == "Out on the second drop."


def test_the_variant_records_the_detected_tempo_of_its_own_file(home):
    """AC-13's pair has to survive the repair, or the popup has nothing to show."""
    repair.repair(home, apply=True)
    variant = _songs(home)[0]["audio_variants"][0]
    assert variant["bpm_reading"] == 132.0
    assert variant["format"] == "wav"
    assert "missing" not in variant


def test_a_referenced_duplicate_is_not_dropped(home):
    """AC-21: a set item naming the wav row blocks the removal."""
    sets = {"sets": [{"id": "s", "name": "Halloween", "items": [
        {"id": "i1", "type": "song", "ref_id": repair.WAV_ID, "position": 0}
    ], "phases": []}]}
    (home / "sets.json").write_text(json.dumps(sets))

    assert repair.repair(home, apply=True) == 2
    assert len(_songs(home)) == 2


def test_a_set_item_naming_the_kept_row_still_resolves(home):
    """AC-21: the Halloween set references the mp3, which survives untouched."""
    sets = {"sets": [{"id": "s", "name": "Gallop Pre-Halloween Party", "items": [
        {"id": "i1", "type": "song", "ref_id": repair.MP3_ID, "position": 0}
    ], "phases": []}]}
    (home / "sets.json").write_text(json.dumps(sets))

    assert repair.repair(home, apply=True) == 0
    after = json.loads((home / "sets.json").read_text())
    ids = {s["id"] for s in _songs(home)}
    for item in after["sets"][0]["items"]:
        assert item["ref_id"] in ids


def test_a_relationship_to_the_duplicate_blocks_it(home):
    """A relationship edge is a reference too."""
    data = json.loads((home / "library.json").read_text())
    data["relationships"] = [{
        "id": "r1", "source_song_id": repair.WAV_ID,
        "target_song_id": repair.MP3_ID, "relationship_type": "remix",
    }]
    (home / "library.json").write_text(json.dumps(data))

    assert repair.repair(home, apply=True) == 2
    assert len(_songs(home)) == 2


def test_a_block_reference_blocks_it(home):
    """A block's nested song ref counts."""
    (home / "blocks.json").write_text(json.dumps({"blocks": [
        {"id": "b", "name": "Mini mix", "songs": [{"song_id": repair.WAV_ID, "position": 0}]}
    ]}))
    assert repair.repair(home, apply=True) == 2
    assert len(_songs(home)) == 2


def test_an_already_repaired_library_is_left_alone(home):
    """A second run changes nothing."""
    repair.repair(home, apply=True)
    once = (home / "library.json").read_text()
    assert repair.repair(home, apply=True) == 1
    assert (home / "library.json").read_text() == once


def test_apply_writes_a_backup_beside_each_file(home):
    """A destructive script leaves a way back."""
    repair.repair(home, apply=True)
    backups = list(home.glob("library.json.*.bak"))
    assert len(backups) == 1
    assert json.loads(backups[0].read_text())["songs"]
