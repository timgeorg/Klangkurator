import { describe, expect, it } from "vitest";

import { POSITION_ANIMATION_MS, animationProgress, easeOutCubic, interpolatePositions } from "./positionsAnimation";
import type { MapNode, Positions } from "./types";

/** A track node with a title derived from its id. */
function node(id: string): MapNode {
  return { id, kind: "track", label: `Track ${id}` };
}

/** A `Positions` map from plain coordinates. */
function positions(entries: Record<string, { x: number; y: number }>): Positions {
  return new Map(Object.entries(entries));
}

describe("easeOutCubic", () => {
  it("starts at 0 and ends at 1", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it("eases out: half the time is most of the distance", () => {
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 9);
    expect(easeOutCubic(0.25)).toBeGreaterThan(0.25);
    expect(easeOutCubic(0.75)).toBeGreaterThan(easeOutCubic(0.25));
  });

  it("clamps anything outside 0–1 and treats an unusable progress as 0", () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
    expect(easeOutCubic(Number.NaN)).toBe(0);
  });
});

describe("animationProgress", () => {
  it("runs from 0 to 1 over the plan's 400 ms", () => {
    expect(POSITION_ANIMATION_MS).toBe(400);
    expect(animationProgress(1000, 1000)).toBe(0);
    expect(animationProgress(1000, 1200)).toBeCloseTo(0.5, 9);
    expect(animationProgress(1000, 1400)).toBe(1);
  });

  it("clamps before the first frame and stays at the end", () => {
    expect(animationProgress(1000, 900)).toBe(0);
    expect(animationProgress(1000, 5000)).toBe(1);
  });

  it("is finished at once for a zero or unusable duration (the reduced-motion path)", () => {
    expect(animationProgress(1000, 1000, 0)).toBe(1);
    expect(animationProgress(1000, 1000, Number.NaN)).toBe(1);
  });
});

describe("interpolatePositions", () => {
  const nodes = [node("a"), node("b"), node("new")];
  const from = positions({ a: { x: 0, y: 0 }, b: { x: 10, y: 20 } });
  const to = positions({ a: { x: 100, y: 0 }, b: { x: 10, y: 0 }, new: { x: 5, y: 5 } });

  it("gives the new positions at the end, and the old ones plus the new node at the start", () => {
    const atEnd = interpolatePositions(nodes, from, to, 1);
    for (const [id, spot] of to) {
      expect(atEnd.get(id)?.x).toBeCloseTo(spot.x, 9);
      expect(atEnd.get(id)?.y).toBeCloseTo(spot.y, 9);
    }
    expect(interpolatePositions(nodes, from, to, 0)).toEqual(
      positions({ a: { x: 0, y: 0 }, b: { x: 10, y: 20 }, new: { x: 5, y: 5 } }),
    );
  });

  it("gives the midpoint halfway through", () => {
    expect(interpolatePositions(nodes, from, to, 0.5).get("a")).toEqual({ x: 50, y: 0 });
    expect(interpolatePositions(nodes, from, to, 0.5).get("b")).toEqual({ x: 10, y: 10 });
  });

  it("puts a node the canvas is not showing yet at its new place, not at the origin", () => {
    expect(interpolatePositions(nodes, from, to, 0.5).get("new")).toEqual({ x: 5, y: 5 });
  });

  it("leaves out a node with no new position, and no nodes means no positions", () => {
    expect([...interpolatePositions([node("gone")], from, to, 0.5).keys()]).toEqual([]);
    expect(interpolatePositions([], from, to, 0.5).size).toBe(0);
  });
});
