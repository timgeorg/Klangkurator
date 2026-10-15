// Track map (issue #8) — the re-layout animation's arithmetic (the canvas of
// plan phase 2, the contract of phase 4b): the one motion the design system
// allows past its 150–220 ms rule. It is kept pure and out of the canvas so the
// timing is tested rather than eyeballed — the canvas only samples it once per
// frame and draws the result (TM-R2).
import type { MapNode, Positions } from "./types";

/** How long a re-layout takes to move into place: the plan's 400 ms, ease-out. */
export const POSITION_ANIMATION_MS = 400;

/**
 * The eased progress of a re-layout: ease-out cubic, so the nodes leave quickly
 * and settle softly. 0 gives 0 and 1 gives 1, and anything outside 0–1 is
 * clamped, so a late or early frame cannot overshoot.
 *
 * @param progress - How far into the animation the frame is, 0–1.
 */
export function easeOutCubic(progress: number): number {
  const t = clamp01(progress);
  return 1 - (1 - t) ** 3;
}

/**
 * How far into the animation a moment is: 0 at the start and 1 at the end. A
 * duration of zero (or an unusable one) is instantly finished, which is the
 * reduced-motion path.
 *
 * @param startedAt - The frame time the animation began at.
 * @param now - The frame time to measure.
 * @param duration - How long the animation takes; the plan's 400 ms.
 */
export function animationProgress(startedAt: number, now: number, duration = POSITION_ANIMATION_MS): number {
  if (!(duration > 0)) return 1;
  return clamp01((now - startedAt) / duration);
}

/**
 * The positions to draw `eased` of the way from `from` to `to`. Every node the
 * canvas already knows moves from where it is towards its new place; a node with
 * no position of its own — one new to the shown set — starts at its new place,
 * so it appears in position rather than flying in from the origin. A node with
 * no new position is left out.
 *
 * @param nodes - The map's nodes, in the order the canvas draws them.
 * @param from - The positions on screen.
 * @param to - The solved positions the animation is heading for.
 * @param eased - The eased progress, 0–1 (`easeOutCubic`).
 */
export function interpolatePositions(
  nodes: readonly MapNode[],
  from: Positions,
  to: Positions,
  eased: number,
): Positions {
  const next: Positions = new Map();
  for (const node of nodes) {
    const target = to.get(node.id);
    if (!target) continue;
    const start = from.get(node.id) ?? target;
    next.set(node.id, { x: start.x + (target.x - start.x) * eased, y: start.y + (target.y - start.y) * eased });
  }
  return next;
}

/** A number forced into 0–1; anything unusable counts as 0. */
function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
