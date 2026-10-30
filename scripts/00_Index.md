---
source: auto
tags:
  - index
---
# Index — scripts

- [[check_code_standards.py]] — The repo's copy of the vault's `code-standards-gate` (docstrings, logging, complexity, declared scope), run by the pre-commit hook on staged Python files.
- [[repair_audio_variants.py]] — The one-off Levex repair (issue #65): attaches the `.wav` row as a variant of the `.mp3` row and drops the emptied row only when no set, block, playlist or relationship refers to it. Dry run by default, writes only with `--apply`, and backs the data files up first.
- [[make-synthetic-library.ts]] — The phase 6 fixture generator (plan › Phases row 6): writes a sandbox `library.json` shaped for one track-map cluster fixture (the TM-C1–TM-C10 shapes), run with `npx vite-node scripts/make-synthetic-library.ts -- --count 1200 --genres 9 --out <sandbox>/.klangkurator/library.json`. It **reuses** `src/lib/trackMap/syntheticLibrary.ts` and only turns its options into a file; never the real library (AGENTS.md). Development-only: nothing in the app imports it, so it never reaches the built bundle.

The scale measurement behind the phase 6 numbers is `src/lib/trackMap/measure-track-map.ts` (`npx vite-node src/lib/trackMap/measure-track-map.ts`), beside the phase 3 calibration `src/lib/trackMap/calibrate.ts`. See `docs/plans/TRACK_MAP_PLAN.md` › Phase 6 — the scale measurement, and `docs/requirements/90_NFRS.md` › NFR-12.
