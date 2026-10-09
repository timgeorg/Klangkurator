---
source: auto
tags:
  - index
---
# Index — Klangkurator (repo root)

- [[.gitignore]] — Git exclusions for build artifacts, node_modules, Python cache, and local configuration.
- [[.impeccable/]] — Design process and review artifacts (development-only, never shipped); surfaces hold design briefs, live/config.json is design-tool configuration, design.json is machine-readable tokens sidecar, and build/mocks/questions/review/decision files are working outputs.
- [[AGENTS.md]] — Repository rules for agent workflows: branch naming, PR gates, design principles, sandbox setup for testing.
- [[DESIGN.md]] — Record of the built visual world: token values, typography rules, component color schemes, interaction patterns, and design decisions.
- [[PRODUCT.md]] — Product specification: users, purpose, core constraints, and product principles guiding feature decisions.
- [[README.md]] — Project overview, feature list, technology stack, and getting-started instructions.
- [[Requirements.md]] — The original master spec; the domain detail now lives in docs/requirements/, which is where behaviour changes are specified first.
- [[backend/]] — FastAPI server: JSON storage, audio analysis, library scan, preview playback, and API endpoints for the frontend.
- [[components.json]] — Shadcn/ui configuration; maps component generator to the project's source structure.
- [[design-system/]] — Reusable editorial design system: color tokens, typography stack, Tailwind preset, self-hosted fonts and assets.
- [[docs/]] — The numbered requirements tree with its changelog, the build and redesign plans (including the redesign behaviour contract), and the MVP roadmap.
- [[eslint.config.js]] — ESLint rules for code quality and style consistency.
- [[index.html]] — Main HTML entry point; loads Vite and applies theme synchronously to prevent flash before mount.
- [[package.json]] — npm dependencies (React 18, Vite, TypeScript, Tailwind, shadcn/Radix, react-router, react-query) and the dev, build and lint scripts.
- [[package-lock.json]] — Locked dependency versions for reproducible installs.
- [[postcss.config.js]] — PostCSS configuration; chains Tailwind into the CSS build.
- [[public/]] — Static assets served as-is: robots.txt and any files that bypass the build pipeline.
- [[requirements.txt]] — Python dependencies for the backend (FastAPI, Uvicorn, Pydantic, Mutagen for tags, PyWebView for the desktop window, librosa for BPM/key analysis).
- [[run.sh]] — Launcher script supporting dev (backend + Vite dev server), server (backend only, serves dist), desktop (PyWebView), and stop/status commands.
- [[src/]] — Frontend source code: React components, pages, hooks, utilities, services layer, and styling.
- [[tailwind.config.ts]] — Tailwind configuration; applies design-system token presets and theme overrides.
- [[tsconfig.json]] — Root TypeScript configuration that references the app and tooling configs and sets the @/ path alias.
- [[tsconfig.app.json]] — TypeScript config for the frontend in src/; the typecheck gate runs against it.
- [[tsconfig.node.json]] — TypeScript config for build tooling files (vite.config.ts, eslint.config.js).
- node_modules/ — Installed npm packages (not committed).
- dist/ — Built frontend artifacts (not committed); created by `vite build`.
