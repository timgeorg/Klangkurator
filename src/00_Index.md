---
source: auto
tags:
  - index
---
# Index — src

- [[App.tsx]] — Root React component; sets up providers (theme, react-query, tooltip, router, player) and defines the route table (index, load-files, song detail, sets, settings, 404).
- [[main.tsx]] — Entry point: applies the stored cover style (black and white or original colours) and mounts App at #root.
- [[index.css]] — Global stylesheet; imports design-system fonts/tokens/base, chains Tailwind, and defines the k-shell app layout grid (rail + main + player).
- [[vite-env.d.ts]] — TypeScript type definitions for Vite client-side build features.
- [[components/]] — Components by domain: brand (mark, wordmark, shapes, covers), detail (song-page pieces), dj (library table, player, dialogs), layout (shell, rail, headers, sections, empty states), sets (set and block lists and editors), ui (restyled shadcn primitives and app controls).
- [[hooks/]] — React hooks: the library column layout, media queries, the mobile breakpoint and toasts.
- [[lib/]] — Data access and shared logic: the API client and storage layer, appearance preferences, player state, genre config, the entity palette, relationship line styles, track display formatting, class-name helper.
- [[pages/]] — Route components: Index (library table), LoadFiles (import and scan), SongDetailPage (track metadata and edit), Sets (set planner), Settings (library and UI preferences), NotFound (404).
- [[services/]] — Legacy data service layer with factory pattern; not currently used by the app (replaced by direct API calls to backend).
