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
- [[REDESIGN_BEHAVIOR_CONTRACT.md]] — Given/When/Then contract for the editorial redesign (issue #1), judged black-box against a sandbox copy of the library.
- [[TRACK_RANKING_PLAN.md]] — plan for the per-track 1–5 star rank (issue #4): decisions, data flow, gotchas, files.
- [[TRACK_RANKING_BEHAVIOR_CONTRACT.md]] — Given/When/Then contract for the track rank (issue #4), judged black-box against a sandbox copy of the library.
- [[DECIMAL_ENERGY_PLAN.md]] — plan for one-decimal ratings (issue #7): verified facts, model widening, meter flooring, per-field slider step, docs.
- [[DECIMAL_ENERGY_BEHAVIOR_CONTRACT.md]] — Given/When/Then contract for the decimal ratings (issue #7), judged black-box against a sandbox copy of the library.
