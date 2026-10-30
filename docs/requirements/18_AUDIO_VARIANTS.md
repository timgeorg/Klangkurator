# Audio Variants (File Versions Of One Track)

Status: Proposed (issue #65)
Last Updated: 2026-10-30
Source: Tim, 2026-10-30 (see the verbatim ask below)

## The problem

One track often exists as more than one audio file. The author owns the same
Levex remix as a `.mp3` and a `.wav`.

The `.wav` is the lossless copy worth playing. The `.mp3` carries the embedded
cover and the tags. Both files hold the same music, played once. The library
holds them as **two unrelated tracks**.

Today that costs the library in four ways:

1. **The table shows the same track twice.** Two rows carry two ids, two
   ratings and two note fields. Rating one row and not the other is a silent
   lie. The app cannot tell the user that the second row is the same track.
2. **BPM and key are detected per file.** Measured on 2026-10-30 with the real
   pair, the `.mp3` read **66.3 BPM** and the `.wav` read **132.0 BPM**. That is
   the same music, an octave apart in the estimate. A set built from the 66 row
   is out of key with the floor. A set built from the 132 row is right. The
   author re-ran the per-track analysis on the `.mp3` by hand to repair it. Both
   rows now read 132.0.
3. **Notes and ratings fork.** A `transition_notes` written on the `.wav` says
   nothing to a later query that picks the `.mp3`.
4. **The scanner's artist+title guard half-hides it.** `_import_file` skips a
   file when `library_store.find_song_by_artist_title` finds a match. A re-scan
   therefore never adds the second copy. The pair exists only because both files
   were seen before either id was stored. No rule in the app states that these
   two files are one track.

The `.wav` also has **no embedded artwork and no useful tags**. Its
`artwork_url` is `null`, and its `artist` fell back to `"Skrillex"` from the
filename. The `.mp3` carries `artist="Levex"` from its ID3 tags. That is normal
for a `.wav`. It is also why discarding the `.wav` is not an option. The `.wav`
is the master.

## The ask (Tim, 2026-10-30, verbatim)
> *"66 ist falsch. Vor allem, wenn es bei dem .wav der selben Version keine Probleme gab. Wir müssen irgendwas neues noch einbauen, dass es 2 Varianten (Audio Files) vom gleichen Track geben kann. So wird eins immer als Primary angezeigt und das andere ist als Duplicate angehängt. Damit werden beide nicht in der Library gleichzeitig angezeigt. Levex wäre so ein Fall, weil es die .mp3 und die .wav gibt von genau dem gleichen Track. Und WAV haben logischerweise kein Cover oder so, sind aber trotzdem wichtig zu haben."*

## The model

A **track** is one row in the library and one entry in a set. A track has **one
primary audio file** and **zero or more variants**. A variant is another file
of the same recording.

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
  unchanged. The readers are `GET /api/audio/{song_id}` and
  `GET /api/audio/waveform/{song_id}`. The export envelope and the scan's path
  lookup read the same field. This is why the variants sit in a list beside it
  instead of in a new `files[]` array.
- **A variant is not a song.** A variant has no id in the song namespace. It has
  no BPM, key, rating, note, tag or relationship. All of those belong to the
  track, once.
- **The track's BPM, key and duration come from the primary.** A variant records
  its own duration for two reasons. The UI can then say when the copies really
  differ, for example a radio edit next to the extended mix. A broken primary can
  also give way to a working variant without a new analysis.
- **Format facts are stored, not derived at render time.** `.wav` files are tens
  of megabytes. The pair above is 9.9 MB as mp3 and 36 MB as wav. Probing every
  row on every listing is not acceptable.

## Behaviour

### Library list
- **One row per track.** The table, the crate counts, the search, the filters,
  the sort and the track map see the track, not its files.
- **A row whose track has variants shows a marker.** The marker is a small
  stacked badge with the count, next to the format or the title. It states a fact
  about the row. It is not a control that expands inline.
- **The row's duration and waveform come from the primary.**

### Song detail and edit dialog
- **A "Files" section lists the primary first, then each variant.** Each line
  shows format, duration, file size and the path. It also shows bitrate, sample
  rate and bit depth where those are known.
- **Each variant offers two actions.** These are *Make primary* and *Detach from
  track*.
  - *Make primary* swaps `file_path` with the variant's path. The old primary
    becomes a variant. BPM, key, ratings, notes and tags do not change.
  - *Detach from track* removes the variant from the track. **The file stays on
    disk** and the song row survives. A confirmation says so.
- **The primary is marked and cannot be detached directly.** The UI offers
  *Make primary* on another variant first. When the track has only one file, the
  UI offers to take the whole track off the library instead.

### Sets, blocks and playlists
- A set item references the **track**. Playback picks the primary.
- **When the primary's file is missing on disk and a variant exists, playback
  uses the variant.** The UI says which file it played. This is the one case
  where the primary is not what plays. It is a repair, not a preference.

### Scanning
- **A file whose absolute path matches a stored primary or variant is skipped.**
  That is today's behaviour.
- **A file whose artist+title matches an existing track is attached as a variant
  instead of being skipped.** The existing track keeps its id, ratings, notes,
  tags and sets. The new file joins `audio_variants`.
  - For a `.wav` with no tags, the artist+title match uses the filename-derived
    values `"Skrillex"` and `"Scary Monsters…"`. Those will not equal the
    `.mp3`'s tag-derived pair `"Levex"`. **The scan therefore offers the attach
    in the Import page's result list instead of applying it silently.** Applying
    it is one click, the same as the import-merge conflict popup. The scan also
    proposes the attach for a duration match within ±2 s.
  - A file attached as a variant records `added_at`. The Import page then
    reports "3 variants attached" beside "12 added, 4 skipped".
- **A variant file never becomes its own song row.**

### Analysis
- **BPM and key are analysed once per track, from the primary.**
- **A half-tempo disagreement between primary and variant is reported, not
  averaged.** The re-analyze popup shows `primary 132.0 / variant 66.3` and
  offers the double/halve repair explicitly. This is the case that produced the
  bug above.
- The library-wide job never analyses a variant.

### Export and import
- `audio_variants` travel in the envelope. An import never rewrites a variant
  `file_path`, so INV-11 holds for variants too. A variant whose path does not
  exist on the target machine stays in the list and is marked as missing in the
  UI. The import does not drop it, because the author's machine may be the only
  place the file exists.

## What this is not
- **Not the relationship graph.** `same_sample`, `remix`, `bootleg`, `edit` and
  friends link *different* music. A variant is the *same* recording. A variant
  never appears as a relationship edge and never changes the track map's
  similarity.
- **Not a removal of the file.** Detaching a variant takes it off the track. The
  file stays on disk.
- **Not a merge of two existing song rows into one.** That repair, the Levex pair
  today, is a one-off data repair listed below. The feature keeps the next pair
  from forking.

## Data repair (one-off, in the same change)

The real pair exists now in `library.json` as two rows: `40a2ace1…` for the mp3
and `f08a9c70…` for the wav. The change attaches the `.wav` to the `.mp3` row as
its variant. It then removes the now-empty second row. It does that **after**
confirming that no set, block, playlist or relationship references that id.

## Acceptance

1. The scan offers to attach a second file of a known track.
2. Applying the attach offer adds no new song row.
3. The library table shows one row for a track with variants.
4. That row shows a count badge for its variants.
5. The song detail lists the primary and every variant with format, duration,
   size and path.
6. The primary is marked in that list.
7. *Make primary* swaps the paths and keeps every other field.
8. The next playback uses the new primary's file.
9. When the primary's file is missing and a variant exists, playback plays the
   variant.
10. The UI names the file that playback used.
11. BPM and key are analysed from the primary only.
12. The library-wide job never analyses a variant.
13. An octave disagreement between primary and variant shows both numbers in the
    re-analyze popup.
14. The popup offers the repair. It never silently picks one.
15. An export carries `audio_variants`.
16. An import keeps every variant and never rewrites its path.
17. An import marks a variant with a missing file instead of dropping it.
18. Detaching a variant leaves the file on disk.
19. Detaching a variant leaves the track row intact.
20. After the data repair, the Levex pair reads as one row with two files.
21. Every set item that referenced `40a2ace1…` still resolves.

## Files in scope
- `backend/models/song.py` — `AudioVariant`, `audio_variants` on base and update
- `backend/storage/library_store.py` — variant CRUD, the artist+title lookup the
  attach needs
- `backend/api/songs.py` — the attach, make-primary and detach endpoints
- `backend/api/library.py` — the scan's attach offer and result counters
- `backend/services/import_merge.py` — carry variants through an import
- `src/lib/storage.ts` — types and the three calls
- `src/components/dj/SongLibrary.tsx`, `InlineCells.tsx` — the row badge
- `src/components/dj/EditSongDialog.tsx` — the Files section
- `backend/tests/`, `src/**/*.test.ts` — the cases in Acceptance
- `docs/requirements/11_SONG_MODEL.md`, `18_AUDIO_VARIANTS.md`,
  `21_DATA_MODEL_LIBRARY_JSON.md`, `91_INVARIANTS.md`, `99_CHANGELOG.md`

## Not in scope
- **Automatic detection of a "better" file** from bit depth, sample rate or
  lossless encoding. The user picks the primary. The app suggests nothing.
- **Transcoding**, or generating an `.mp3` preview from a `.wav`.
- **Analysing a variant to settle a disagreement.** The popup offers the repair.
  The user decides.
- **Deduplicating the rest of the library.** This change builds the mechanism. A
  later pass can offer the same attach for tracks that already forked.

## Open question for the ticket

Should a variant exist **without** a primary track? That is, should the scan
collect a lone `.wav` as a track in its own right and later join it? The
simplest answer is no. A lone file is a normal song row. Attaching it later turns
it into a variant. This is written down here so the ticket does not invent the
opposite.
