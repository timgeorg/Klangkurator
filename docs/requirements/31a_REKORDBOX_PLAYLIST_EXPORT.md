# Rekordbox Playlist Export (from a Set)

Status: Proposed (issue #67)
Last Updated: 2026-10-30
Source: Tim, 2026-10-30 (verbatim ask at the end) + Pioneer's official
`XML file format for playlists sharing`

## The ask (Tim, 2026-10-30, verbatim)
> *"Ist es theoretisch möglich aus so einem Set eine rekordbox playlist zu erstellen? Oder wie macht man das normalerweise?"*

## Short answer

Yes, and it is the supported way: **Rekordbox imports a playlist from an XML
file.** Pioneer publishes the format (`XML file format for playlists sharing`,
version 1.0.0), and its own *Preferences → Advanced → Database → rekordbox xml*
path both writes that file and reads one back. No Rekordbox database is touched,
no proprietary library is parsed, and nothing needs to be installed.

The practical catch is not the format, it is the **file location**: a
`Location` in that XML is an absolute `file://` URI, so an exported XML is bound
to the machine and the drive where the audio lives. Two ways out, both normal:

1. **Export on the machine that holds the music.** Rekordbox resolves the paths
   itself. This is what a local-first tool should do.
2. **Export a copy bundle** (XML + the audio files) for a USB stick, and let
   Rekordbox import from there. Bigger, but portable.

## How people normally do this

Four routes exist in the wild, in order of how well they fit this app:

| Route | What it does | Fit |
|---|---|---|
| **rekordbox XML** (`DJ_PLAYLISTS`) | Rekordbox imports the file as playlists. Works on every Rekordbox version, free and paid | **The one to build.** Text file, no binary format, the spec is published, and it round-trips |
| **M3U8** | Plain text playlist of paths. Rekordbox reads it | Simpler, but it carries no BPM, key, rating or comment — a Klangkurator set would arrive as a bare list |
| **`master.db` (SQLite)** | Write into Rekordbox's own database | Fragile: the schema is undocumented and version-bound, Rekordbox must be closed, and a bad write corrupts the collection. Not worth it |
| **Drag and drop from the Finder** | Manual | What people do who have no tool for it |

So: XML. It is the format Rekordbox itself exports, which means our file is the
same shape as the one Rekordbox writes — and that is also how it can be tested
without Rekordbox in the loop.

## The format, as much as we need

Pioneer's element list, reduced to what a set export writes:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<DJ_PLAYLISTS Version="1.0.0">
  <PRODUCT Name="Klangkurator" Version="0.1.0" Company=""/>
  <COLLECTION Entries="2">
    <TRACK TrackID="1" Name="…" Artist="…" Genre="…" Kind="MP3 File" Size="9928456"
           TotalTime="204" AverageBpm="132.00" Tonality="Gm" Rating="0"
           DateAdded="2026-10-30" Location="file://localhost/media/tim/…/track.mp3"/>
    <TRACK TrackID="2" … />
  </COLLECTION>
  <PLAYLISTS>
    <NODE Type="0" Name="ROOT" Count="1">
      <NODE Name="Gallop Pre-Halloween" Type="1" KeyType="0" Entries="2">
        <TRACK Key="1"/>
        <TRACK Key="2"/>
      </NODE>
    </NODE>
  </PLAYLISTS>
</DJ_PLAYLISTS>
```

Facts that matter, each from the spec or measured against a real export:

- **`Location`** is a URI, not a path: `file://localhost/` plus the
  percent-encoded absolute path. A space, `#` or non-ASCII character must be
  encoded, and those are common in this library (`#MUSIC`, `Don't`, `Böhmer`).
- **`TotalTime`** is whole seconds.
- **`AverageBpm`** is a float with two decimals.
- **`Tonality`** is Rekordbox's own spelling (`Gm`, `F#m`, `Ab`). Klangkurator
  stores the short standard form already, so most values pass through; the
  sharps/flats that Rekordbox writes with flats (`A#` vs `Bb`) need a mapping,
  because the same key written differently is a different key to a human.
- **`Rating`** is not 1–5: `0, 51, 102, 153, 204, 255`. Klangkurator's `rank`
  (0–5 stars) maps onto it by that table.
- **`TrackID` / `Key`**: `TrackID` is unique inside the file; a playlist entry
  references it by `Key`. They need not match any Rekordbox id.
- **`Entries`** must equal the real count on both `COLLECTION` and the leaf
  `NODE`, or Rekordbox refuses or truncates.
- **Only tracks that are in a playlist need to be in `COLLECTION`.** The spec
  says the entries of tracks in no playlist "are unnecessary" and that
  `Location` is essential for each track — so a set export stays small.

## What a Klangkurator set export writes

- **One `NODE Type="1"` per set.** Its name is the set name.
- **The order is the set's `position` order.** That is the point of exporting a
  set rather than a crate.
- **Per track**, the fields the spec has a slot for and the app actually knows:
  `Name`, `Artist`, `Genre` (main genre), `Size`, `TotalTime`, `AverageBpm`,
  `Tonality`, `DateAdded`, `Comments` (the transition note — this is where the
  set planning survives the trip), `Rating` (from `rank`).
- **Nothing invented.** No `Tonality` when the key is unknown, no
  `AverageBpm="0"` when BPM is missing — an absent attribute is better than a
  wrong one, and Rekordbox shows an empty cell either way.
- **Variants (issue #65):** the primary's path, because that is the file that
  plays.

## Options worth having in the same dialog

- **Split by phase.** A set with `phases` exports as nested `NODE`s, so
  Rekordbox shows the phases as playlist folders. The flat `items` model has no
  phases today, so this waits for the phase editor.
- **One file per set, or all sets in one file.** A single file is friendlier for
  Rekordbox (one import) and is the default.
- **Copy the audio alongside.** Writes the XML under a folder beside copies of
  the tracks, so the result is a USB-ready bundle.

## Acceptance
1. When the user exports a set, the app writes one XML file that Rekordbox
   imports without an error, and the playlist appears with the set's name.
2. The playlist holds exactly the set's tracks, in the set's order.
3. BPM, key, genre and the transition note arrive in Rekordbox's matching
   columns.
4. A track with no BPM or no key exports without that attribute, not with a
   `0`/empty value.
5. A path containing a space, `#`, an apostrophe or a non-ASCII character
   imports as a found track, not as a missing file.
6. A set with 47 tracks produces an XML under 100 KB and an export that takes
   under 1 second.
7. `Entries` matches the real count on every node.
8. Exporting all sets writes one file, and each set is its own `NODE`.
9. The export never writes into Rekordbox's `master.db`.

## Files in scope
- `backend/services/rekordbox_xml.py` — the writer, pure and unit-testable
- `backend/api/sets.py` — `GET /api/sets/{id}/export/rekordbox`
- `src/pages/Sets.tsx` / `SetEditor.tsx` — the export action
- `backend/tests/test_rekordbox_xml.py` — the cases above
- `docs/requirements/30_REKORDBOX_INTEGRATION.md` (section 2 becomes built),
  `99_CHANGELOG.md`

## Not in scope
- **Reading a Rekordbox XML back** (cue points, play counts, a library sync).
  That is section 1 of `30_REKORDBOX_INTEGRATION.md` and a separate ticket.
- **Writing `master.db`.** Never.
- **Recreating Rekordbox's analysis.** We write our BPM and key; Rekordbox
  keeps its own and may show its own value for a track it has analysed.
- **USB export with a full Rekordbox database.** The XML plus copies is the
  first step; a device-ready database is a different problem.

Branch: `feat_<this issue>_rekordbox-playlist-export` from `main`.
