# Non-Functional Requirements

Status: Active
Last Updated: 2026-08-09
Source: Requirements.md section 14

## NFR Table

| ID | Category | Requirement |
|---|---|---|
| NFR-1 | Security | No authentication, no cloud, no Supabase — fully local |
| NFR-2 | Backup | Full JSON export/import of entire library (songs, tags, relationships, playlists, blocks, sets) |
| NFR-3 | Performance | Handle ~1,000–5,000 songs comfortably in the library table |
| NFR-4 | Performance | Memoize filter options; avoid render loops in filter popovers |
| NFR-5 | Performance | Set planning board must handle 50–100 tracks in the pool without lag |
| NFR-6 | Architecture | Clean architecture: small focused components, no dead code, no debug logs in committed code |
| NFR-7 | Architecture | Memoize derived state, stable callbacks |
| NFR-8 | Data | Idempotent seed data; stable IDs across reloads |
| NFR-9 | Data | `clearData()` must clear all dependent stores to avoid stale references |
| NFR-10 | Portability | Phase 1 runs in any modern browser; Phase 2 runs as PyWebView desktop app |
| NFR-11 | Usability | Notes editing must be inline and fast — no dialog required for routine note-taking |