---
source: auto
tags:
  - index
---
# Index — docs/plans

- [[PHASE_0_PROJECT_SETUP.md]] — FastAPI scaffold, directory structure, dependencies, health check endpoint.
- [[PHASE_1_STORAGE_AND_MODELS.md]] — Pydantic models matching TS interfaces, JSON file stores (library/blocks/sets), atomic writes.
- [[PHASE_2_API_AND_SCANNER.md]] — CRUD endpoints for all entities, mutagen metadata extraction, library scan, crate listing.
- [[PHASE_3_FRONTEND_INTEGRATION.md]] — RemoteStorage class, async migration of 20 components, LoadFiles update, Vite proxy.
- [[PHASE_4_DESKTOP_PACKAGING.md]] — PyWebView launcher, static file serving, native folder picker, clean shutdown.
- [[PHASE_5_ANALYSIS_PROGRESS.md]] — audio analysis progress job (REQ-10-AP): in-memory job + polled status endpoint, frontend progress bar; includes testing guide T1-T4.
- [[BACKLOG_ORCHESTRATION.ipynb]] — working notebook for the six library-UX backlog features (PF-12..PF-17): sprint board, per-feature subtasks, verification cells, session log.
- [[PLAYER_RUN_PLAN.md]] — plan for the player stepping through a run (issue #5, PF-80): Tim's decisions, the queue model, data flow, interaction semantics, files.
- [[PLAYER_RUN_BEHAVIOR_CONTRACT.md]] — Given/When/Then contract for next/previous and auto-advance (issue #5), judged black-box against a sandbox copy of the library.
- [[TRACK_MAP_PLAN.md]] — plan for the track map (issue #8, PF-81): shared types, the similarity/cluster/transition algorithm contract, and seven phases as PRs into int.
- [[TRACK_MAP_BEHAVIOR_CONTRACT.md]] — Given/When/Then contract for the track map (issue #8), grouped by phase, judged black-box against a sandbox copy of the library.
- [[REDESIGN_BEHAVIOR_CONTRACT.md]] — Given/When/Then contract for the editorial redesign (issue #1), judged black-box against a sandbox copy of the library.
- [[TRACK_RANKING_PLAN.md]] — plan for the per-track 1–5 star rank (issue #4): decisions, data flow, gotchas, files.
- [[TRACK_RANKING_BEHAVIOR_CONTRACT.md]] — Given/When/Then contract for the track rank (issue #4), judged black-box against a sandbox copy of the library.
- [[DECIMAL_ENERGY_PLAN.md]] — plan for one-decimal ratings (issue #7): verified facts, model widening, meter flooring, per-field slider step, docs.
- [[DECIMAL_ENERGY_BEHAVIOR_CONTRACT.md]] — Given/When/Then contract for the decimal ratings (issue #7), judged black-box against a sandbox copy of the library.
- [[INLINE_EDITING_PLAN.md]] — Plan for inline editing in the library table (issue #3): scope, interaction semantics, data flow, frozen rows, write queue, backend save lock.
- [[INLINE_EDIT_BEHAVIOR_CONTRACT.md]] — Given/When/Then contract for inline editing (issue #3), judged black-box against a sandbox copy of the library.
- [[EXPORT_IMPORT_PLAN.md]] — plan for the whole-store export + merge import (issue #10): identity key, conflict popup, endpoint rework, files.
- [[EXPORT_IMPORT_BEHAVIOR_CONTRACT.md]] — Given/When/Then contract for export/import (issue #10), judged black-box against a sandbox copy of the library.
- [[REANALYZE_PLAN.md]] — plan for the per-track re-analyze with a BPM range hint (issue #6): probed facts on librosa priors, the in/out-of-window decision, lock policy, files.
- [[REANALYZE_BEHAVIOR_CONTRACT.md]] — Given/When/Then contract for the per-track re-analyze (issue #6), judged black-box against a sandbox copy of the library.
- [[JOB_PROGRESS_PLAN.md]] — technical plan for issue #46: scan and analysis as background jobs, one at a time, progress toast, Abort.
- [[JOB_PROGRESS_BEHAVIOR_CONTRACT.md]] — given/when/then clauses for #46, judged source-blind by the Validator.
- [[PEOPLE_RATING_PLAN.md]] — technical plan for issue #48: `people` replaces `danceability` and `social_acceptance`, no compatibility.
- [[PEOPLE_RATING_BEHAVIOR_CONTRACT.md]] — given/when/then clauses for #48, judged source-blind by the Validator.
- [[CRATE_TABS_PLAN.md]] — technical plan for issue #49: crate tabs collapse past 10, Shift+click multi-select.
- [[CRATE_TABS_BEHAVIOR_CONTRACT.md]] — given/when/then clauses for #49, judged source-blind by the Validator.
- [[MCP_SERVER_PLAN.md]] — technical plan for issue #47: the three backend prerequisites, the 24-tool surface, the mcp 2.x API, and the three open questions answered.
- [[MCP_SERVER_BEHAVIOR_CONTRACT.md]] — given/when/then clauses for #47, judged source-blind by the Validator with curl and an MCP client.
- [[SETTINGS_PORTABILITY_PLAN.md]] — technical plan for issue #51: preferences into `settings.json`, genres into `library.json`, the one-time migration, and the corrupt-file guard.
- [[LAZY_ROWS_PLAN.md]] — plan for lazy library rows (issue #63): the prefix rule, the pure step function, the observer root, the reset key and the files.
- [[LAZY_ROWS_BEHAVIOR_CONTRACT.md]] — Given/When/Then contract for lazy rows (issue #63), judged black-box against a sandbox copy of the 1,907-track library.
