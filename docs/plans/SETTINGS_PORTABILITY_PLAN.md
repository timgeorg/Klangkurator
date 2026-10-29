# Technical plan — settings and genres into the data folder (issue #51)

Spec: `docs/requirements/17_SETTINGS.md` (Preferences), `12_TAGS_AND_GENRES.md`,
`20_DATA_MODEL_OVERVIEW.md`, `21_DATA_MODEL_LIBRARY_JSON.md`, `90_NFRS.md`
(NFR-2). Branch: `feature_51_settings-portability` from `main` (post-#59).
Issue: #51, PF-89.

## Verified facts (2026-10-29, `main` @ 3cbca5d)

- Seven settings live only in `localStorage`: genres (`dj_database_genre_config`,
  `src/lib/genreData.ts`), columns (`klangkurator.columnConfig.v1`),
  map (`klangkurator.map.v1`), theme (`klangkurator.theme.v1`), covers
  (`klangkurator.covers.v1`), dock (`klangkurator.player.dock.v1`), volume
  (`klangkurator.player.volume.v1`).
- `BaseStore._load` starts empty on a JSON error, and the next save overwrites
  the file (`backend/storage/base_store.py:24-32`).
- `webview.start(debug=True)` leaves pywebview's `private_mode` at its default
  `True`, which disables HTML5 storage in the GTK backend.
- `getGenreConfig()` has no try/catch around `localStorage.getItem`.
- The genre list is outside both `library.json` and the export envelope.
- Nine files import `genreData`; all call only its exported functions, so the
  functions keep their signatures.
- `17_SETTINGS.md` names two preferences that do not exist in code (default
  phase names, default set duration); a set carries its own
  `target_duration_min`. They stay out of scope.

## Decisions

Already made in issue #51 and followed here, not reopened: preferences go to a
fourth data file `settings.json`; genres go to `library.json` as `genres`;
settings travel by copying the folder; a one-time migration from `localStorage`
loses nothing; theme keeps a browser copy for the first paint only; the desktop
window runs with `private_mode=False`; an unreadable data file is preserved;
the unbuilt set defaults stay out; #49's collapse choice moves here.

Three implementation choices this plan adds:

1. **No new store singleton for genres.** They are library content, so they live
   in `LibraryStore` next to tags (`get_genres` / `set_genres`), which keeps one
   writer per file. `settings.json` gets its own small store.
2. **`settings.json` is validated on write, not on read.** `PUT` rejects an
   unknown key or wrong type with 422 and writes nothing. A file written by a
   future version with extra keys is returned as-is, so an older app never
   destroys it.
3. **The migration runs in the browser, once.** Only the browser can read
   `localStorage`. `src/lib/settings.ts` posts the seven legacy values on first
   load when the files have none, then sets a marker. Files win afterwards.

## Files in scope

- `backend/config.py`, `backend/storage/base_store.py`,
  `backend/storage/settings_store.py`, `backend/storage/library_store.py`,
  `backend/storage/__init__.py`, `backend/storage/00_Index.md`
- `backend/api/settings.py`, `backend/api/__init__.py`, `backend/api/00_Index.md`
- `backend/api/misc.py`, `backend/services/import_merge.py`
- `backend/pywebview_launcher.py`
- `backend/tests/test_settings.py`, `test_export_import.py`, `00_Index.md`
- `src/lib/settings.ts`, `src/lib/genreData.ts`, `src/lib/appearance.ts`,
  `src/lib/PlayerContext.tsx`, `src/lib/00_Index.md`
- `src/hooks/useColumnConfig.ts`, `src/hooks/useMapConfig.ts`
- `src/components/dj/NowPlaying.tsx`, `src/components/dj/SongLibrary.tsx`
- `src/App.tsx`
- `docs/requirements/12,13,17,20,21,90,92,99`, `PRODUCT.md`, `AGENTS.md`
- `docs/plans/00_Index.md`

## Steps

### Backend

1. **`config.py`**: `SETTINGS_FILE = DATA_DIR / "settings.json"`.
2. **`base_store.py`**: on a JSON error, rename the unreadable file to
   `<name>.corrupt-<UTC timestamp>` and log at ERROR, then start empty. This
   covers every data file, not just the new one.
3. **`settings_store.py`** (new): `SettingsStore` over `BaseStore` exposing
   `get_all()` and a `put(patch)` that validates top-level keys and types
   (422 via `ValueError`) and shallow-merges.
4. **`library_store.py`**: `genres` joins the top-level keys; `get_genres()` and
   `set_genres(list)` with name validation (non-empty, unique, case-insensitive).
5. **`storage/__init__.py`**: `get_settings_store()`.
6. **`api/settings.py`** (new): `GET /api/settings`, `PUT /api/settings`,
   `GET /api/genres`, `PUT /api/genres`. Wire it in `api/__init__.py`.
7. **`api/misc.py`**: the export envelope gains `genres`.
8. **`services/import_merge.py`**: importing `genres` merges by name — a missing
   genre is added, an existing one keeps its colour and gains missing
   subgenres; `genres` is optional so older exports import.
9. **`pywebview_launcher.py`**: `webview.start(debug=True, private_mode=False,
   storage_path=<~/.klangkurator/webview>)`.

### Frontend

10. **`src/lib/settings.ts`** (new): loads both documents once through a
    `<SettingsGate>` that shows a skeleton until they arrive; an in-memory copy
    with synchronous getters; a 300 ms debounced `saveSettings(patch)`; a failed
    save toasts and keeps the value for the next attempt; and the one-time
    legacy migration from the seven `localStorage` keys.
11. **`genreData.ts`**: the getters and setters read and write the in-memory copy
    and debounce a save; `localStorage` is read only by the migration.
12. **`appearance.ts`, `PlayerContext.tsx`, `NowPlaying.tsx`,
    `useColumnConfig.ts`, `useMapConfig.ts`**: read from the settings copy and
    write through `saveSettings`; the theme keeps its `localStorage` write for
    the first paint.
13. **`SongLibrary.tsx`**: the crate collapse choice moves from `localStorage`
    to `settings.json` (`crateTabsExpanded`).
14. **`App.tsx`**: `<SettingsGate>` wraps the app.

### Docs

15. `17_SETTINGS.md` (storage, the new endpoints, the corrupt-file rule),
    `12_TAGS_AND_GENRES.md` (genres in `library.json` and the export),
    `20_DATA_MODEL_OVERVIEW.md` (four files), `21_DATA_MODEL_LIBRARY_JSON.md`
    (`genres`), `90_NFRS.md` (NFR-2 genres in the backup), `13_LIBRARY_VIEW.md`
    (REQ-13-CT stores the collapse choice in `settings.json`),
    `92_PLANNED_FEATURES.md` (PF-89 Built), `99_CHANGELOG.md`, `PRODUCT.md`
    (backup/export is built; settings are files), `AGENTS.md`, both indexes.

## Tests

- `test_settings.py`: `GET` on no file is `{}`; `PUT` merges shallowly and
  returns the document; an unknown key and each wrong type is 422 and leaves the
  file byte-identical; a value written by a future version survives a write;
  genres round-trip; a duplicate or blank genre name is 422; an unreadable
  `settings.json` is preserved as `*.corrupt-*` and the app starts.
- `test_export_import.py`: the envelope carries `genres`; importing into a
  library without them adds them; an existing genre keeps its local colour and
  gains missing subgenres; an envelope without `genres` still imports.

## Gates

`python -m pytest backend/tests` · `npx tsc --noEmit -p tsconfig.app.json` (0
errors) · `npx eslint <changed files>` · `npx vitest run` · `npx vite build` ·
`code-standards` · live check against a sandbox in both themes at 1440, 1280,
768 and 375 px, plus the click-through of every setting.

## PR

Into `int`, titled for #51. No `Closes` keyword.
