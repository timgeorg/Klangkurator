---
source: auto
tags:
  - index
---
# Index — .impeccable

- [[build/]] — Working spec from the design process (spec.json) (local only, not committed).
- [[config.json]] — Team settings for the design tools; the detector skips the unused legacy mock data (src/services/MockupDataService.ts).
- [[decision-direction.json]] — Design decision record for current direction (local-only working file, not committed).
- [[design.json]] — Machine-readable sidecar of DESIGN.md (tokens, ramps, component snippets) for design tools; regenerate it with DESIGN.md rather than editing it by hand.
- [[live/]] — Live design-tool configuration: config.json holds the active design tool settings and state.
- [[mocks/]] — The moodboard and font measurements used as references during the redesign (local only, not committed).
- [[questions/]] — State of the design-direction question round (local only, not committed).
- [[review/]] — Screenshots captured for the finish review, one per viewport and state (local only, not committed).
- [[surfaces/]] — Development-only design briefs (src-app-tsx.md covers every route of the app, with the direction contract); never copied into source code, comments or the DOM.
