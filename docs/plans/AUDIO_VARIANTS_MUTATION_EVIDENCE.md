# Mutation evidence — audio variants (issue #65)

Each mutation breaks one rule, the suite is run, and the mutation is restored.
A test that does not fail is not guarding anything.

| # | Mutation | Files that fail |
|---|---|---|
| 1 | `library_store.make_primary` keeps the old `file_path` instead of the promoted one | `test_make_primary_swaps_paths_and_keeps_every_other_field`, `test_a_second_make_primary_returns_to_the_start` |
| 2 | `audio.choose_playable` drops the variant loop | `test_playback_falls_back_to_a_variant_when_the_primary_is_gone` |
| 3 | `import_merge.merge_variants` rewrites the imported path to the local one | `test_merge_variants_keeps_the_local_path_and_adds_the_imported_one` |
| 4 | `library._song_within_duration` drops the title requirement | `test_unrelated_files_of_a_similar_length_are_added_not_offered` |
| 5 | `analyze_one_song` always reports `octave_disagreement=False` | `test_an_octave_disagreement_reports_both_numbers` |
| 6 | `AudioVariant` stops deriving `missing` | `test_the_listing_marks_a_missing_primary_and_variant`, `test_import_adds_a_variant_to_a_matched_track` |
| 7 | `playableFile` ignores `primary_missing` | three `playableFile` tests |
| 8 | `filesOf` hides the variant list | four `filesOf` / `fileFacts` tests |
| 9 | `octaveApart` loses the halving branch | `octaveApart > flags the measured pair` |

Two rules the tests caught during the build, before any mutation:

- A duration-only attach offer claimed two 0.2 s test tones as one recording.
  `test_people_rating.py` and `test_scan_job.py` failed, and the title
  requirement was added (mutation 4 now guards it).
- The scan result grew `offered` and `offers`, so two exact-dict assertions
  failed. They were updated to the new shape.
