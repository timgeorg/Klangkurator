"""Tests for the Rekordbox XML writer.

The format rules that decide whether an import works are tested here, so a change
to the writer cannot quietly break the encoding, the rating table or the counts
without audio and without Rekordbox.
"""

import xml.etree.ElementTree as ET
from datetime import date

import pytest

from backend.services.rekordbox_xml import (
    ExportPlaylist,
    ExportTrack,
    build_xml,
    file_uri,
    kind_for,
    normalise_tonality,
    rating_for,
)


def track(track_id: int, path: str, **kwargs) -> ExportTrack:
    """An ExportTrack with just the fields a case cares about."""
    return ExportTrack(track_id=track_id, name=f"Track {track_id}", location=path, **kwargs)


# ── Location: the encoding that decides whether Rekordbox finds the file ──


@pytest.mark.parametrize(
    "path",
    [
        "/media/tim/Extreme SSD/#MUSIC/house/track.mp3",
        "/media/tim/Extreme SSD/#MUSIC/Don't Stop.mp3",
        "/media/tim/Extreme SSD/#MUSIC/Limesläufe 2025.mp3",
        "/media/tim/Extreme SSD/#MUSIC/Über & Beyond 100%.mp3",
    ],
)
def test_location_encodes_the_characters_this_library_actually_has(path):
    """A space, `#`, an apostrophe and a non-ASCII letter must all be encoded.

    This library's root is `/media/tim/Extreme SSD/#MUSIC`, so these are the normal
    path, not corner cases. An unencoded `#` turns everything after it into a
    fragment and Rekordbox then reports a missing file.
    """
    uri = file_uri(path)

    assert uri.startswith("file://localhost/")
    assert " " not in uri
    assert "#" not in uri[len("file://localhost/") :]
    assert "'" not in uri


def test_location_encodes_a_non_ascii_letter():
    """A UTF-8 letter becomes its percent-encoded bytes, which is what Rekordbox reads."""
    assert "%C3%A4" in file_uri("/media/tim/Extreme SSD/#MUSIC/Limesläufe.mp3")


def test_location_keeps_the_path_separators():
    """Encoding must not turn `/` into `%2F`: Rekordbox reads the path from the URI."""
    assert "/media/tim/" in file_uri("/media/tim/x.mp3")


def test_location_round_trips_through_a_parser():
    """The URI in the file is the URI a reader gets back, character for character."""
    path = "/media/tim/Extreme SSD/#MUSIC/Don't Stop (Limesläufe).mp3"
    xml = build_xml([track(1, path)], [ExportPlaylist("S", [1])])

    location = ET.fromstring(xml).find(".//TRACK").get("Location")

    assert " " not in location and "#" not in location[len("file://localhost/") :]


def test_a_track_with_no_path_is_refused():
    """An export cannot point at nothing."""
    with pytest.raises(ValueError):
        file_uri("")


# ── Rating: Rekordbox's six values, not a star count ──


@pytest.mark.parametrize(
    ("rank", "expected"),
    [(0, 0), (1, 51), (2, 102), (3, 153), (4, 204), (5, 255)],
)
def test_rating_follows_rekordbox_table(rank, expected):
    assert rating_for(rank) == expected


def test_rating_clamps_and_defaults():
    assert rating_for(None) == 0
    assert rating_for(-3) == 0
    assert rating_for(9) == 255


# ── Tonality: Rekordbox's spelling, or nothing at all ──


@pytest.mark.parametrize(
    ("key", "expected"),
    [
        ("Am", "Am"),
        ("F#m", "F#m"),
        ("C", "C"),
        ("G#", "G#"),
        ("Bb", "A#"),
        ("Ebm", "D#m"),
        ("Amin", "Am"),
    ],
)
def test_tonality_is_normalised_to_rekordbox_spelling(key, expected):
    assert normalise_tonality(key) == expected


@pytest.mark.parametrize("key", [None, "", "   ", "H", "X#m", "unknown"])
def test_an_unknown_key_is_dropped_rather_than_written(key):
    """An absent `Tonality` beats a wrong one in a DJ-visible column."""
    assert normalise_tonality(key) is None


# ── Absent attributes ──


def test_no_bpm_writes_no_attribute():
    xml = build_xml([track(1, "/a/b.mp3", average_bpm=None)], [ExportPlaylist("S", [1])])
    assert "AverageBpm" not in xml


def test_a_zero_bpm_is_dropped_as_a_failed_reading():
    xml = build_xml([track(1, "/a/b.mp3", average_bpm=0)], [ExportPlaylist("S", [1])])
    assert "AverageBpm" not in xml


def test_bpm_carries_two_decimals():
    xml = build_xml([track(1, "/a/b.mp3", average_bpm=129.2)], [ExportPlaylist("S", [1])])
    assert 'AverageBpm="129.20"' in xml


def test_no_key_writes_no_tonality():
    xml = build_xml([track(1, "/a/b.mp3", tonality=None)], [ExportPlaylist("S", [1])])
    assert "Tonality" not in xml


# ── Counts: an `Entries` that does not match breaks the import ──


def test_entries_match_the_collection_and_each_node():
    tracks = [track(i, f"/a/{i}.mp3") for i in range(1, 4)]
    playlists = [ExportPlaylist("One", [1, 2]), ExportPlaylist("Two", [3])]

    root = ET.fromstring(build_xml(tracks, playlists))

    assert root.find("COLLECTION").get("Entries") == "3"
    nodes = root.findall("PLAYLISTS/NODE/NODE")
    assert [node.get("Entries") for node in nodes] == ["2", "1"]
    assert [len(node.findall("TRACK")) for node in nodes] == [2, 1]
    assert root.find("PLAYLISTS/NODE").get("Count") == "2"


def test_a_playlist_naming_an_unexported_track_is_refused():
    """An entry Rekordbox cannot resolve is a broken import, so it never ships."""
    with pytest.raises(ValueError):
        build_xml([track(1, "/a/1.mp3")], [ExportPlaylist("S", [1, 99])])


# ── The playlist keeps the set's order ──


def test_playlist_keeps_the_set_order():
    tracks = [track(i, f"/a/{i}.mp3") for i in range(1, 5)]
    root = ET.fromstring(build_xml(tracks, [ExportPlaylist("Set", [3, 1, 4, 2])]))

    keys = [entry.get("Key") for entry in root.findall("PLAYLISTS/NODE/NODE/TRACK")]

    assert keys == ["3", "1", "4", "2"]


def test_the_document_declares_the_version_rekordbox_expects():
    root = ET.fromstring(build_xml([], []))
    assert root.tag == "DJ_PLAYLISTS"
    assert root.get("Version") == "1.0.0"
    assert root.find("PRODUCT").get("Name") == "Klangkurator"


def test_kind_is_named_for_the_common_formats():
    assert kind_for("/a/b.mp3") == "MP3 File"
    assert kind_for("/a/b.FLAC") == "FLAC File"
    assert kind_for("/a/b.xyz") is None


def test_a_set_with_many_tracks_stays_small():
    """AC-9: 47 tracks must produce an XML well under 100 KB."""
    tracks = [
        track(i, f"/media/tim/Extreme SSD/#MUSIC/house/tim{i}.mp3", average_bpm=129.2, tonality="Am")
        for i in range(1, 48)
    ]
    xml = build_xml(tracks, [ExportPlaylist("Halloween", list(range(1, 48)))])
    assert len(xml.encode()) < 100_000


def test_comments_carry_the_transition_note():
    xml = build_xml(
        [track(1, "/a/b.mp3", comments="long blend, filter down")],
        [ExportPlaylist("S", [1])],
    )
    assert 'Comments="long blend, filter down"' in xml


def test_date_added_is_a_calendar_date():
    xml = build_xml(
        [track(1, "/a/b.mp3", date_added=date(2026, 10, 30))],
        [ExportPlaylist("S", [1])],
    )
    assert 'DateAdded="2026-10-30"' in xml


# ── The endpoint: a real set, a real song, one file ──


def _seed(client, tmp_path):
    """A library with one song and a set that holds it, through the public API."""
    audio = tmp_path / "Don't Stop (Limesläufe) #1.mp3"
    audio.write_bytes(b"\0" * 2048)
    song = client.post(
        "/api/songs",
        json={
            "title": "Don't Stop",
            "artist": "Jengi",
            "file_path": str(audio),
            "bpm": 129.2,
            "musical_key": "Am",
            "duration": 245.6,
            "main_genre": "Tech House",
            "rank": 4,
        },
    ).json()
    dj_set = client.post(
        "/api/sets",
        json={
            "name": "Gallop Pre-Halloween",
            "color": "#3355ff",
            "items": [
                {
                    "id": "i1",
                    "type": "song",
                    "ref_id": song["id"],
                    "position": 0,
                    "transition_notes": "long blend",
                    "alternative_transitions": [],
                }
            ],
            "phases": [],
        },
    ).json()
    return song, dj_set


def test_export_endpoint_writes_one_importable_file():
    """AC-1/3/4/5: one file, the set's name, its tracks in order, the columns filled."""
    from fastapi.testclient import TestClient

    import tempfile
    from pathlib import Path

    from backend.main import app

    client = TestClient(app)
    with tempfile.TemporaryDirectory() as tmp:
        _song, dj_set = _seed(client, Path(tmp))
        res = client.get(f"/api/sets/{dj_set['id']}/export/rekordbox")

    assert res.status_code == 200
    assert res.headers["content-type"].startswith("application/xml")
    assert "attachment" in res.headers["content-disposition"]

    root = ET.fromstring(res.content)
    node = root.find("PLAYLISTS/NODE/NODE")
    assert node.get("Name") == "Gallop Pre-Halloween"
    assert node.get("Entries") == "1"

    entry = root.find("COLLECTION/TRACK")
    assert entry.get("AverageBpm") == "129.20"
    assert entry.get("Tonality") == "Am"
    assert entry.get("Genre") == "Tech House"
    assert entry.get("Rating") == "204"  # rank 4
    assert entry.get("Comments") == "long blend"
    assert entry.get("TotalTime") == "245"


def test_export_endpoint_refuses_an_unknown_set():
    from fastapi.testclient import TestClient

    from backend.main import app

    client = TestClient(app)
    assert client.get("/api/sets/nope/export/rekordbox").status_code == 404
