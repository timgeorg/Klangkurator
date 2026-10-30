# Behaviour contract — audio variants (issue #65)

Judged against the running app, source-blind. Each clause is a given/when/then.

## BC-1 — the scan offers a second file

Given a library holding a track, and a folder holding a second file of the same
recording that the scan has not met,
when the user scans that folder,
then the Import page lists the file under "Files of tracks you already have",
names the track it matches, and states the match ("Same length as" or "Same
artist and title as"). The library gains no row.

## BC-2 — the offer applies as a variant

Given the offer from BC-1,
when the user presses "Attach as variant",
then the line reads "Attached" and the library still holds one row for that
track.

## BC-3 — one row per track, with a badge

Given a track with a variant,
when the library table lists it,
then it appears once, and its title cell carries a badge reading "2" (or the
total file count).

## BC-4 — the Files list

Given a track with a variant,
when the user opens the track's page or its edit dialog,
then a Files section lists the primary first and marked "Primary", then each
variant. Every line states the format, the duration, the size and the full path.

## BC-5 — make primary

Given the Files list of BC-4,
when the user presses "Make primary" on a variant,
then the two files swap places: the pressed file is marked "Primary" and the
former primary becomes a variant. BPM, key, ratings, notes and tags read the
same as before.

## BC-6 — playback after the swap

Given BC-5,
when the user plays the track,
then the audio served is the new primary's file.

## BC-7 — playback falls back, and says so

Given a track whose primary file the user has moved away, and one variant whose
file is present,
when the user plays the track,
then the variant plays and the player shows a line naming that file.

## BC-8 — the octave report

Given a track whose stored BPM is 132.0 and a variant whose own reading is 66.3,
when the user opens the re-analyze popup,
then it shows "primary 132.0 / variant 66.3" and offers a BPM range for the
repair. It never states that one of the two is the right value, and closing the
popup changes nothing.

## BC-9 — analysis follows the primary

Given a track with a variant,
when the library-wide analysis runs,
then the variant's file is never analysed, and a per-track re-analysis reads the
primary's file only.

## BC-10 — detach

Given the Files list of BC-4,
when the user presses "Detach from track" and confirms,
then the variant leaves the list, the track's row still exists with its other
fields intact, and the file is still in its folder on disk.

## BC-11 — export carries the files

Given a track with a variant,
when the user exports the library,
then the exported song carries `audio_variants` with that variant's path.
