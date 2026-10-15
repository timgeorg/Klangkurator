---
source: auto
tags:
  - index
---
# Index — src/components/layout

- [[DJLayout.tsx]] — App shell component that wraps the entire DJ interface: renders the sidebar, top bar (on mobile), main content area, and now-playing player panel. On the map route the player area is forced to the bottom bar without touching the saved dock preference (TM-M8).
- [[DJSidebar.tsx]] — The left navigation rail: Wordmark, main navigation links (Library, Sets, Import, Settings), theme toggle, and collapse control. The Library item is also active on the map route (TM-M1).
- [[EmptyState.tsx]] — Reusable empty-state component with editorial styling; displays a title, optional body text, action button(s), and a configurable composition of design shapes.
- [[LibraryViewSwitch.tsx]] — The library's Table | Map switch (phase 7, TM-E1): the map is the library's other view, so the switch sits in the header of both views as a pair of links (each a real destination, so the browser's Back works and the app sidebar's Library item stays active on both); left out below 768 px (TM-E4).
- [[PageHeader.tsx]] — The top of every page (bold title, mono count, actions, optional tab row) and SectionHeader for in-page sections.
- [[PageSection.tsx]] — A settings-style section: title and description in a left column, controls on the right, hairline separated (Import, Settings).
