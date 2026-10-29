# Non-Functional Requirements

Status: Active
Last Updated: 2026-10-23
Source: Requirements.md section 14

## NFR Table

| ID | Category | Requirement |
|---|---|---|
| NFR-1 | Security | No authentication, no cloud, no Supabase — fully local |
| NFR-2 | Backup | Full JSON export/import of entire library (songs, tags, relationships, playlists, blocks, sets) → built in Settings (PF-83, issue #10); the import merges and asks before overwriting, it never replaces |
| NFR-3 | Performance | Handle ~1,000–5,000 songs comfortably in the library table |
| NFR-4 | Performance | Memoize filter options; avoid render loops in filter popovers |
| NFR-5 | Performance | Set planning board must handle 50–100 tracks in the pool without lag |
| NFR-6 | Architecture | Clean architecture: small focused components, no dead code, no debug logs in committed code |
| NFR-7 | Architecture | Memoize derived state, stable callbacks |
| NFR-8 | Data | Stable IDs across reloads (the backend mints each once). There is no sample-data seeding since the mock layer was removed (#57) |
| NFR-9 | Data | *Retired 2026-10-23 (#57):* it bound the mock layer's `clearData()`; the app has no clear-all operation |
| NFR-10 | Portability | Phase 1 runs in any modern browser; Phase 2 runs as PyWebView desktop app |
| NFR-11 | Usability | Editing must be inline and fast: notes, tags, genre, subgenres, key, BPM, artist, album and the two ratings (energy, people) change in the library table, no dialog required |
| NFR-12 | Performance | The track map (PF-81) stays smooth to pan and zoom at 1,000–5,000 tracks by collapsing into clusters past a node threshold. The threshold, the cluster parameters and the re-solve time are measured on synthetic libraries of 500, 1,000 and 5,000 tracks before they are fixed, then recorded here. **Fixed (phase 6, 2026-10-15):** node threshold `T` = 500; cluster band `C_MIN` = 4, `C_MAX` = 60; limits — 95th-percentile pan frame ≤ 33 ms, re-solve ≤ 3 s. No web worker: the re-solve is O(T²) at worst (124,750 pairs at 500 tracks) and O(N) + O(c²) with c ≤ 60 above `T`, so it stays inside the budget without one. Measurements and their harness: `docs/plans/TRACK_MAP_PLAN.md` › Phase 6 — the scale measurement; `src/lib/trackMap/measure-track-map.ts` |