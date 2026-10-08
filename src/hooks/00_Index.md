---
source: auto
tags:
  - index
---
# Index — src/hooks

- [[use-media-query.ts]] — Custom React hook to detect CSS media queries (e.g., screen width) reactively; exports `useMediaQuery()` and the `WIDE_QUERY` constant for layout breakpoints.
- [[use-mobile.tsx]] — Mobile breakpoint hook from the shadcn template, used by the sidebar primitive to turn the rail into a sheet below 768px.
- [[use-toast.ts]] — Hook for triggering toast notifications in the app, imported by components that need user feedback.
- [[useColumnConfig.ts]] — Manages the library table's column configuration, including definitions, visibility, sizing, and persistence; exports `COLUMN_DEFINITIONS` and the config state hook.
