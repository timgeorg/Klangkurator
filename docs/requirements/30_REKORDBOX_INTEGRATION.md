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

A planned set in Klangkurator can be exported as a Rekordbox playlist:
- Generate Rekordbox XML playlist format
- Preserves track order
- Includes crate/folder structure for organization in Rekordbox
- Option to export as a single playlist or split by phase (sub-playlists)

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