# Klangkurator design system

The editorial look of Klangkurator in a form any surface can use: the app, a future website, a set canvas. Ink and paper grounds, one signal orange, a grotesk for the interface, a serif for editorial moments, a mono for data, black-and-white covers, a small vocabulary of geometric shapes, and paper grain without roughness.

This folder is framework-agnostic. The React app consumes it; a website can import the same files.

## What's here

| Path | What it is |
|---|---|
| `tokens/tokens.css` | Every colour, font stack, radius, shadow, duration and layout size as CSS variables, for both themes. |
| `tokens/palette.json` | The 20 colours users pick for tags, genres, blocks and sets. |
| `fonts/` | Inter, Literata and Geist Mono as variable woff2 (latin + latin-ext), `fonts.css` with the `@font-face` rules, OFL licences. |
| `css/base.css` | Element defaults, themed browser surfaces (selection, caret, focus, scrollbars), type roles, shapes, the orange cut, covers, grain. All classes start with `k-`. |
| `tailwind/preset.js` | A Tailwind 3 preset that names the tokens (`bg-signal`, `text-muted-foreground`, `rounded-chip`, `shadow-2` …). |
| `assets/` | The asterisk mark (`mark.svg`, `favicon.svg`), grain tiles and the script that generates them. |

## Use it

Load the three stylesheets in this order, before anything else:

```css
@import "design-system/fonts/fonts.css";
@import "design-system/tokens/tokens.css";
@import "design-system/css/base.css";
```

Themes switch on the root element: `class="dark"` (or `data-theme="ink"`) for ink, nothing (or `data-theme="paper"`) for paper. With Tailwind, add the preset:

```ts
import klangkurator from "./design-system/tailwind/preset.js";
export default { presets: [klangkurator], content: ["./src/**/*.{ts,tsx}"] };
```

Fonts are self-hosted on purpose. The desktop app runs offline, so never load a font from a CDN.

## The rules that make it look like Klangkurator

1. **Orange means "this one."** The signal orange marks the playing or current item, the selected tab, focus, primary actions and the brand mark. It is never a category colour, never decoration, never a background for a whole region. Users' tag and genre colours come from the palette, which leaves orange out.
2. **Text on orange is ink.** White on `#FD6402` is 3.0:1. Ink is 6.6:1. On paper, orange used as text is the deeper `--signal-text` (`#A33B00`).
3. **Three faces, three jobs.** Inter for everything you operate: titles, labels, buttons, table cells. Literata for editorial moments: empty states, the 404, the track title on the detail page, and long reading such as notes and lyrics. Geist Mono only for data: BPM, keys, durations, counts, index numbers, paths. A mono label above a heading (an eyebrow) is not allowed.
4. **Shapes are the vocabulary.** Circle, half disc, quarter disc, block. One composition uses at most one orange shape. Shapes illustrate empty and edge states and mark the current item; they never carry information on their own.
5. **The orange cut is the signature.** The current track's cover carries an orange disc, centred on its right edge and multiplied over the black-and-white image. Only one thing carries it at a time. Use `<CoverArt current />` or the `.k-cut` class with `data-cut="on"`.
6. **Covers are black and white** by default (`.k-cover`). Settings can switch them to original colour; that sets `data-covers="original"` on the root.
7. **Texture without roughness.** Paper grain (`.k-grain`, `.k-grain-layer`) on editorial grounds: the rail, panels, empty states, headers of editorial pages. Never on tables or long text.
8. **Hairlines over boxes.** Separate with 1px `border-border` rules and space. Cards are flat with a hairline, no drop shadow. Overlays (menus, dialogs) get real depth: `shadow-2`, offset and soft blur.
9. **Nothing hides behind hover.** Every action that appears on hover also appears on keyboard focus, and has an accessible name.
10. **Copy says what is true.** Name the action, name the problem and the way out. No taglines inside the app.

## Tokens

Colours are HSL triplets so Tailwind can add opacity (`bg-signal/20`). Plain-hex primitives (`--k-ink-900`, `--k-orange-500` …) are there for canvas, SVG and email.

| Role | Ink (dark) | Paper (light) | Use |
|---|---|---|---|
| `background` / `foreground` | `#111112` / `#F1ECE4` | `#F1ECE4` / `#111112` | Page ground and text (16:1) |
| `card` | `#161617` | `#F7F3EC` | Panels, cards |
| `popover` | `#1C1C1D` | `#FBF8F3` | Menus, dialogs |
| `muted-foreground` | `#9C9891` | `#645F57` | Secondary text (≥ 4.9:1) |
| `accent` | `#232324` | `#E8E2D8` | Hover fills |
| `border` | `#2E2E30` | `#D8D0C3` | Hairlines |
| `input` | `#66655F` | `#8E877C` | Control borders (≥ 3:1) |
| `signal` | `#FD6402` | `#FD6402` | The orange (fills, shapes, focus on ink) |
| `signal-text` | `#FD6402` | `#A33B00` | Orange as text or icon |
| `signal-soft` | orange-tinted ink | orange-tinted paper | Behind the current row or active tab |
| `success` / `warning` / `info` / `destructive` | light variants | dark variants | State text and icons |
| `data-1 … data-5` | | | Chart series: orange highlight, then ink/paper, silver, lavender, green |
| `waveform` / `waveform-played` | | | Waveform ink and the played part |
| `sidebar-*` | ink | ink | The rail is ink in both themes |

Shape and motion: `--radius` 10px (cards, dialogs), `--radius-control` 8px (buttons, inputs), `rounded-chip` for pills. Durations 150ms (`duration-fast`), 220ms (`duration-base`), 260ms (`duration-cut`); easing `ease-out` (`cubic-bezier(0.16, 1, 0.3, 1)`). Motion shows state; nothing animates on page load.

## Type roles

| Class | Face | Size | Use |
|---|---|---|---|
| `k-display-lg` / `k-display` / `k-display-sm` | Literata | 72 / 56 / 40px | Editorial headlines: empty states, 404, website |
| `k-headline` | Literata | 28px | Track title on detail views |
| `k-title` | Inter 700 | 24px | Page titles |
| `k-heading` | Inter 600 | 17px | Section and card titles |
| `k-body`, `k-small` | Inter | 14 / 12px | Body and secondary text |
| `k-prose` | Literata | 16px, 68ch | Notes, lyrics, long descriptions |
| `k-num` | Geist Mono, tabular | inherit | Numbers and data |
| `k-label` | Geist Mono, caps, tracked | 11px | Labels for data values (BPM, KEY), never above a heading |
| `k-wordmark` | Inter 700, -0.045em | inherit | The name next to the mark |

The app's UI text sits at 13px (`text-[13px]`); table cells at 13px, secondary data at 12px.

## Components in the app

All in `src/components`. Reuse them before writing new markup.

- `brand/Mark`, `brand/Wordmark`: the asterisk and the lockup.
- `brand/Shape`: one shape, coloured with `text-*`, sized with `w-*`, rotated in quarter turns.
- `brand/CoverArt`: a cover in the editorial treatment, with the orange cut when `current`.
- `ui/waveform`: a static SVG waveform from real peaks; `progress` paints the played part, `active` paints it all orange. Without peaks it draws a flat line, never invented bars.
- `ui/color-chip`: a tag, genre or subgenre as a hairline pill with the user's colour as a dot.
- `ui/swatch-picker`: choose a palette colour (radio group with arrow keys).
- `layout/PageHeader`: title, mono meta, actions, optional tab row.
- `layout/SectionHeader`: a section title with an optional mono count.
- `layout/EmptyState` (+ `ShapeCluster`): a serif line, one sentence, the action, a shape composition; `size="page"` or `"inline"`; three arrangements so empty states don't repeat.
- `dj/NowPlaying`: the preview player, a panel on wide screens and a bar otherwise.
- `ui/*`: shadcn primitives restyled on the tokens. Buttons: `default` (orange, ink text) for the one primary action in view, `outline` for the rest, `ghost` for icon buttons, `link` for text actions.

## Patterns

- **Lists and tables:** 44px rows, a hairline between rows, mono index numbers, the current item tinted `bg-signal-soft` with its title in `text-signal-text`. Numbers right-aligned.
- **Forms:** label above the field (13px, medium), help text below in `muted-foreground`, errors in `destructive` next to the field.
- **Dialogs:** title in Inter, a one-line description, the primary action on the right of the footer. Use them for focused edits, not for things a page can show.
- **Confirmation:** `AlertDialog` naming the thing and what is lost.
- **Empty states:** say what is missing and how to fill it, in the product's own words. Use `EmptyState`.
- **Loading:** skeletons shaped like the content; never a spinner in the middle of a page.

## Canvas, charts and other non-CSS surfaces

Read the tokens at runtime, so canvases follow the theme:

```ts
const css = getComputedStyle(document.documentElement);
const color = (name: string, alpha = 1) => `hsl(${css.getPropertyValue(`--${name}`).trim()} / ${alpha})`;
ctx.strokeStyle = color("border");
ctx.fillStyle = color("signal");
```

Wait for `document.fonts.ready` before drawing text, scale the backing store by `devicePixelRatio`, and redraw when the theme class on `<html>` changes. Series colours come from `--data-1` … `--data-5`; categories the user named (genres, tags) keep the user's colour.

## Accessibility floor

WCAG 2.2 AA contrast for every text and control boundary (the token table above is measured), visible focus everywhere (`ring-ring`), every icon button labelled, every hover action reachable by keyboard, motion only for state and off under `prefers-reduced-motion`, touch targets of 44px on coarse pointers.

## Building a new view

1. Start with `PageHeader`; put the view's one primary action in its `actions`.
2. Lay the content out with hairlines and space; reach for `Card` only for independent objects (a set, a block).
3. Use `CoverArt`, `Waveform`, `ColorChip` for track data; mono only for numbers.
4. Design the empty, loading and error states before the full one.
5. Check both themes and 1440 / 1280 / 768 / 375px.
