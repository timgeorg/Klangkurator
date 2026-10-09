---
name: Klangkurator
description: A DJ's library as a label's catalog. Ink and paper grounds, one signal orange, black-and-white covers.
colors:
  signal-orange: "#FD6402"
  signal-orange-text-paper: "#A33B00"
  signal-soft-ink: "#29190F"
  signal-soft-paper: "#FBDBC6"
  ink-rail: "#0A0A0B"
  ink-ground: "#111112"
  ink-panel: "#161617"
  ink-popover: "#1C1C1D"
  ink-hover: "#232324"
  ink-hairline: "#2E2E30"
  ink-control-border: "#66655F"
  ink-muted-text: "#9C9891"
  paper-popover: "#FBF8F3"
  paper-card: "#F7F3EC"
  paper-ground: "#F1ECE4"
  paper-hover: "#E8E2D8"
  paper-hairline: "#D8D0C3"
  paper-control-border: "#8E877C"
  paper-muted-text: "#645F57"
  cool-silver: "#A1A2B3"
  lavender: "#C2B7F2"
  lavender-text-paper: "#5B4FC4"
  success-ink: "#6DB33F"
  success-paper: "#3E6F05"
  warning-ink: "#D9B43A"
  warning-paper: "#7D6200"
  destructive-ink: "#F26B5E"
  destructive-paper: "#B42318"
  entity-carmine: "#C8102E"
  entity-rose: "#E0607E"
  entity-plum: "#7B3F8C"
  entity-lavender: "#B4A7F2"
  entity-violet: "#6B5BD6"
  entity-indigo: "#3B4BA8"
  entity-ink-blue: "#2B3A67"
  entity-cobalt: "#2F6BD8"
  entity-sky: "#6FA8DC"
  entity-teal: "#1E8C8C"
  entity-mint: "#6CC3A0"
  entity-green: "#4E9A2A"
  entity-moss: "#5C7A3A"
  entity-olive: "#8A9A3B"
  entity-ochre: "#C9A227"
  entity-sand: "#CDB891"
  entity-clay: "#B3684A"
  entity-brown: "#7A5236"
  entity-silver: "#A1A2B3"
  entity-slate: "#6D7480"
typography:
  display-lg:
    fontFamily: "Literata Variable, Literata, Iowan Old Style, Georgia, serif"
    fontSize: "4.5rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.025em"
  display:
    fontFamily: "Literata Variable, Literata, Iowan Old Style, Georgia, serif"
    fontSize: "3.5rem"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "-0.02em"
  display-sm:
    fontFamily: "Literata Variable, Literata, Iowan Old Style, Georgia, serif"
    fontSize: "2.5rem"
    fontWeight: 400
    lineHeight: 1.06
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Literata Variable, Literata, Iowan Old Style, Georgia, serif"
    fontSize: "1.75rem"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  headline-sm:
    fontFamily: "Literata Variable, Literata, Iowan Old Style, Georgia, serif"
    fontSize: "1.4375rem"
    fontWeight: 400
    lineHeight: 1.16
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  heading:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.012em"
  ui:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  lead:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  small:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
  prose:
    fontFamily: "Literata Variable, Literata, Iowan Old Style, Georgia, serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  num:
    fontFamily: "Geist Mono Variable, Geist Mono, ui-monospace, Menlo, monospace"
    fontFeature: "tnum"
    letterSpacing: "0"
  label:
    fontFamily: "Geist Mono Variable, Geist Mono, ui-monospace, Menlo, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.12em"
  wordmark:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.045em"
  wordmark-mark:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1
rounded:
  cover-thumb: "3px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  chip: "9999px"
spacing:
  base: "4px"
  page-x: "20px"
  page-x-md: "32px"
  card: "20px"
  dialog: "24px"
  row: "44px"
  rail: "248px"
  rail-collapsed: "64px"
  player: "320px"
  player-bar: "64px"
components:
  button-primary:
    backgroundColor: "{colors.signal-orange}"
    textColor: "{colors.ink-rail}"
    typography: "{typography.ui}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "36px"
  button-outline-ink:
    backgroundColor: "transparent"
    textColor: "{colors.paper-ground}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "36px"
  button-outline-ink-hover:
    backgroundColor: "{colors.ink-hover}"
  button-ghost-ink:
    backgroundColor: "transparent"
    textColor: "{colors.paper-ground}"
    rounded: "{rounded.md}"
    size: "36px"
  input-ink:
    backgroundColor: "transparent"
    textColor: "{colors.paper-ground}"
    typography: "{typography.ui}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  search-pill:
    rounded: "{rounded.chip}"
    padding: "0 36px"
    height: "36px"
  tab-active-ink:
    backgroundColor: "{colors.signal-soft-ink}"
    textColor: "{colors.signal-orange}"
    rounded: "{rounded.chip}"
    padding: "0 14px"
    height: "32px"
  tab-active-paper:
    backgroundColor: "{colors.signal-soft-paper}"
    textColor: "{colors.signal-orange-text-paper}"
    rounded: "{rounded.chip}"
    padding: "0 14px"
    height: "32px"
  color-chip:
    backgroundColor: "transparent"
    rounded: "{rounded.chip}"
    height: "20px"
  card-ink:
    backgroundColor: "{colors.ink-panel}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card}"
  card-paper:
    backgroundColor: "{colors.paper-card}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card}"
  dialog-ink:
    backgroundColor: "{colors.ink-popover}"
    rounded: "{rounded.lg}"
    padding: "{spacing.dialog}"
  table-row:
    height: "{spacing.row}"
  table-row-current-ink:
    backgroundColor: "{colors.signal-soft-ink}"
    textColor: "{colors.signal-orange}"
    height: "{spacing.row}"
  cover-thumb:
    rounded: "{rounded.cover-thumb}"
    size: "32px"
  rail:
    backgroundColor: "{colors.ink-rail}"
    width: "{spacing.rail}"
---

# Design System: Klangkurator

How-to (load order, Tailwind preset, canvas token reading, building a new view) lives in the usage guide, [design-system/README.md](design-system/README.md). This file records the world as it shipped. Tokens are defined in `design-system/tokens/tokens.css`; semantic roles there are HSL triplets, and the hex values above are their resolved swatches.

## Overview

**Creative North Star: "The Label's Catalog"**

Klangkurator presents a DJ's library the way a record label prints its catalog. The grounds are ink (dark, the default) and warm paper (light). Covers are black and white. Everything you operate is set in a tight grotesk, the editorial moments are set in a serif, and data is set in mono. One signal orange carries a single meaning: *this one*. It marks the playing track, the current row, the active tab, focus, the primary action and the brand mark. Its signature form is the orange cut, a disc that sweeps in over the current track's cover.

The density is a working tool's density. Tables run 44px rows at 13px with hairlines between them. Page titles are bold Inter rather than display serif. Editorial weight goes to the places where nothing is being operated: empty states, the 404, the import start screen, a track's title on its own page, set names, notes. Those grounds carry fine paper grain, which gives texture without roughness. The geometric vocabulary (circle, half disc, quarter disc, block) illustrates edge states and marks the active rail item. It never encodes data.

Depth stays flat until something floats. Panels and cards sit on hairlines. Only overlays (menus, popovers, dialogs, sheets, toasts) lift, with an offset soft shadow. Motion signals state only, at 150–220ms ease-out, and is cut to near zero under reduced motion.

**Key Characteristics:**
- Ink and paper themes from one set of roles; the rail is ink in both.
- One signal orange (#FD6402) that means "this one" and is never a category color.
- Three faces with three jobs: Inter operates, Literata narrates, Geist Mono counts.
- Black-and-white covers, with the orange cut on the single current item.
- Hairlines and space instead of boxes; shadows only on overlays.
- Paper grain on editorial and working grounds, never on the data itself.

## Colors

Warm-neutral ink and paper grounds with one hot signal, plus a small cool set reserved for data and status.

### Primary
- **Signal Orange** (`signal-orange`): the mark, the primary button fill, the orange cut, the active-rail marker, the progress fill, the played part of a waveform, the first chart series, and the focus ring on ink. Text on it is always ink (6.6:1), never white (3.0:1).
- **Burnt Signal** (`signal-orange-text-paper`): orange used as text, icon or focus ring on paper, where the full signal is too light to read. On ink, orange text uses the signal itself.
- **Signal Wash** (`signal-soft-ink` / `signal-soft-paper`): the orange-tinted fill behind the current table row, the active tab and the signal badge. It always pairs with orange text.

### Secondary
- **Cool Silver** (`cool-silver`): the cool data neutral, chart series three on ink.
- **Lavender** (`lavender` / `lavender-text-paper`): the data accent and the `info` role. Minor keys in the table are set in it.

### Neutral
- **Rail Ink** (`ink-rail`): the sidebar rail in both themes, sunken wells on ink, and the text color on orange.
- **Ink Ground** (`ink-ground`): the ink page ground and the paper theme's foreground text.
- **Ink Panel / Ink Popover / Ink Hover** (`ink-panel`, `ink-popover`, `ink-hover`): cards and the now-playing panel, then menus and dialogs, then hover fills. Each step is one shade lighter.
- **Ink Hairline** (`ink-hairline`): dividers and card borders on ink. **Ink Control Border** (`ink-control-border`): input and outline-button strokes (at least 3:1).
- **Ink Muted Text** (`ink-muted-text`): secondary text on ink (at least 4.9:1).
- **Paper Ground / Paper Card / Paper Popover** (`paper-ground`, `paper-card`, `paper-popover`): the paper theme's ground, raised surface and overlays. Paper Ground is also the primary text on ink.
- **Paper Hover, Paper Hairline, Paper Control Border, Paper Muted Text**: the paper counterparts of the ink roles above.

### Status
- **Success, Warning, Destructive** (`success-*`, `warning-*`, `destructive-*`): each has a lighter variant for ink and a deeper variant for paper. They are used as text and icons, plus the fill of the destructive button.

User-pickable entity colors (tags, genres, blocks, sets) are user data, not system roles. The 20-swatch palette lives in `design-system/tokens/palette.json` and deliberately leaves out orange; it is listed above as `entity-*` so tools recognize the swatches. The default genre colors and the relationship line colors are drawn from the same palette.

### Named Rules
**The This-One Rule.** Orange marks state: current, playing, selected, focused, primary. It is never a category, a decoration or the fill of a whole region. Only one item carries the orange cut at a time.

**The Ink-On-Orange Rule.** Text and icons placed on an orange fill are ink. On paper, orange used as text is Burnt Signal.

**The Dot-Not-Fill Rule.** A user's color appears as a small dot inside a hairline pill, never as the chip's fill. That keeps any stored hex legible in both themes and keeps orange reserved for state.

## Typography

**Display Font:** Literata Variable (with Iowan Old Style, Georgia)
**Body Font:** Inter Variable (with ui-sans-serif, system-ui)
**Label/Mono Font:** Geist Mono Variable (with ui-monospace, Menlo)

All three are self-hosted woff2 variable files with latin and latin-ext subsets. Nothing loads from a CDN.

**Character:** A tight, slightly negative-tracked grotesk does the work. A bookish serif with optical sizes speaks only when the screen is telling you something instead of asking you to act. The mono keeps every number on a tabular grid.

### Hierarchy
- **Display LG / Display / Display SM** (Literata 400; 72 / 56 / 40px; line-height 1–1.06; balanced): the 404, the import start screen, page-level empty states, and the track title on the song page (Display SM).
- **Headline** (Literata 400, 28px, 1.15): set names on set cards.
- **Headline SM** (Literata 400, 23px, 1.16, balanced): the track title in the now-playing panel.
- **Title** (Inter 700, 24px, 1.15, -0.025em): every page title in the page header.
- **Heading** (Inter 600, 17px, 1.3): section and card titles.
- **UI** (Inter 400–500, 13px): the working size for buttons, inputs, tabs, table cells and descriptions. It is the most-used size in the app.
- **Lead** (Inter 400, 15px, 1.6): the one sentence under a display line (empty states, the 404, the import start screen), block names and spec-sheet values on the song page.
- **Body / Small** (Inter, 14px / 12px): the document default and secondary text. Data cells such as BPM, key, duration and the row index use the 12px step.
- **Prose** (Literata 16px, 1.65, max 68ch): track notes and lyrics.
- **Num** (Geist Mono, tabular, inherits size): counts beside titles, BPM, key, durations, times and index numbers.
- **Label** (Geist Mono 500, 11px, 0.12em, uppercase): only the term of a data pair (BPM, KEY, FILE), set as a `<dt>` beside its value.
- **Wordmark** (Inter 700, 19px, -0.045em): the name in the lockup with the asterisk mark; the mark alone is set at 22px in the collapsed rail.

### Named Rules
**The Three Jobs Rule.** Inter is for anything you operate, Literata for editorial moments and long reading, and Geist Mono only for data. A serif page title or a mono sentence is out of system.

**The Label-Names-Data Rule.** A mono caps label names the data value beside it. It never sits above a heading as an eyebrow.

## Layout

The shell is a fixed ink rail (248px expanded, 64px collapsed to icons) next to a grid with three areas: a top area, a scrolling main area, and the player. Below 1280px the player is a 64px bar docked at the bottom. At 1280px and wider it can dock as a 320px right-hand panel, with the top area spanning both columns. Under 768px the rail turns into an off-canvas sheet.

Rhythm runs on a 4px base. Page gutters are 20px, widening to 32px from 768px up. The page header has a 20–28px top, a hairline bottom edge, and an optional tab row 16px below the title. Cards pad 20px; dialogs pad 24px with a 20px internal gap. The library table uses 44px rows with hairline separators and right-aligned numeric columns. Its sticky header sits on the same grained working ground as the page. Set cards lay out with container queries rather than viewport breakpoints. Touch targets grow to 44px on coarse pointers.

The main area is a working ground: the page color with the grain tile veiled down to `--grain-opacity`. It is a background rather than a layer, so it stays put while content scrolls. Editorial bands (empty states, the 404, the import start) carry their own grain. Inside a working ground they do not stack a second grain.

## Elevation & Depth

The system is flat with hairlines, and only floating things lift. Cards, panels, the rail and the now-playing panel separate by one-step tonal shifts and 1px hairlines, with no shadow. Overlays use an offset soft shadow, never a zero-offset glow. The shadows deepen in the ink theme so that lift still reads on a dark ground. Dialog and sheet backdrops are an ink scrim at 70%.

### Shadow Vocabulary
- **Lift 1** (`--shadow-1`): small things that float in place, such as toasts and the slider thumb.
- **Lift 2** (`--shadow-2`): menus, selects, popovers, dialogs, alert dialogs and sheets.

### Named Rules
**The Flat-Until-It-Floats Rule.** A surface that belongs to the page gets a hairline. Only a surface that sits above the page gets a shadow, and that shadow is Lift 1 or Lift 2.

## Shapes

Corners come in three steps: 10px for cards, panels, dialogs, popovers and the large now-playing cover; 8px for buttons and inputs; 6px for small icon buttons, tooltips and inline edits. Table cover thumbnails get 3px, just enough to soften a 32px square. Pills (full radius) are reserved for selection and identity: tabs, segmented controls, the search field, color chips and badges.

The board's geometric vocabulary is circle, half disc, quarter disc and block. Each is drawn in `currentColor` and rotated in quarter turns. They appear in fixed compositions in empty states and the 404, and as the half-pill marker on the active rail item. One composition holds exactly one orange shape.

**The orange cut** is the signature form. On the current item, an orange disc as tall as the cover is centered on the cover's right edge, so half of it shows. It is built from two layers: a multiplied disc that keeps the image's lights and darks, and a flat disc at `--cut-tint` (0.8) on top, so a black cover still turns orange rather than brown. It sweeps in from the edge in 220ms ease-out. Without artwork the disc is drawn flat. Covers are grayscale with a slight contrast lift unless the user picks original color in Settings.

## Components

### Buttons
Quiet and exact. The one primary action in view is the only orange object.
- **Shape:** gently rounded (8px), 36px tall at the default size; 32px small, 44px large, 36px or 28px square for icons.
- **Primary:** Signal Orange fill, ink text, semibold 13px. Hover drops the fill to 90% and active to 80%.
- **Outline:** for every other action. It has a control-border stroke and transparent fill; on hover the stroke strengthens and the hover fill appears.
- **Ghost:** icon buttons at 80% foreground, rising to full foreground over the hover fill.
- **Link:** orange text (Burnt Signal on paper) that underlines on hover.
- **Focus:** a 2px ring in the ring color, offset from the ground. Disabled buttons sit at 45% opacity.

### Chips and Tabs
- **Color chip:** a hairline pill 20px tall (24px at the medium size) with a 6px dot in the user's color and the label at 11px. An optional remove button shares the same pill.
- **Tabs and segmented controls:** 32px pills of muted text. The active one turns Signal Wash with orange text. Crate tabs, relationship view modes and segmented controls all share this treatment.
- **Badge:** an 11px pill; the signal variant is Signal Wash with orange text.

### Cards / Containers
- **Corner Style:** 10px.
- **Background:** the card surface (Ink Panel or Paper Card).
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** a 1px hairline.
- **Internal Padding:** 20px, with the card title in the Heading role. Cards are used only for independent objects such as sets and blocks. Set cards are laid out editorially: a cover mosaic beside a Headline-serif name, mono counts, and a running-order preview.

### Inputs / Fields
- **Style:** a transparent fill, a control-border stroke, 8px corners, 36px tall, 13px text, and a muted placeholder. The caret is orange.
- **Hover / Focus:** the stroke strengthens on hover. On focus the border becomes the ring color and gains a 1px ring.
- **Search:** the same field as a pill, with icons inset left and right.

### Navigation
- **Rail:** ink in both themes and grained. It holds the asterisk wordmark in a 64px header, then four destinations as icon-and-label rows. The active row carries an orange half-pill at the left edge and an orange icon. The footer holds the theme switch and the collapse control above a hairline. When collapsed, the rail shows icons only with tooltips.
- **Page header:** a bold Inter title, a mono count beside it, actions on the right, and an optional tab row. A hairline separates it from the content.

### Library Table (signature)
The table has 44px rows with hairline separators and mono 12px index numbers. Covers are 32px grayscale thumbnails, and each row has a compact waveform. The current row gets the Signal Wash fill, an orange index, an orange title, a cut cover and an all-orange waveform. Hover or keyboard focus swaps the index for play and edit buttons, so nothing is hover-only. Notes edit inline in place. The table never ends on a cut sliver: while columns lie beyond the right edge, the grained ground covers the sliver and a small round "more columns" button scrolls right (on touch screens the edge fades instead and the button is left out, since it would be a target under 44px). Tag cells show whole chips and a mono "+N" pill for the rest. Track titles in lists keep their version or catalogue part in the muted color.

### Now Playing (signature)
This is the preview player. As a 320px panel it shows a grained card surface, a full-width square cover carrying the orange cut, the title in Literata at about 23px, the artist and genre in Inter, a waveform scrubber with the played part in orange, mono times, and a BPM / KEY data list using the Label role. As a 64px bar it carries the same information condensed. Switching between the two never interrupts playback.

### Empty States
A page-level empty state is a grained band holding a Display SM serif line, one 15px sentence in muted text, the resolving action, and one of three shape compositions (orbit, stack, split). The inline variant is a dashed hairline box with an 18px serif line.

### Overlays
Dialogs, popovers, menus and selects use the popover surface, 10px corners, a hairline and Lift 2. Closing a dialog returns focus to whatever opened it. A search field inside a picker has no box; its focus shows as a 2px orange rule under it. The highlighted option in a list (keyboard or pointer) gets the hover tint plus a 2px orange bar on its left edge, since the tint alone is too faint to follow. Selected options get an orange check. Tooltips invert to a foreground fill with ground-colored text at 11px and 6px corners. Toasts use Lift 1.

## Do's and Don'ts

### Do:
- **Do** reserve Signal Orange for the current, playing, selected, focused or primary item, and give the orange cut to exactly one item at a time.
- **Do** put ink text on orange fills, and use Burnt Signal for orange text on paper.
- **Do** set page titles in Inter 700 at 24px, data in Geist Mono with tabular figures, and editorial lines, notes and lyrics in Literata.
- **Do** separate content with 1px hairlines and space, and keep shadows to Lift 1 and Lift 2 on floating surfaces.
- **Do** keep covers black and white by default and use the cut, not a border or a glow, to mark the current cover.
- **Do** use one orange shape per composition in empty and edge states.
- **Do** keep every motion to 150–220ms ease-out and only for state changes, and make every hover action reachable by keyboard focus.

### Don't:
- **Don't** use orange as a tag, genre or category color, as decoration, or as a region fill.
- **Don't** put white text on orange.
- **Don't** place a mono caps label above a heading as an eyebrow; labels name data values only.
- **Don't** fill a chip with the user's color; show it as a dot.
- **Don't** add drop shadows to cards or panels, or use a zero-offset glow anywhere.
- **Don't** lay grain over individual table rows or long text; grain belongs to grounds and editorial bands.
- **Don't** load fonts or assets from a CDN; the app runs offline.
