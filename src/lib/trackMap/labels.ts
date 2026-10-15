// Track map (issues #31, #37) — label geometry, kept pure so the layout and the
// renderer agree on how much room a title needs.
//
// Labels are no longer truncated and no longer hidden: every track's title draws
// in full, wrapped onto as many lines as it needs, in a smaller face than before.
// That is only readable if the layout leaves room, so this module computes the
// box a label occupies in graph units and the layout collides by it.
//
// Two sizes are in play, on purpose:
// - `LABEL_GRAPH_FONT` is the size the *layout* reserves space for, in graph
//   units. It is fixed, so the solve stays deterministic and independent of the
//   camera.
// - the *renderer* draws the label at `LABEL_GRAPH_FONT × zoom`, clamped to a
//   readable band. The clamp only ever shrinks the drawn text below what was
//   reserved (never grows past it), so a zoomed-out map cannot make two labels
//   collide; a zoomed-in one draws the same smaller-than-reserved text, which is
//   the "labels get more air when you zoom in" behaviour.

/** The font the layout reserves room for, in graph units. */
export const LABEL_GRAPH_FONT = 11;
/** The screen band the drawn label stays inside, in pixels. */
export const LABEL_MIN_SCREEN_PX = 8;
export const LABEL_MAX_SCREEN_PX = 14;
/** A long title drops a notch smaller, so a dense map stays legible. */
export const LABEL_SMALL_FONT = 8;
/** The width a label may occupy before it wraps, in graph units. */
export const LABEL_WRAP_WIDTH = 74;
/** Line spacing, as a multiple of the font size. */
export const LABEL_LINE_HEIGHT = 1.3;
/** The gap the label leaves under its node. */
export const LABEL_GAP = 6;
/** The label box's padding around its text. */
export const LABEL_BOX_PAD_X = 5;
export const LABEL_BOX_PAD_Y = 3;
/** Above this many characters a title uses the smaller face. */
export const LABEL_SMALL_AFTER = 24;
/** The average glyph width of the app's UI face, as a fraction of the font size. */
const GLYPH_WIDTH = 0.52;

/** Text measured without a canvas, so the pure layout can still size a label. */
export function estimateTextWidth(text: string, fontPx: number): number {
  return text.length * fontPx * GLYPH_WIDTH;
}

/**
 * Breaks a title into the lines that fit `maxWidth`, preferring spaces. A word
 * wider than the line on its own is broken mid-word, so nothing is ever cut off
 * — a long unbroken title still draws in full, on more lines.
 */
export function wrapLabel(title: string, maxWidth: number, fontPx: number): string[] {
  const text = title.trim();
  if (!text) return [];
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (estimateTextWidth(candidate, fontPx) <= maxWidth || !line) {
      // A single word wider than the line is broken here, below.
      if (estimateTextWidth(candidate, fontPx) > maxWidth && !line) {
        let chunk = "";
        for (const char of word) {
          if (chunk && estimateTextWidth(chunk + char, fontPx) > maxWidth) {
            lines.push(chunk);
            chunk = char;
          } else {
            chunk += char;
          }
        }
        line = chunk;
        continue;
      }
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  return lines;
}

/** The face a title draws in: a notch smaller once it is long. */
export function labelFontSize(title: string): number {
  return title.trim().length > LABEL_SMALL_AFTER ? LABEL_SMALL_FONT : LABEL_GRAPH_FONT;
}

/** The label's box in graph units: how wide it is and how tall, once wrapped. */
export interface LabelBox {
  lines: number;
  halfWidth: number;
  height: number;
}

/**
 * The box a title occupies at the layout's reserved font, wrapped at
 * `LABEL_WRAP_WIDTH`.
 */
export function labelBox(title: string, fontPx: number = LABEL_GRAPH_FONT): LabelBox {
  const lines = wrapLabel(title, LABEL_WRAP_WIDTH, fontPx);
  const count = Math.max(1, lines.length);
  const widest = lines.reduce((max, line) => Math.max(max, estimateTextWidth(line, fontPx)), 0);
  const textWidth = Math.max(LABEL_MIN_TEXT_WIDTH, widest);
  return {
    lines: count,
    halfWidth: textWidth / 2 + LABEL_BOX_PAD_X,
    height: count * fontPx * LABEL_LINE_HEIGHT + LABEL_BOX_PAD_Y * 2,
  };
}

/** A label never reserves less than this, so two-letter titles still get air. */
const LABEL_MIN_TEXT_WIDTH = 26;

/**
 * The circle the layout collides a labelled node by: big enough to hold the
 * disc and the label box under it, so two labelled tracks never land on top of
 * each other. Cluster nodes keep their own sizing (a cluster is never labelled
 * with a track title; it draws its value and count).
 *
 * @param nodeRadius - The node's own drawn radius.
 * @param title - The track's title.
 */
export function labelledCollideRadius(nodeRadius: number, title: string): number {
  const box = labelBox(title);
  const vertical = nodeRadius + LABEL_GAP + box.height;
  return Math.max(box.halfWidth, vertical / 2) + COLLIDE_ALLOWANCE;
}

/** The slack the collision leaves, so labels do not sit edge to edge. */
const COLLIDE_ALLOWANCE = 4;
