---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/components/dj/SongLibrary.tsx","src/pages/SongDetailPage.tsx","src/pages/Sets.tsx","src/pages/LoadFiles.tsx","src/pages/Settings.tsx"]
---

# Surface brief: Klangkurator app (all routes)

## Scope and mode

Whole app redesign, Operate mode: shell and rail, Library table, song detail, edit/lyrics/relationships dialogs and graph, Sets and Blocks with editors, Load Files and folder browser, Settings, preview player, 404, toasts. Restyle existing views only; new moodboard views (home, analytics, collections, playlists) stay in the backlog.

## Audience, job, constraints

Tim, a DJ curating his own library at home before a gig; later other DJs. Job: find, preview, annotate and arrange tracks. Offline desktop (PyWebView, WebKitGTK) and browser; phone widths must not break. Table must stay dense and fast at 1,000–5,000 rows. Copy is factual; moodboard taglines are placeholders. Orange never becomes a user data color by default.

## Direction contract

THESIS: The library is a curated catalog, not a file list. Klangkurator wears the moodboard's label-magazine identity and turns its shapes into state: the orange cut marks what is playing, selected or current. It refuses the category default, neon-on-charcoal DJ software.

OWN-WORLD: Ink #0B0B0C rail and panels, paper #F2EEE7 grounds with fine grain, signal orange #FD6402 for the mark, primary action, focus and the cut; warm gray, cool silver, lavender and green for data. Black-and-white covers, an orange multiply disc on the current one. Inter for UI and wordmark, Literata for editorial moments, Geist Mono for tracked labels and numbers. Half and quarter discs, hairlines, 6/10px radii, pill tabs.

STORY: The DJ sees their collection as a label's catalog, finds a track in a calm dense table, previews it, writes the note, files it into a block or set. Exactly one thing carries the orange cut at a time.

FIRST VIEWPORT: Library at 1440×900, ink theme. A 248px ink rail: asterisk wordmark, Library / Sets / Import / Settings, a half-disc marker on the active item. Header: title, mono track and crate count, crate tabs, search pill, Columns. Table of 44px rows: mono index, 32px B&W covers, title, artist, genre, BPM, key, waveform, duration; the playing row has an orange index and a cut cover. A 320px now-playing rail: mono kicker, 288px cover under an orange multiply disc, title, artist, orange waveform scrubber, mono BPM and KEY. Signature interaction: on play the disc sweeps into the cover in one 220ms ease-out; motion grammar is 150–220ms state transitions only, instant under reduced motion.

FORM: Label and magazine editorial identity (the user's moodboard) carrying the orange cut; position 1 on the ordered list (the pick card, chosen over the rolled running order); seed key 75c46f88.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Memorable moment

Pressing play: the orange disc cuts into the cover in the row and in the now-playing rail at once, the way the moodboard's orange circle sits over the crowd photo.

## Unresolved decisions

- Theme default is ink (dark) with a paper (light) theme selectable in Settings; confirm after review.
- Cover treatment default is black-and-white with an "original color" preference; confirm after review.
