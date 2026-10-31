# Music Locations And The Crate Registry — Plan (issue #11)

Status: Built 2026-10-31
Issue: #11 — "Crates outside the root: add music locations beyond the single root folder"
Spec: `docs/requirements/10_LIBRARY_AND_FILE_LOADING.md`, `21_DATA_MODEL_LIBRARY_JSON.md`, INV-18 to INV-25, PF-84
Contract: `docs/plans/MUSIC_LOCATIONS_BEHAVIOR_CONTRACT.md`

## Tim's two gating decisions (binding)

1. **The model is a list of music locations.** The single-root concept is
   replaced. Each location acts as a root for its own scan. There is no "one
   extra folder as a crate" side door.
2. **Crate identity is a crate registry.** Each crate has `id`, `name`,
   `location_path` in config as a real entity. Tabs and filters key on the crate
   id, and the screen shows the name. A name collision between locations stops
   being a bug by construction.

## What was wrong before

A crate was a **derived string**: `root_folder`, the file's parent relative to
the root. `crateOf()` fell back to the bare parent folder name, and the tabs and
the filter bucketed on that same string. Two folders called `House` in different
places gave one tab, one filter bucket and one count.

One root made that tolerable. A second location makes it a bug, and this
feature adds the second location.

## The data model

```json
"_config": {
  "music_locations": [{"id": "loc_…", "path": "/media/tim/Extreme SSD/#MUSIC"}],
  "crates": [{"id": "crate_…", "name": "house/deep",
              "location_path": "/media/tim/Extreme SSD/#MUSIC"}]
}
```

- A **music location** is a folder scanned as a root. The walk stays recursive,
  and every folder inside it holds crates. "Music location" names it in the UI.
  The scanning model stays as it was.
- A **crate** is a folder inside a location, at any depth. Its `name` is its
  path below the location (`house/deep`), which keeps the flattening the app has
  always done. A file directly in a location gives a crate named after it.
- Ids are **digests of the path**, not random uuids:
  `crate_id = digest(location_path, name)` and `location_id = digest(path)`.
  A crate therefore carries the same id on every run and on every machine. That
  is what lets a re-added location find its songs again.
- A song stores `crate_id`. The app looks up the name for the screen.
- A song removed with its location carries `missing_since`. The row stays.

`_config.root_path` is **consumed** by the migration. There is no derived
mirror: a second copy of the location list would be a second truth that can
disagree with the first.

## The migration (`backend/storage/crate_registry.py`)

A pure function over the `library.json` dictionary, so it is testable against a
copy of the real library and the store stays free of the rules. It runs on every
read of the store:

1. Read the registry from `_config`, keeping only the usable entries. A missing
   or corrupt registry is rebuilt from the song rows, never raised on.
2. For every song holding `root_folder`:
   - If the file sits under the old root, that root becomes the location and the
     crate name is the file's path below it.
   - Otherwise the file's own folder becomes a location, and the crate takes
     that folder's name. This is what found the 92 songs on a second drive.
   - If the resolved name differs from the stored name, the app logs both. It
     never renames a crate silently.
   - A row with no usable name or no path keeps its old value and appears in
     `songs_unresolved`. It is never dropped and never blanked.
3. Remove `_config.root_path`.
4. Repair a song whose `crate_id` the registry does not know, from its file
   path. Skip a song flagged `missing_since`: its crate is gone because the user
   removed the location, and a rebuild would undo the removal.
5. Give every crate's location an entry, so a crate can always be rescanned.
6. Write both lists in a stable order. `changed` is false when nothing moved, so
   a second read does not rewrite the file.

### Proof on the real library

18 checks on a copy of the 1,907-song file, then the same checks as tests:

| Check | Result |
|---|---|
| 1907 songs in → 1907 out | PASS |
| `root_folder` gone from every row | PASS |
| `crate_id` on every row, resolving to a registry entry | PASS |
| 27 distinct old names → 27 crates, each name to exactly one crate | PASS |
| no crate renamed | PASS |
| each song's folder agrees with its crate's path | PASS |
| `_config.root_path` consumed | PASS |
| second run: `changed: false`, dictionary identical | PASS |
| absent registry self-heals (27 crates rebuilt) | PASS |
| corrupt registry: string / junk / crate with no location | PASS (all three) |
| row with no path kept and reported | PASS |
| warnings on real data | 0 |

## API

| Endpoint | Change |
|---|---|
| `GET /api/library/locations` | new — the locations with `exists`, `crate_count`, `track_count` |
| `POST /api/library/locations` | new — register a folder, adopting the crates already under it |
| `DELETE /api/library/locations/{id}` | new — flag its songs missing, keep them |
| `GET /api/library/locations/{id}/crates` | new — one location's crates |
| `GET /api/library/crates` | `{id, name, location_path, track_count, missing_track_count}` |
| `POST /api/library/scan` | takes `location_id` and still accepts `root_path`. An absent folder gives a no-op with a warning |
| `GET /api/library/root`, `PUT /api/library/root` | **gone** |

The absent-location branch goes through the same job claim as a real scan.
Without that, a scan that ends at once would publish a "finished" status over a
running job's progress.

## Frontend

- `src/lib/crates.ts` — the registry on the client, loaded beside the settings
  and the genres, with the synchronous getters the table already used.
- `Song.crate_id` replaces `root_folder`. `crateOf()` returns the **id**.
  `crateName(id)` returns the name to show.
- The Crate column id is `crate`, migrated from a stored `rootFolder` in
  `settings.json`, so a saved layout keeps its column.
- The crate tabs keep their count and their collapse behaviour, keyed on ids and
  labelled with names. A tab's tooltip gives the crate's folder, so two crates
  with one name are told apart.
- **Settings** owns add / remove / rescan per location, with the "Not
  connected" marker for an absent folder. The remove dialog states that every
  track stays.
- **Import** stays the first-location flow and now lists every location.

## Not done, and why

- **The artist+title dedup trap** (PF-72, #10). The issue says to solve it, or
  at least not deepen it. Adding a location would make a gate WAV and a rip of
  the same track collide silently. The registry does not deepen it:
  `find_song_by_path` still runs first, so the same file under two locations is
  one song, and a test pins that. The content-aware key stays with #10 and
  PF-72, where the issue puts it.
- **A tree view of nested crates** (PF-11) stays unbuilt. The spec now says the
  app always flattens, which is what the code does.
- **A scan of all locations in one call.** The API takes one location per call,
  and Settings rescans the one you press. A batch start is not in the issue.

## Files

Backend: `backend/storage/crate_registry.py` (new),
`backend/storage/library_store.py`, `backend/api/library.py`,
`backend/models/song.py`, `backend/config.py`, `backend/tests/conftest.py`,
`backend/tests/test_crate_registry.py` (new), `backend/tests/test_browse_sandbox.py`,
`backend/tests/test_mcp_server.py`, `mcp_server/tools.py`.

Frontend: `src/lib/crates.ts` (new), `src/lib/crates.test.ts` (new),
`src/lib/trackFormat.ts`, `src/lib/storage.ts`, `src/lib/settings.ts`,
`src/lib/BackgroundJobsContext.tsx`, `src/lib/trackMap/{types,clusters,syntheticLibrary}.ts`,
`src/hooks/useColumnConfig.ts`, `src/components/dj/{libraryTable,SongLibrary,SongTableRow}.tsx`,
`src/components/dj/libraryTable.test.ts`, `src/pages/{Settings,LoadFiles,TrackMap,SongDetailPage}.tsx`.

Docs: `docs/requirements/{10,21,91,92,99}`, this plan, the contract, and the
`00_Index.md` files where a file is new.
