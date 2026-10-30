# Audio Variants (File Versions Of One Track)

Status: Proposed (issue #65)
Last Updated: 2026-10-30
Source: Tim, 2026-10-30 (see the verbatim ask below)

## The problem

One track often exists as more than one audio file. The author owns the same
Levex remix as a `.mp3` and a `.wav`; the `.wav` is the lossless copy worth
playing, the `.mp3` carries the embedded cover and the tags. They are the same
music, played once — but the library holds them as **two unrelated tracks**.

Today that costs the library in four ways:

1. **The table shows the same track twice.** Two rows with two ids, two ratings,
   two note fields. Rating one and not the other is a silent lie: the app cannot
   tell the user that the second row is the same track.
2. **BPM and key are detected per file, and the half-tempo case bites.**
   Measured on 2026-10-30 with the real pair: the `.mp3` was detected at
   **66.3 BPM**, the `.wav` at **132.0 BPM** — the same music, an octave apart in
   the estimate. A set built from the 66 row is out of key with the floor; a set
   built from the 132 row is right. The author had to re-run the per-track
   analysis on the `.mp3` by hand to repair it (done; both now read 132.0).
3. **Notes and ratings fork.** A `transition_notes` written on the `.wav` says
   nothing to a later query that picks the `.mp3`.
4. **The scanner's artist+title guard half-hides it.** `_import_file` skips a
   file when an artist+title match exists (`library_store.find_song_by_artist_title`),
   so a re-scan never adds the second copy. That is why the pair exists only
   because both files were seen before either id was stored; it is not a rule
   the app states anywhere.

The `.wav` also has **no embedded artwork and no useful tags** — `artwork_url`
is `null` and `artist` fell back to `"Skrillex"` (from the filename) while the
`.mp3` carries `artist="Levex"` from its ID3 tags. That is expected for a `.wav`
and is exactly why discarding the `.wav` is not an option: it is the master.

## The ask (Tim, 2026-10-30, verbatim)
> *"66 ist falsch. Vor allem, wenn es bei dem .wav der selben Version keine Probleme gab. Wir müssen irgendwas neues noch einbauen, dass es 2 Varianten (Audio Files) vom gleichen Track geben kann. So wird eins immer als Primary angezeigt und das andere ist als Duplicate angehängt. Damit werden beide nicht in der Library gleichzeitig angezeigt. Levex wäre so ein Fall, weil es die .mp3 und die .wav gibt von genau dem gleichen Track. Und WAV haben logischerweise kein Cover oder so, sind aber trotzdem wichtig zu haben."*

## The model

A **track** is one row in the library and one entry in a set. It may have
**one primary audio file** and **zero or more variants** — other files of the
same recording.

```json
{
  "id": "uuid",
  "title": "Skrillex - Scary Monsters and Nice Sprites (Levex Remix)",
  "artist": "Levex",
  "file_path": "/music/…/…(Levex Remix).mp3",
  "audio_variants": [
    {
      "id": "uuid",
      "file_path": "/music/…/…(Levex Remix).wav",
      "format": "wav",
      "duration": 204.545,
      "bitrate": null,
      "sample_rate": 44100,
      "bit_depth": 24,
      "size_bytes": 36158234,
      "added_at": "2026-10-30T15:00:00Z"
    }
  ]
}
```

- **`file_path` stays the primary.** Every existing reader keeps working
  unchanged: `GET /api/audio/{song_id}`, `GET /api/audio/waveform/{song_id}`,
  the export envelope, and the scan's own path lookup. This is the whole reason
  the variants live in a list beside it rather than in a new `files[]` array.
- **A variant is not a song.** It has no id of its own in the song namespace, no
  BPM, no key, no ratings, no notes, no tags, no relationships. Those belong to
  the track, once.
- **The track's BPM/key/duration come from the primary.** A variant records its
  own duration only so the UI can say when the copies actually differ (a radio
  edit next to the extended mix), and so a broken primary can be swapped for a
  working variant without re-analysis.
- **Format facts are stored, not derived at render time.** `.wav` files are tens
  of megabytes (the pair above: 9.9 MB mp3, 36 MB wav); probing every row on
  every listing is not acceptable.

## Behaviour

### Library list
- **One row per track.** The table, the crate counts, the search, the filters,
  the sort and the track map see the track, not its files.
- **A row whose track has variants shows a marker** next to the format or the
  title (a small stacked badge with the count). It is a fact about the row, not
  a control that expands inline.
- **The row's duration and waveform are the primary's.**

### Song detail / edit dialog
- **A "Files" section lists the primary first, then each variant.** Each line
  shows format, duration, bitrate/sample rate/bit depth where known, file size
  and the path.
- **Actions per variant:** *Make primary* and *Remove from track*.
  - *Make primary* swaps `file_path` with the variant's path (the old primary
    becomes a variant). It does not touch BPM, key, ratings, notes or tags.
  - *Remove from track* detaches the variant; **the file is not deleted from
    disk** and the song row survives. A confirmation says so.
- **The primary is marked** and cannot be removed directly — the UI offers
  *Make primary* on another variant first, or, when the track has only one file,
  deleting the track.

### Sets, blocks, playlists
- A set item references the **track**. Playback picks the primary.
- **If the primary's file is missing on disk but a variant exists, playback uses
  the variant** and the UI says which file it played. This is the one case where
  the primary is not what plays; it is a repair, not a preference.

### Scanning
- **A file whose absolute path matches a stored primary or variant is skipped**,
  as today.
- **A file whose artist+title matches an existing track is attached as a
  variant** instead of being skipped. The existing track keeps its id, ratings,
  notes, tags and sets; the new file joins `audio_variants`.
  - For a `.wav` with no tags, the artist+title it is matched on are the
    filename-derived ones (`"Skrillex"` / `"Scary Monsters…"`), which will not
    equal the `.mp3`'s tag-derived pair (`"Levex"`). **The scan therefore offers
    the attach in the Import page's result list rather than doing it silently**,
    with the same one-click apply as the import-merge conflict popup, and it
    also proposes it for a duration match within ±2 s.
  - A file attached as a variant records `added_at`; the Import page reports
    "3 variants attached" beside "12 added, 4 skipped".
- **A variant file is never added as its own song row.**

### Analysis
- **BPM and key are analysed once per track, from the primary.**
- **A half-tempo disagreement between primary and variant is reported, not
  averaged.** The re-analyze popup shows `primary 132.0 / variant 66.3` and
  offers the double/halve repair explicitly. This is the case that produced the
  bug above.
- The library-wide job never analyses variants.

### Export / import
- `audio_variants` travel in the envelope. Variant `file_path`s are never
  rewritten by an import (INV-11 holds for them too); a variant whose path does
  not exist on the target machine is kept and marked as missing in the UI, not
  silently dropped — the author's machine may be the only place the file exists.

## What this is not
- **Not the relationship graph.** `same_sample`, `remix`, `bootleg`, `edit` and
  friends link *different music*. A variant is the *same* recording, so it never
  appears as a relationship edge and never changes the track map's similarity.
- **Not a delete.** Removing a variant detaches it; the file stays on disk.
- **Not a merge of two existing song rows into one.** That repair (the Levex
  pair today) is a one-off data fix, listed separately below; the feature's job
  is to keep the next pair from forking.

## Data repair (one-off, in the same change)
The real pair exists now in `library.json` as two rows
(`40a2ace1…` mp3, `f08a9c70…` wav). The change attaches the `.wav` to the
`.mp3` row as its variant and removes the now-empty second row, **after**
confirming that no set, block, playlist or relationship references that id.

## Acceptance
1. When the user scans a crate that holds a second file of a known track, the
   Import result offers to attach it, and applying the offer adds no new song row.
2. The library table shows one row for a track with variants, and a count badge
   on that row.
3. The song detail lists the primary and every variant with format, duration,
   size and path; the primary is marked.
4. *Make primary* on a variant swaps the paths, keeps every other field, and the
   next playback uses the new primary's file.
5. When the primary's file is missing and a variant exists, playback plays the
   variant and names the file it used.
6. BPM and key are analysed from the primary only; a variant is never analysed
   by the library-wide job.
7. When primary and variant disagree by an octave, the re-analyze popup shows
   both numbers and offers the repair. It never silently picks one.
8. An export carries `audio_variants`; an import keeps them, never rewrites their
   paths, and marks a missing one in the UI.
9. Removing a variant detaches it, leaves the file on disk, and leaves the track
   row intact.
10. The Levex pair reads as one row with two files after the data repair, and
    the set that used `40a2ace1…` still resolves.

## Files in scope
- `backend/models/song.py` — `AudioVariant`, `audio_variants` on base/update
- `backend/storage/library_store.py` — variant CRUD, the artist+title lookup the
  attach needs
- `backend/api/songs.py` — the attach and make-primary endpoints
- `backend/api/library.py` — the scan's attach offer and result counters
- `backend/services/import_merge.py` — carry variants through an import
- `src/lib/storage.ts` — types and the three calls
- `src/components/dj/SongLibrary.tsx`, `InlineCells.tsx` — the row badge
- `src/components/dj/EditSongDialog.tsx` — the Files section
- `backend/tests/`, `src/**/*.test.ts` — the cases in Acceptance
- `docs/requirements/11_SONG_MODEL.md`, `18_AUDIO_VARIANTS.md`,
  `21_DATA_MODEL_LIBRARY_JSON.md`, `91_INVARIANTS.md`, `99_CHANGELOG.md`

## Not in scope
- Automatic detection of which of two files is "better" (bit depth, sample rate,
  lossless) to pick the primary. The user picks; the app suggests nothing.
- Transcoding, or generating an `.mp3` preview from a `.wav`.
- Analysing a variant to settle a disagreement. The popup offers the repair; the
  user decides.
- Deduplicating the rest of the library. This change builds the mechanism; a
  later pass can offer the same attach for tracks that already forked.

## Open question for the ticket
Should a variant be able to exist **without** a primary track — that is, should
the scan be able to collect a lone `.wav` as a track in its own right and later
join it? The simplest answer is no: a lone file is a normal song row, and
attaching it later turns it into a variant. Written down here so the ticket does
not invent the opposite.
