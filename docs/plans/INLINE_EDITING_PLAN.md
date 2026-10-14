---
source: session
tags:
  - plan
  - library
status: active
created: 2026-10-13
---
# Plan — inline editing in the library table (issue #3)

Tim's request: "I want all properties be directly editable by clicking on it
in the main table view. Like I can add notes and tags now, I'd also like to
edit genre, subgenre by directly clicking on it. Same for Dance, Energy and
Social Score."

Behavior to verify: [[INLINE_EDIT_BEHAVIOR_CONTRACT]].

## Scope

In: every user-owned property shown as a column.

| Column | Editor |
|---|---|
| Artist, Album | Text field in place |
| BPM | Text field in place; "127,5" and "127.5" both parse, 40–250, one decimal |
| Key | Picker: 24 keys in the analyser's notation ("Am") with the full name |
| Genre | Picker: the genres from Settings (localStorage `dj_database_genre_config`) |
| Subgenres | Checklist of the genre's subgenres, with Create |
| Energy, Dance, Social | Direct click on a bar (mouse); slider keys; a 44px picker on touch |
| Lyrics | Opens the existing LyricsDialog |
| Notes | Unchanged behavior, moved onto the shared text editor |
| Tags | Unchanged |

Out:
- **Title** stays the link to `/song/:id` (PF-17); a click can't both navigate and edit.
- **Cover, Waveform, Time, Crate** come from the file or the scan.
- Year, drum and element notes aren't columns.

## Interaction and presentation semantics

- **Resting state:** a value looks as it does today. Hover adds the inline-edit
  fill (`bg-accent`, 6px corners), the pointer cursor; keyboard focus adds the
  ring. The fill spans the whole cell (negative margin, text stays aligned with
  the header label), so the whole cell is the target.
- **Commit model:** every change saves at once, with no Save button, like tags.
  Text fields commit on Enter or blur, cancel on Escape; pickers commit on
  choice; ratings commit on click or key.
- **Toggle vs always-open:** Genre and Key pickers close on choice. The
  Subgenres checklist stays open for several toggles and closes on Escape or an
  outside click. The rating sets on click (no popover), except on touch, where
  a tap opens a 44px picker because a 9px bar can't be hit with a finger.
- **Focus:** after Enter or Escape in a text field, and after any picker
  closes, focus is back on the cell (Radix popover returns focus to its trigger;
  the text editor and rating picker restore it explicitly).
- **Stable rows:** an edit never moves or hides its row. The displayed order
  freezes on the first edit and thaws when search, filters or sort change (see
  Algorithm contract).
- **Invalid text:** Enter keeps the field open, marked invalid, with the reason
  in a tooltip anchored to the field. Blur restores the old value and a toast
  names the reason.
- **Failure:** a failed save shows a destructive toast; once queued writes have
  drained, the library reloads from the backend, so the table shows what was
  saved. If the backend is down, that reload fails into the existing "library
  didn't load" state with Try again.
- **Genre change keeps subgenres.** The edit dialog clears them because it is a
  staged form you can cancel. An inline change saves at once, and the Subgenres
  column may be off-screen, so clearing there would lose data unseen.

## Data flow trace

1. `SongLibrary` holds `songs` (from `GET /api/songs`). The displayed `rows`
   come from `filteredSongs`, or from the frozen id list (below). They go to the
   memoised `SongTableRow`.
2. A cell calls `onPatch(songId, patch: SongPatch)`. The callback is stable
   (`useCallback`, no changing deps), so the memo holds.
3. `patchSong` freezes rows, then applies the patch optimistically:
   `null` deletes the field, anything else sets it. It then queues the write.
4. The write queue sends `PUT /api/songs/{id}` (via `storage.updateSong`).
   - One request is in flight at a time.
   - Patches made while a request is in flight merge per song and go next.
   - Server responses are not written back: the optimistic state is the
     truth until a failure reloads.
5. The backend applies the fields that were sent (`exclude_unset`). An
   explicit null clears only the `_CLEARABLE` fields (default None): album,
   bpm, musical_key, mainGenre, genre, genres, mixing_notes, lyrics.
   - `artist` is never sent empty; the UI refuses it.
   - Ratings are sent as 0–5 ints, never null.
   - `subgenres` is always sent as a list.
6. **Serialisation:** `mainGenre` is the alias of `main_genre`
   (`populate_by_name=True`). Both the dialog and these patches send
   `mainGenre`.
7. **Genre resolution:** the displayed genre is
   `mainGenre || genres[0] || genre`, shared as `trackGenre(song)` in
   `trackFormat.ts`. 91 of the 92 real tracks have only the legacy `genre`
   field from file tags, so this fallback is the common case.
8. **Genre patch.** Legacy fields mirror the edit dialog:
   - set: `{mainGenre: g, genre: g, genres: [g, ...subgenres]}`
   - clear: all three null
9. **Subgenre patch.** It sends the effective genre along, which promotes a
   legacy-only genre to `mainGenre` without changing what is shown:
   `{subgenres, mainGenre: eff, genre: eff, genres: [eff, ...subgenres]}`.
   With no effective genre, the patch is `{subgenres}` only.
10. **Missing fields:** ratings default to 0 (backend `int = 0`). The TS `Song`
    marks optional fields with `?`, so applying null deletes the key.

## Hook dependency ordering (SongLibrary, 15+ hooks)

Every consumer is declared after what it reads:

1. State: songs, tags, search, filters, sort, dialogs, lyrics song.
2. `viewKey`, `viewKeyRef`, frozen state, `rowsRef`, `freezeRows`. It reads
   refs only, so it is safe to call from any later handler.
3. The writer ref and `loadAllData`. `loadAllData` first awaits
   `writer.idle()`. The writer's error handler calls it through
   `loadAllDataRef`, so neither depends on declaration order.
4. Effects.
5. `handleTagsChange` (uses `freezeRows`), then `patchSong`.
6. `filterOptions`, `crateCounts`, `filteredSongs`, then the `rows` memo, then
   the effect that drops a stale freeze.
7. The edge effect keyed on `rows.length`.

A `useCallback` whose deps array names a `const` declared later throws a TDZ
error on render (PM-8). That is the reason for this order.

## Algorithm contract — frozen rows

- `viewKey = JSON.stringify([searchQuery, filters, sort])`.
- `freezeRows()`:
  - if a freeze exists under the current `viewKey`, keep it;
  - else store `{key: viewKey, ids: ids of the rows on screen now}`.
- **Inclusion predicate:**
  - if `frozen && frozen.key === viewKey`, then `rows` is `frozen.ids` mapped
    to the current song objects, skipping ids that no longer exist;
  - else `rows = filteredSongs`.
- **Thaw:** an effect drops the freeze when `viewKey` changes. Typing a search
  and deleting it again therefore never brings an old frozen order back.
- **Worked example.** Sorted by Energy ascending: A(0), B(2), C(4).
  1. Set A's energy to 5.
  2. `songs` now has A(5). `filteredSongs` would be B, C, A, but the freeze
     shows A(5), B(2), C(4).
  3. Click the Energy header (the sort changes to descending): the freeze
     drops, and the rows become A(5), C(4), B(2).
- **Boundary.**
  - With an Energy ≥ 3 filter, lowering a row to 1 keeps it visible until the
    next filter, search or sort change.
  - The header count shows the rows on screen.
  - The "No track matches" state uses `rows.length`.

## Write queue (`src/lib/songWriter.ts`)

```ts
write(id, patch): pending.set(id, {...pending.get(id), ...patch}); if (!running) running = drain()
drain: while (pending.size) { take first; await storage.updateSong; on error onError(...) } running = null
idle(): running ?? Promise.resolve()
```

`running = null` runs in the same synchronous step as the empty check, so a
write can't slip in between.

## Backend hardening

`BaseStore._save` writes every save to the same `library.tmp`. Two concurrent
saves (an inline edit during the background analysis thread, or two requests
in the threadpool) can interleave on that file. `os.replace` can then install
mixed JSON.

The fix: a `threading.Lock` around the dump and replace. The regression test
runs concurrent PUTs, then checks that `library.json` parses and holds every
write.

## Files

- New `src/components/dj/InlineCells.tsx`: `CellButton`, `TextCell`,
  `GenreCell`, `KeyCell`, `SubgenresCell`, `RatingCell`.
- New `src/lib/songWriter.ts`: the write queue.
- `SongTableRow.tsx`: the cells use the editors.
  - Props: `onPatch` and `onOpenLyrics` replace the four notes props.
- `SongLibrary.tsx`:
  - Removed: the notes draft state and its handlers (the old path is
    deleted).
  - Added: `patchSong`, the freeze, the writer, the lyrics dialog.
  - The focus-scroll handler ignores focus inside portaled popovers.
- `popover.tsx`: export `PopoverAnchor`.
- `trackFormat.ts`: `trackGenre`, `MUSICAL_KEYS` (moved from
  `EditSongDialog`), `parseBpm`.
- `backend/storage/base_store.py`: the lock. New test
  `backend/tests/test_concurrent_writes.py`.
- Docs:
  - Requirements: 13 (columns and inline interaction), 12 (genre display and
    editing), 90 (NFR-11 widened), 99 changelog.
  - Design: `DESIGN.md` (inline-edit affordance, interactive meter).
  - Indexes: `docs/plans`, `src/components/dj`, `src/lib`, `backend/tests`.

## Verification

- **Gates:** tsc (no new errors), eslint on the changed files, vite build,
  pytest, `impeccable detect`.
- **Tester:** screenshots of every editor open, in ink and paper, at 1440,
  1280, 768 and 375px, against a sandbox library (`HOME=` override, ports
  8001/8081 range, never 8000/8080).
- **Validator:** source-blind, on a different model, against the contract,
  saving `results.json` after every clause.
- **Design review:** the impeccable finish reviewer on the new affordances.
