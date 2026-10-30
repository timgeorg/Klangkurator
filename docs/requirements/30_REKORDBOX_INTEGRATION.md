# Rekordbox Integration

Status: Planned (Post-MVP)
Last Updated: 2026-08-09
Source: User refinement 2026-08-09

## Principle

**Rekordbox stays the core of playing.** Klangkurator does not replace it.
Klangkurator reads from and writes to Rekordbox, adding curation and set
planning capabilities that Rekordbox doesn't have.

## Integration Points

### 1. Cue Points (Read + Write)

**Read:** Parse Rekordbox export (XML or SQLite database) and import cue
points as song metadata. Each cue point becomes a note on the song:
- Position (timestamp)
- Label (if named in Rekordbox)
- Color ( Rekordbox cue colors map to Klangkurator tags)
- Type (cue, loop, hot cue)

**Write:** Export Klangkurator cue points / mix points back to Rekordbox
XML format so they appear in Rekordbox after re-import.

### 2. Playlist Export

**Built 2026-10-30** (issue #67). The spec is [[31a_REKORDBOX_PLAYLIST_EXPORT]].
It carries the XML shape, the URI encoding rules, the rating table and the
acceptance. Rekordbox imports a playlist from that XML file, and the app writes the
same file Rekordbox itself exports.

`GET /api/sets/{id}/export/rekordbox` answers the file, and each set card on the
Sets page carries an export action. The export:

- writes one `NODE Type="1"` for the set, ordered by the set's `position`.
- fills only the attributes the spec has a slot for. A missing BPM and a missing key
  are left out.
- expands a block into its tracks, in place.
- puts the set's transition note in `Comments`.
- maps the 0–5 `rank` onto Rekordbox's six rating values.
- encodes the path as `file://localhost/…`. A space, `#`, apostrophe or non-ASCII
  letter in the library root then still resolves.

Writing `master.db` stays out of scope: the schema is undocumented and bound to a
Rekordbox version, and a bad write corrupts the collection.

**Not built yet:** the optional crate/folder structure and the split by phase.
One file holds one `NODE` per set; a phase split waits for the phase editor.

### 3. USB Export

Export a set for USB use on CDJ/XDJ:
- Copy audio files to USB in Rekordbox-compatible folder structure
- Generate playlist XML
- Optionally include Rekordbox database export on the USB
- Handles file path resolution (finds the actual audio file on disk)

### 4. Bidirectional Sync (Future)

- Detect changes in Rekordbox library (new tracks, renamed playlists,
  updated cue points, ratings) and sync back to Klangkurator
- Detect changes in Klangkurator (new notes, tags, set plans) and sync
  to Rekordbox
- Conflict resolution: manual merge dialog when both sides changed

## Technical Approach

### Rekordbox Export Format
Rekordbox exports a `rekordbox.xml` file containing:
- Library tracks (with IDs, paths, BPM, key, cue points)
- Playlists (tree structure, with track references)

Klangkurator parses this XML to read; generates it to write.

### Database Access (Advanced)
Rekordbox 6+ uses a SQLite database (`master.db`). Direct database access
is possible but fragile across versions. XML export/import is the safe path
for MVP. Direct DB access is a future optimization.

### File Path Resolution
- Rekordbox stores file paths relative to its library root
- Klangkurator needs to map between Rekordbox paths and its own `file_path`
- Mapping is done by artist + title fingerprint, not by path (paths differ
  across machines and USB sticks)