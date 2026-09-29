---
source: auto
tags:
  - index
---
# Index — dj-crate-explorer

- [[run.sh]] — launcher for all run modes (dev / server / desktop / status / stop), resolves the Python interpreter and reuses a running backend.
- [[README.md]] — project overview, current state, prerequisites, and how to run frontend and backend.
- [[Requirements.md]] — master spec and vision for the tool (song model, tags, relationships, blocks/sets).
- [[requirements.txt]] — backend Python dependencies (FastAPI, uvicorn, mutagen, pywebview, librosa).
- [[docs/]] — design and planning docs, including the road-to-MVP masterplan.
- [[backend/]] — Phase 2 Python/FastAPI backend: routes, storage, scanner, models, PyWebView launcher.
- [[src/]] — Phase 1 React + TypeScript frontend (pages, components, services, hooks).
- [[public/]] — static assets served as-is by Vite (favicon, placeholder, robots.txt).
- [[dist/]] — built frontend output, consumed by the backend for single-port serving (generated; gitignored).
- [[index.html]] — Vite HTML entry point for the frontend.
- [[package.json]] — frontend dependencies and npm scripts (dev, build, lint, preview).
- [[vite.config.ts]] — Vite config: port 8080, `/api` proxy to the backend on 8000, `@` path alias.
- [[tsconfig.json]] — root TypeScript project references.
- [[tsconfig.app.json]] — TypeScript compiler options for the app source.
- [[tsconfig.node.json]] — TypeScript compiler options for Node-side config files.
- [[tailwind.config.ts]] — Tailwind theme, content globs, and plugin setup.
- [[postcss.config.js]] — PostCSS pipeline (Tailwind + autoprefixer).
- [[eslint.config.js]] — ESLint flat config for the frontend source.
- [[components.json]] — shadcn/ui generator config (aliases, style, Tailwind paths).
- [[.env]] — Vite env vars, currently stale Supabase keys not used by the backend.
- [[.gitignore]] — ignores build output, node_modules, Python caches, and local Klangkurator data.
- [[package-lock.json]] — npm lockfile (generated).
- [[bun.lockb]] — legacy Bun lockfile from an earlier attempt (generated; unused).
- `.git/`, `node_modules/`, `__pycache__/` — version control, vendored deps, and bytecode caches; omitted here.
