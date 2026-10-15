---
tags:
  - plan
  - player
status: active
created: 2026-10-14
source: session
---
# Technical plan — the player steps through a run (issue #5)

Repo: `dj-crate-explorer`, worktree `/tmp/kk-issue5`, branch
`feature_5_player-next-prev` off `origin/main` (16df7e5).

## Decisions

**Tim, 2026-10-13 (in the issue):** next moves to the next track; the point is
stepping through a run. "A player is needed to curate sound and how sounds fit
together. So its an essential." P7, `PRODUCT.md` and OOS-4 are reworded in the
same change.

**Tim, 2026-10-14 (the open questions, answered at pull time):**

| Question | Answer |
|---|---|
| Where does a run start? | **Card + row Play**: Play on a set or block card starts at track 1; Play on a row of the set or block editor starts at that track. Both use the order on screen. |
| Ends of the run | **Stop at the ends**: previous unavailable on the first track, next on the last; when the last track ends, playback stops as a single track does today. |
| Edits during playback | **Freeze**: the run is fixed when Play is pressed; edits apply the next time Play is pressed. |
| Library table | Verbatim: *"on the library they play the track (row) before or below. But no wraparound."* The library table is a run too: the rows as shown when Play was pressed. |

**Sterling's calls (open to override in review):**

- Previous always goes to the previous track (no "restart the current track
  after 3 s" rule): stepping back is how you hear a transition again.
- Next and previous start playback, also from pause.
- Freeze covers the library too: a new sort, search or filter does not change a
  run already playing; the next row Play starts a run in the new order.
- Play on the song detail page plays that one track (a run of one). Next and
  previous show only when the run has more than one track.
- Card Play always starts at track 1, even when that run is already playing.
- Playlists have no UI (backend models only), so there is nothing to start one
  from. `playRun` takes any ordered track list, so a playlist view can call it.
- Tracks stored in a set's `phases` are not in the flat running order the
  editor shows, so they are not in the run.
- A track that fails to load (missing file) shows a message naming it, and
  the run skips on in the direction it was going: next after Next, Play or a
  track ending; previous after Previous. At an end of the run playback stops,
  as before. One moved file should not end a 20-track preview (plan review
  B4); stepping back past it must still work (code review F1).
- From 768 to 1279 px the bar's volume is the mute button alone; the slider
  shows from 1280 px; below 768 px the bar has no volume, as before. With
  previous and next in, the bar at 768 px would otherwise leave the scrubber
  28 px wide (plan review B1, see the width budget).

**Known limits (documented, not fixed here):**

- While an editor is open its dialog covers the player: to pause or skip,
  close it. Row Play always restarts from its row and never toggles.
- On touch screens the editor's row Play is invisible until tapped, and 24 px,
  exactly like the library's # column it copies.
- The run holds each track as it was at Play: an edit to a playing run's
  track (title, artist, BPM, key) shows in the player from the next Play. The
  current track behaved the same way before.
- A blocked autoplay (the next track starting without a click) shows the
  player as paused. Chromium allows it after any click; the PyWebView desktop
  shell (WebKitGTK) is not checked here.

## Verified facts (2026-10-14, read on the worktree)

1. `PlayerContext` holds one track: `play()` replaces it, `stop()` clears it
   (`src/lib/PlayerContext.tsx:5-8`, API at `:15-24`).
2. `NowPlaying` stops at the end of a track (`onEnded={stop}`,
   `NowPlaying.tsx:150`); its load effect is keyed on `current` (`:64-74`).
3. Callers of `play`: `SongLibrary.tsx:217-223` (toggle when the row is the
   current track, else `play(song)`) and `SongDetailPage.tsx:151` (same). No
   component under `src/components/sets/` uses the player.
4. The library's on-screen order is `rows` (`SongLibrary.tsx:328-333`): the
   searched, filtered and sorted list, or the frozen order while editing.
   `rowsRef.current` always holds it.
5. A set's tracks in order: `tracksOf(resolved)` (`setModel.ts:52`), with
   blocks expanded in place and missing items skipped. A song can be in a set
   twice (once directly and once inside a block): the picker only hides songs
   already listed directly (`SetEditor.tsx:107-110`). Positions are indexes,
   never song ids.
6. A block's tracks: `blockTracks(block, songIndex)` (`setModel.ts:29`) on the
   card, `tracks` (`BlockEditor.tsx:84`) in the editor. The UI keeps a track in
   a block once (`15_BLOCKS.md:36`), but the backend accepts duplicates
   (`backend/models/block.py`), so the editor's start index is positional too.
7. Both editors are modal dialogs (`SetEditor.tsx:47`, `BlockEditor.tsx:35`).
   While one is open the overlay (`z-50`) covers the player (`z-30`) and Radix
   hides it from assistive tech, so its buttons can't be pressed; playback and
   auto-advance continue. Row Play still starts the run; next/previous are
   pressed once the editor is closed.
8. The panel is 320 px wide (`design-system/tokens/tokens.css:68`), 280 px inside `px-5`. Its
   controls row `[volume w-28][play][spacer w-28]` (`NowPlaying.tsx:239-243`)
   has no room for two more buttons.
9. `docs/plans/00_Index.md` on main has committed conflict markers
   (`:16-24`, from 0888549). Open PR #15 (issue #10) already removes them and
   appends its own entries at the end. This branch leaves those lines alone and
   adds its entries after the `BACKLOG_ORCHESTRATION` line, so the two PRs
   merge without a conflict.
10. PF numbers were reserved per issue (#5 → PF-78, #6 → PF-79, #7 → PF-80,
    #8 → PF-81, #9 → PF-82, #10 → PF-83, #11 → PF-84). #7 shipped as PF-78,
    so #5 takes #7's unused **PF-80**, and PF-79 stays with #6.
11. Tim's uncommitted draft of `92_PLANNED_FEATURES.md` in the main worktree
    inserts lines after line 83, and PR #15 appends PF-83 after line 90.
    PF-80 goes in a new `## Player` section after the Library UX Backlog
    (around line 33, next to PF-16 Media player), clear of both. The main
    worktree also has an uncommitted `docs/plans/00_Index.md` (it deletes the
    same marker lines). His pull needs a stash and pop for both files.
12. `99_CHANGELOG.md`: PR #15 inserts under `## 2026-10-13`. This branch adds
    a `## 2026-10-14` section above it, so the hunks stay apart.

**Update at ship time:** PRs #15 (issue #10) and #16 (issue #6) landed first,
and the flow is now feature → `int` → `main` (#16, #17, open PR #18). Tim chose
`int` as this PR's base (2026-10-14), so the branch sits on `int` (35afd7c,
the same tree as main 15364d0). The only conflict was the changelog's
2026-10-14 section; all three entries are kept. `Closes #5` does not fire from
a PR into `int`: the issue closes at the `int` → `main` release. Main's conflict
markers in `docs/plans/00_Index.md` (fact 9) were removed by #15. Tim's main
worktree still has uncommitted edits to `92_PLANNED_FEATURES.md` and
`docs/plans/00_Index.md`, so pulling main there needs a stash and pop.

## The queue model

The whole design is one piece of state in `PlayerProvider`:

```ts
queue: { tracks: Song[]; index: number } | null
current = queue ? queue.tracks[queue.index] : null   // derived, never stored
```

| Call | Effect |
|---|---|
| `play(song)` | `queue = { tracks: [song], index: 0, dir: 1 }`, playing. A run of one. |
| `playRun(tracks, index)` | `queue = { tracks, index, dir: 1 }`, playing. Ignored when `index` is out of range. |
| `next()` / `previous()` | `index ± 1`, `dir = ±1`, playing. No-op at the ends (no wrap). |
| `stop()` | `queue = null`, not playing. |

- **Freeze:** `tracks` is the array the caller held when Play was pressed. The
  player never reads it again from storage or from the page.
- **`playRun` checks the range before either setter**, so a press at the end
  of the run cannot resume a paused player.
- **Every start is a new queue object.** `NowPlaying` loads the audio when
  `queue` changes, not when `current` changes. The same song twice in a row
  (`[S, block(S, T)]` gives `[S, S, T]`) still restarts at 0:00 on next.
- `toggle`, `setPlaying`, `dock` and `setDock` are unchanged.
- `next` / `previous` close over the current `queue` on purpose: a functional
  updater would advance twice if `ended` and a click landed in one batch.
- The load effect reads the song from `queue` (deps `[queue, setPlaying]`).
  It stays first, before the play-state sync and volume effects; reversed,
  auto-advance would `play()` the ended source first. A `NotAllowedError` from
  `play()` sets the player to paused.

## Data flow trace

Nothing crosses the API boundary. Audio is still `GET /api/audio/{song.id}`
and the backend is unchanged.

| Source | Ordered list → index | Call |
|---|---|---|
| Library row Play | `rowsRef.current` (on-screen rows) → `findIndex(id === song.id)` (ids are unique in the table) | `playRun(rows, i)`; `play(song)` if not found, so a click is never dead. The row of the current track still toggles pause. |
| Set card Play | `items` (Sets.tsx: `byPosition` + `resolveItem`) → `tracksOf(items)` → 0 | `playRun(tracks, 0)` |
| Block card Play | `tracks` prop (Sets.tsx: `blockTracks`) → 0 | `playRun(tracks, 0)` |
| Set editor row *i* | editor's `resolved` (unsaved order) → `tracksOf(resolved)`, start = `tracksOf(resolved.slice(0, i)).length` | `playRun(tracks, start)`; only for a song row or a block with ≥ 1 track |
| Block editor row *i* | editor's `entries` → `tracks` (missing skipped), start = resolvable entries before *i* (by position, never by identity) | `playRun(tracks, start)`; only when the row's song exists |
| Song detail Play | the page's song | `play(song)` (run of one) |

Missing fields: deleted tracks and blocks are skipped by
`tracksOf`/`blockTracks`. An empty run disables card Play. A missing row or an
empty block row has no row Play.

## Hook dependency ordering

- **PlayerProvider:** `queue`, `isPlaying`, `dock` state → `current` (plain
  const) → callbacks `play`, `playRun`, `stop`, `toggle`, `setDock` (no
  queue dep), `next`/`previous` (dep `[queue]`) → `value` memo last (deps
  include `queue`, `current`, `next`, `previous`).
- **NowPlaying:** `usePlayer()` → derived consts `hasPrevious`, `hasNext`,
  `run` → refs → state → effects (load `[queue]`, play state
  `[isPlaying]`, volume) → `if (!current) return null` → handlers. `onEnded`
  reads `hasNext`/`next`, which are declared above it.
- **SetForm / BlockForm:** `usePlayer()` is called with the other hooks at the
  top. `rows` (a plain map, no hook) reads `tracks` and `playRun`, both
  declared before it.

## Interaction and presentation semantics

- **Card Play** (set and block cards, before Edit, `outline` like Edit, since
  orange is not for per-card actions): always starts the run at track 1,
  never toggles. Disabled when the run has no tracks. Text "Play", accessible
  name "Play <name>".
- **Row Play** (set and block editors): the row number turns into a Play
  button on row hover or keyboard focus, as in the library's # column. It
  always starts the run at that row, never toggles. A block row starts at the
  block's first track. A missing row or an empty block has no Play. Accessible
  name "Play <name>".
- **Library row Play:** looks the same, and now starts a run of the rows as
  shown. Play on the current track still toggles pause and keeps whatever run
  is playing.
- **Previous / Next** (player panel and bar): shown only when the run has
  more than one track. Previous is unavailable on the first track and next on
  the last. They use `aria-disabled` (styled with `aria-disabled:`, since the
  Button's `disabled:` styles don't apply; only the glyph dims, so the focus
  ring stays strong), so a keyboard user's focus stays on the button, and a
  press there does nothing. At any other position a press starts the
  neighbouring track playing. Accessible names "Previous track" and "Next
  track". On coarse pointers they are 44 × 44 px (the Button base gives the
  height, `min-w-11` the width).
- **Announcing:** a polite, visually hidden live region in the player carries
  "<title>, <artist>", so next and auto-advance are announced.
- **Errors:** a track that fails to load toasts its title and the next track
  plays; on the last track, playback stops.
- **Track ends:** the next track starts when there is one. Otherwise playback
  stops and the player closes, as today.
- **Layout:** in the panel, a centered transport row `[prev][play][next]`
  with the volume on its own row below. In the bar, `[prev][play][next]` as
  one tight group where Play is today, and below 1280 px the volume is the
  mute button alone (width budget below).

### Bar width budget (scrubber width = what is left)

Fixed parts of the bar: cover link 40 (+12 + title 160 from 640 px, 224 from
1024 px), transport 116 (36 + 4 + 36 + 4 + 36), time labels 2 × 40 from
640 px, volume (mute 28 below 1280 px, 112 from 1280 px, none below 768 px),
undock 28 (≥ 1280 px), stop 28, gaps 12 (16 from 768 px), padding 24 (32
from 768 px). The rail is collapsed to 64 px at 768 px and 248 px when
expanded.

| Viewport | Bar width | Scrubber before | Scrubber, full volume kept | Scrubber, as built |
|---|---|---|---|---|
| 375 | 375 | 211 | 131 | 131 |
| 768 (rail 64) | 704 | 108 | 28 | 112 |
| 1024 (rail 248) | 776 | 116 | 36 | 120 |
| 768, sidebar expanded by hand (rail 248) | 520 | about 26 | overflow (validator NP-18x) | 80, the title truncates |
| 1280, bar docked (rail 248) | 1032 | 328 | 248 | 248 |

Numbers are computed from the classes; the live pass measures them (NP-18).
The scrubber has a floor (80 px from 640 px, 56 px below, so a 320 px phone
still fits) and the cover-and-title link may shrink, so when the bar runs out
of room the title truncates instead of the bar overflowing.
- Nothing is persisted. A reload forgets the run, as it forgets the track
  today.

## Steps

1. **Spec first** (repo AGENTS.md):
   - `01_VISION_AND_PRINCIPLES.md` P7: playback for curation (preview, step
     through a run) is in scope; performing (decks, mixing, crossfader,
     beat-matching) is not. Rekordbox stays the performance engine.
   - `PRODUCT.md:23,34,35,60`: drop "never a player", say what the player is.
   - `93_OUT_OF_SCOPE.md` OOS-4: draws the line on the performance side.
   - `92_PLANNED_FEATURES.md`: new `## Player` section with PF-80.
   - `13_LIBRARY_VIEW.md`, `15_BLOCKS.md`, `16_SET_PLANNING.md`: where Play
     starts a run.
   - `99_CHANGELOG.md`: an entry under 2026-10-14.
   - `DESIGN.md` "Now Playing": the transport and the bar's volume.
   - `README.md`: the preview player bullet, the "single-track (no queue
     yet)" limit and "a player queue" under Next up.
   - Folder indexes: `src/lib/00_Index.md` (PlayerContext),
     `src/components/dj/00_Index.md` (NowPlaying),
     `src/components/sets/00_Index.md` (SetCard, BlockCard, RunningOrder).
2. `PlayerContext.tsx`: the queue model and the doc comment.
3. `NowPlaying.tsx`: transport, `onEnded`, load effect on `queue`, doc
   comment, panel layout.
4. `SongLibrary.tsx`: `playRun` over `rowsRef.current`.
5. `SetCard.tsx`, `BlockCard.tsx`: card Play via `usePlayer()`.
6. `RunningOrder.tsx`: `OrderRow.onPlay?`, with the number cell turning into
   Play on hover or focus.
7. `SetEditor.tsx`, `BlockEditor.tsx`: rows carry `onPlay`.
8. `docs/plans/00_Index.md`: two new entries after the
   `BACKLOG_ORCHESTRATION` line. The conflict markers are left to PR #15.

## Tests and gates

- No frontend test runner exists, and adding one for this is out of scope.
  The behavior is covered by the contract
  ([[PLAYER_RUN_BEHAVIOR_CONTRACT.md]]), judged black-box. The backend is
  unchanged, but its tests still run as a gate.
- Gates (repo AGENTS.md): `npx tsc --noEmit -p tsconfig.app.json` with no new
  errors, `python -m pytest backend/tests`, `npx eslint <changed files>`,
  `npx vite build`, and a live check of every changed view in ink and paper
  at 1440, 1280, 768 and 375 px, with the bar's scrubber measured at 768 and
  at 1024 with the sidebar expanded.
- Design: an impeccable audit of the changed views (vault Web-Content rule).
- Not run here: auto-advance in the PyWebView desktop window
  (`./run.sh desktop`). It needs a person at the window, so it is listed for
  Tim in the PR.
- Sandboxes: each run gets its own HOME and ports. `prepare_sandbox.py <dir>`
  copies `~/.klangkurator` (92 mp3s, all present; the real library is only
  read) and points the 8th track by title at a missing file. `seed_runs.py
  <port>` then creates the fixtures through the API. Both scripts live in the
  session scratchpad, and their logic is summarized here:

| Fixture | Contents (S1, T1, T2, S2, T3, S = tracks 1–6 by title) | Clauses |
|---|---|---|
| Run Set Main | S1, block B (T1, T2), S2 | NP-6, 6b, 8, 10, 13, 14, 16, 19 |
| Run Block Three | T1, T2, T3 | NP-7, 9, 10b |
| Run Set Empty | nothing | NP-11 |
| Run Set Missing | S1, a dangling song id, S2 | NP-11, 11b |
| Run Block H | T1, a dangling song id, T3 | NP-11b |
| Run Set Z | a block of two dangling ids, S1 | NP-11c |
| Run Set Dup | S, block (S, T3) | NP-12 |
| Run Set Error | S1, the broken-file track, S2 | NP-20 |

## Not doing (named)

- A playlist view: no UI exists to start one from.
- A run name or "3 of 12" in the player.
- Marking the current row in the editors or on the set card's preview.
- Keyboard shortcuts and media keys (`navigator.mediaSession`).
- "Follow" mode (Tim chose freeze), shuffle, repeat, queue editing: the P7
  line.
- Gapless playback or crossfade: tracks play back to back with a short load
  gap (OOS-4).
- Pausing from inside an open editor, and marking the playing row there.
