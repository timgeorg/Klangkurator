# Plan — audio variants: one track, several files (issue #65)

Written before the build, against `docs/requirements/18_AUDIO_VARIANTS.md`.

## Shape

The track row keeps one primary path and gains a list. Nothing that already
reads `file_path` changes: `GET /api/audio/{song_id}`,
`GET /api/audio/waveform/{song_id}`, the export envelope and the scan's path
lookup all keep working. That constraint decides the data shape — a list beside
`file_path`, not a `files[]` array with a `primary` flag.

## Steps, in build order

1. **Model.** `AudioVariant` in `backend/models/song.py`, `audio_variants` on
   `SongBase` and `SongUpdate`. Two derived keys, `missing` per variant and
   `primary_missing` per song, computed in model validators. `library_store`
   strips `missing` on every write, so it can never reach `library.json`.
2. **Store.** `find_song_by_any_path` (the scan's guard and the attach's
   conflict check), `add_variant`, `remove_variant`, `make_primary`. The last one
   needs the demoted file's own facts, so it takes them from the caller.
3. **Endpoints.** `POST /{id}/variants`, `POST /{id}/variants/{vid}/primary`,
   `DELETE /{id}/variants/{vid}`. Format facts come from
   `scanner/metadata.file_facts`, which uses mutagen once per attach.
4. **Playback.** `choose_playable` in `backend/api/audio.py` and the same rule in
   `src/lib/audioVariants.playableFile`. The response names the served file.
5. **Scan.** `_import_file` stops treating an artist+title match as a silent
   skip. It records an offer instead, counts it separately, and returns the
   offers in the result. Nothing is attached without a click.
6. **Import merge.** `merge_variants` unions by path. Added songs mint fresh
   variant ids.
7. **UI.** Badge in the title cell, Files section in the dialog and on the page,
   the offer list on the Import page, the octave report in the re-analyze popup,
   the played-file line in the player.
8. **Docs.** `11_SONG_MODEL`, `18_AUDIO_VARIANTS`, `21_DATA_MODEL_LIBRARY_JSON`,
   `91_INVARIANTS` (INV-16, INV-17), `99_CHANGELOG`.
9. **The one-off repair.** A script, dry run by default.

## Risks and how each is handled

| Risk | Handling |
|---|---|
| A duration-only match claims unrelated tracks of similar length | Require a normalised title too. Found during the build by two existing tests. |
| `missing` going stale in `library.json` | Derived on read, stripped on write, INV-16, and a test that reads the file back. |
| A variant silently becoming the analysis target | The job walks song rows. A test asserts a variant path never appears in `_songs_missing_bpm`. |
| An import rewriting a variant path | Union by path, `file_path` is never in `CONFLICT_FIELDS` (INV-11), test per case. |
| The Levex repair damaging a set | The script refuses to drop a row any set, block, playlist or relationship refers to, and prints what it would do first. |

## Out of scope, as the ticket says

Choosing a "better" file automatically, transcoding, analysing a variant to
settle a disagreement, deduplicating the rest of the library.
