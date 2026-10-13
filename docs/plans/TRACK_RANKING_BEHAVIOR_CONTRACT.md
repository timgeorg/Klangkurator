---
source: session
tags:
  - plan
  - contract
  - library
status: active
created: 2026-10-13
---
# Behavior contract — track ranking: a per-track quality score (issue #4)

Observable behavior of the track rank, written before the build so a source-blind
validator can judge the running app. Each clause is Given / When / Then. "Reload"
means a full page reload of the browser tab.

Run against a sandbox copy of the library, never the user's real data.

## The field and its column

- **TR-1** Given the library table, then every row has a "Rank" column showing five stars; a track ranked N (1–5) is shown with N filled stars, and a track that has never been ranked is shown with five empty stars (never a dash).
- **TR-2** Given a track ranked N in the Edit dialog, when Save is pressed, then the Rank cell shows N filled stars and the value is still N after a reload.

## Sorting

- **TR-3** Given the Rank header, when it is clicked, then the table sorts by rank lowest-first (1, then 2, … then 5); a second click flips it to highest-first; a third click clears the sort. The header shows the direction and carries `aria-sort`.
- **TR-4** Given a sort by Rank in either direction, then tracks with no rank (0) are listed last.

## Filtering

- **TR-5** Given the Rank filter, when "≥ 3" is chosen, then only tracks ranked 3, 4 or 5 are shown; tracks with no rank are hidden.
- **TR-6** Given the Rank filter, when it is cleared, then every track is shown again, including the unranked ones.
- **TR-7** Given a Rank filter and a search active at the same time, then both apply — a track must pass both to be shown.

## Song detail page

- **TR-8** Given a track's detail page, then its rank is shown as "N/5", and a track with no rank shows "Unranked".

## Edit dialog (the write path)

- **TR-9** Given the Edit dialog, when the Rank slider is moved and Save is pressed, then the rank is stored and the table and the detail page reflect it without a reload.
- **TR-10** Given the Edit dialog is opened for a ranked track, then the Rank slider starts at that track's rank.

## Persistence

- **TR-11** Given a rank has been set, then the sandbox `library.json` contains the rank under that song, and it survives a backend restart.

## Regressions

- **TR-12** The three existing ratings (Energy, Dance, Social) still display, sort and filter exactly as before; adding the Rank column changed none of their behavior.
- **TR-13** Given 1440, 1280, 768 and 375px wide windows in both themes, then the Rank column and its stars do not overflow their cell and the page does not scroll sideways.
- **TR-14** Given a browser that already had column settings saved before this change (a pre-existing layout with no Rank column), when the app loads, then the Rank column is present — the saved layout is migrated to include it.
