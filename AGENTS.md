# AGENTS.md — Klangkurator

Local-first DJ library organizer: React + Vite + TypeScript + Tailwind (shadcn/ui) on a FastAPI backend with JSON storage in `~/.klangkurator/`. Runs as a PyWebView desktop window or in a browser, offline.

## Where the truth lives

- `PRODUCT.md`: users, purpose, constraints, product principles.
- `docs/requirements/`: numbered specs. Behavior changes go through the spec before the code; update the matching file and `99_CHANGELOG.md` in the same change.
- `design-system/README.md`: the visual rules (tokens, type, components, patterns). `DESIGN.md` records the built world.
- `.impeccable/surfaces/`: development-only design briefs. Never copy them into source, comments or the DOM.

## Branches and PRs

- One branch per issue: `<type>_<issue#>_<slug>` (e.g. `feature_1_editorial-design-system`, `fix_12_set-save`). Bare `<type>/<slug>` only when no issue exists; say why in the PR.
- **Two-stage flow: feature branch → `int` → `main`.** A feature PR targets `int`;
  `main` only ever advances by merging `int`. `int` is the integration line where
  changes land first, `main` is what ships.
- **`Closes #N` does not fire from a PR into `int`** — GitHub only auto-closes on
  the repository's default branch, which is `main`. So a feature PR into `int`
  leaves its issue open by design, and the open-issue delta
  (`closed in int, not yet in main`) *is* the release manifest.
- **Shipping closes the issues.** At the `int` → `main` merge, close every issue
  the release carries — the `int`→`main` PR body should name them and use no
  auto-close keyword, precisely so the closure is an explicit act:
  `gh issue close <N> --comment "Shipped — released in main."` This step has been
  forgotten once (issue #6 shipped in `main` and stayed open); it belongs in the
  release checklist, not in memory.

## Gates before a PR

- `npx tsc --noEmit -p tsconfig.app.json`: no errors.
- `python -m pytest backend/tests` (in the project's Python environment): passes. The tests point `HOME` at a throwaway folder, never the real library.
- `npx eslint <changed files>`: no new problems.
- `npx vite build`: passes.
- Live check of every changed view in both themes (ink and paper) at 1440, 1280, 768 and 375 px, against a sandbox, never the real library.

## Sandbox (never test against the real library)

```sh
# copy of the library into a scratch HOME, backend on :8001, dev server on :8081
mkdir -p /tmp/kk-sandbox && cp -r ~/.klangkurator /tmp/kk-sandbox/.klangkurator
HOME=/tmp/kk-sandbox python -m uvicorn backend.main:app --port 8001
KLANGKURATOR_API=http://127.0.0.1:8001 npx vite --port 8081
```

The backend derives its data directory from `$HOME`; `KLANGKURATOR_API` points the dev server's `/api` proxy at another backend.

## Design rules that are easy to break

- Use tokens only (`bg-background`, `text-signal-text`, …). No raw hex or Tailwind palette colours (`orange-500`, `red-400`) in components; the only inline colours are users' own genre/tag/block/set colours.
- Orange means "this one": current track, selection, focus, the one primary action, the mark. Never a category colour.
- Inter for the interface, Literata for editorial moments, Geist Mono for data only. No eyebrow label above a heading.
- Every hover-revealed action is also revealed on keyboard focus and has an accessible name.
- Covers go through `CoverArt`, waveforms through `Waveform`, user colours through `ColorChip` / `SwatchPicker`.
- Fonts and assets are self-hosted; never load anything from a CDN (the app runs offline).
- An element with both the `hidden` attribute and a display utility (`flex`, `inline-flex`, `grid`) stays visible, because the utility wins over the attribute. Add `[&[hidden]]:hidden` to such elements.
