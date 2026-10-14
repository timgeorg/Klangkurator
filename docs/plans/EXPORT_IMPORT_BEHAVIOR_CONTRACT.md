# Behavior contract — export/import metadata (issue #10)

Written before implementation (playbook: user-facing behavior change → contract,
judged source-blind by the Validator). Decisions stated where Tim's answer was
given; the autonomous calls carry a `〔decision〕` mark.

## Envelope

**EC-1** — **Given** the user clicks Export in Settings
**when** the file downloads
**then** it is `klangkurator-library-YYYY-MM-DD.json` and its content is
`{"format": "klangkurator-library", "version": 1, "exported_at": <iso>, "data":
{songs, tags, song_tags, song_relationships, playlists, playlist_songs, blocks,
sets}}` — the whole store, `_config` excluded 〔decision: machine-local〕.

**EC-2** — **Given** a file with a foreign `format` or unknown `version`
**when** import preview runs
**then** it is rejected with a clear message — no partial write.

## Match / merge semantics

**MC-1 Match order** — a track is matched by: ① exact `file_path`, ②
`artist`+`title`+`duration` within ±2 s, ③ exact `artist`+`title`. First hit
wins; earlier keys take precedence.

**MC-2** — **Given** files moved on disk (paths differ, composite key matches)
**when** imported
**then** the local track is matched, **no new duplicate is created**, and the
local `file_path` is **never overwritten** 〔decision: paths are machine-truth〕.

**MC-3 Conflict** — a conflict is any of the user-metadata fields where **both
sides have a non-empty value and they differ**. Conflicting fields:
`energy`, `danceability`, `social_acceptance`, `rank`, `bpm`, `musical_key`,
`year`, `main_genre`, `drum_notes`, `element_notes`, `mixing_notes`,
`transition_notes`, `lyrics`, `phase_tags`, `vibe_tags`.
Emptiness: rating `0` = unset, `None`/`""` for strings, `[]` for arrays.
**Given** one side empty
**then** the value fills in silently (fill-never-clobber, INV-5's principle)
— filling is not a conflict.

**MC-4 The popup (Tim's decision)** — **Given** the preview reports conflicts
**when** the import dialog opens
**then** each conflict row shows the track (title — artist) and its fields
local → imported, each with an **overwrite yes/no** control (default **no** —
local wins), plus a checkbox **"Apply to all conflicts"** that sets the same
answer on every row at once. Confirm applies exactly the chosen resolutions.

**MC-5 Ids** — matched tracks keep their **local** id (INV-1: never
re-assigned); added tracks get **fresh** uuids (a foreign uuid is never written
verbatim → the collision hazard cannot corrupt an unrelated track). Join rows
resolve through the export-id → local-id remap.

## Tags

**TC-1** — tags are matched **by exact `name`** 〔decision: names are Tim's
stable thing〕. **Given** a tag name absent locally **then** it is created with
the exported color. Same name → local tag kept (color included), join rows
point at the local tag.

**TC-2** — **Given** a song↔tag join already exists locally
**then** it is not duplicated.

## Other stores

**OC-1** 〔decision: full restore on a empty machine, skip when both sides have
data〕 — **Given** playlists/relationships/blocks/sets are present in the export
and the corresponding local store is **empty**
**when** imported
**then** they are imported wholesale with song references remapped to local ids.
**Given** the local store is **non-empty**
**then** those entities are **skipped and reported** (merge for them is not
built; nothing is destroyed).

**OC-2** — **Given** the preview confirms
**when** the import executes
**then** the response repeats the summary (matched / filled / added /
conflicts applied / skipped) and the UI toasts it; the library reloads.

## UI

**UC-1** — Settings gains the **"Backup & Export"** section (where
`17_SETTINGS.md` says it lives): Export button (downloads the file) and an
Import file-picker. `17_SETTINGS.md`'s "replaces all data" wording is corrected
to merge semantics in the same change.

**UC-2** — **Given** the picked file is not valid JSON / not the export format
**when** it is chosen
**then** the dialog shows an error, nothing imports.

**UC-3** — viewport/theme: the dialog and section render at 1440/1280/768/375
in both themes without body horizontal scroll.

## Out of scope (this feature)

- Destructive full-restore (replace-everything incl. deletions) — the import
  merges; a true restore is a deliberate future mode.
- Per-field conflict resolution inside a track (per-track rows, as Tim asked).
- A content hash / audio fingerprint identity key (composite string key now;
  the envelope's `version` leaves room to change identity later).