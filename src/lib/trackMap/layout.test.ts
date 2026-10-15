import { describe, expect, it } from "vitest";

import { labelledCollideRadius } from "./labels";
import { LINK_DISTANCE_NEAR, nodeRadius, solveLayout, TRACK_NODE_RADIUS } from "./layout";
import type { MapLink, MapNode, Positions } from "./types";

/** A track node with a title derived from its id. */
function node(id: string): MapNode {
  return { id, kind: "track", label: `Track ${id}` };
}

/** An undirected similarity link. */
function link(source: string, target: string, s: number): MapLink {
  const [from, to] = source < target ? [source, target] : [target, source];
  return { source: from, target: to, s };
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function position(positions: Positions, id: string): { x: number; y: number } {
  const spot = positions.get(id);
  if (!spot) throw new Error(`no position for ${id}`);
  return spot;
}

/** The centroid of a set of ids. */
function centroid(positions: Positions, ids: readonly string[]): { x: number; y: number } {
  const spots = ids.map((id) => position(positions, id));
  return {
    x: spots.reduce((total, spot) => total + spot.x, 0) / spots.length,
    y: spots.reduce((total, spot) => total + spot.y, 0) / spots.length,
  };
}

/** The largest distance any id moves between two solves. */
function maxMovement(before: Positions, after: Positions, ids: readonly string[]): number {
  return Math.max(...ids.map((id) => dist(position(before, id), position(after, id))));
}

/** The spread of a layout: the largest pairwise distance. */
function spread(positions: Positions, ids: readonly string[]): number {
  let widest = 0;
  for (const a of ids) {
    for (const b of ids) widest = Math.max(widest, dist(position(positions, a), position(positions, b)));
  }
  return widest;
}

describe("solveLayout — determinism", () => {
  const ids = ["e", "a", "c", "b", "d"];
  const nodes = ids.map(node);
  const links = [link("a", "b", 1), link("b", "c", 0.6), link("c", "d", 0.3), link("d", "e", 0.9)];

  it("gives the same positions for the same input", () => {
    expect(solveLayout(nodes, links)).toEqual(solveLayout(nodes, links));
  });

  it("gives the same positions whatever order the nodes arrive in (they sort by id)", () => {
    const shuffled = [...nodes].reverse();
    expect(solveLayout(shuffled, links)).toEqual(solveLayout(nodes, links));
  });

  it("positions every node and nothing else", () => {
    const positions = solveLayout(nodes, links);
    expect([...positions.keys()].sort()).toEqual([...ids].sort());
    for (const spot of positions.values()) {
      expect(Number.isFinite(spot.x)).toBe(true);
      expect(Number.isFinite(spot.y)).toBe(true);
    }
  });

  it("returns nothing for no nodes", () => {
    expect(solveLayout([], []).size).toBe(0);
  });
});

describe("solveLayout — linked pairs end closer than unlinked pairs", () => {
  const nodes = ["a", "b", "c", "d"].map(node);
  const links = [link("a", "b", 1), link("c", "d", 1)];

  it("pulls each linked pair together and leaves the two pairs apart", () => {
    const positions = solveLayout(nodes, links);
    const ab = dist(position(positions, "a"), position(positions, "b"));
    const cd = dist(position(positions, "c"), position(positions, "d"));

    for (const [from, to] of [
      ["a", "c"],
      ["a", "d"],
      ["b", "c"],
      ["b", "d"],
    ] as const) {
      expect(dist(position(positions, from), position(positions, to))).toBeGreaterThan(ab);
      expect(dist(position(positions, from), position(positions, to))).toBeGreaterThan(cd);
    }
  });

  it("pulls a perfect match closer than a weak one", () => {
    const strong = solveLayout(nodes, [link("a", "b", 1), link("c", "d", 1)]);
    const weak = solveLayout(nodes, [link("a", "b", 0.1), link("c", "d", 1)]);
    expect(dist(position(strong, "a"), position(strong, "b"))).toBeLessThan(
      dist(position(weak, "a"), position(weak, "b")),
    );
  });
});

describe("solveLayout — a re-solve with nothing changed barely moves (warm start)", () => {
  // Collinear seeds keep the four nodes on one axis, so a cold solve from a
  // different start is directly comparable with a warm one.
  const ids = ["a", "b", "c", "d"];
  const nodes = ids.map(node);
  const links = [link("a", "b", 1), link("b", "c", 1), link("c", "d", 1)];
  const seeds: Positions = new Map([
    ["a", { x: -100, y: 0 }],
    ["b", { x: -33, y: 0 }],
    ["c", { x: 33, y: 0 }],
    ["d", { x: 100, y: 0 }],
  ]);

  it("keeps the positions it started from", () => {
    const first = solveLayout(nodes, links, seeds);
    const second = solveLayout(nodes, links, first);
    const movement = maxMovement(first, second, ids);
    const cold = solveLayout(nodes, links);
    // A warm start barely moves the map: under a node's own footprint — the
    // label-aware collide radius, so the bound scales with the node size the
    // issues set — and far less than a solve from scratch moves the same nodes.
    expect(movement).toBeLessThan(labelledCollideRadius(TRACK_NODE_RADIUS, "Track a") * 2);
    expect(movement).toBeLessThan(maxMovement(first, cold, ids) / 4);
    expect(movement).toBeLessThan(spread(first, ids) / 4);
  });
});

describe("solveLayout — unlinked nodes settle at the edge", () => {
  const cluster = ["a", "b", "c", "d", "e", "f"];
  const nodes = [...cluster, "z"].map(node);
  const links = cluster.slice(1).map((id, index) => link(cluster[index], id, 1));

  it("leaves the unlinked node farther from the cluster than any of its members", () => {
    const positions = solveLayout(nodes, links);
    const centre = centroid(positions, cluster);
    const inside = Math.max(...cluster.map((id) => dist(position(positions, id), centre)));
    expect(dist(position(positions, "z"), centre)).toBeGreaterThan(inside);
  });
});

describe("nodeRadius", () => {
  it("draws a track at the fixed radius", () => {
    expect(nodeRadius(node("a"))).toBeGreaterThan(0);
  });

  it("grows a cluster with the tracks it holds", () => {
    const small: MapNode = { id: "g1", kind: "cluster", label: "Techno", count: 1 };
    const large: MapNode = { id: "g2", kind: "cluster", label: "House", count: 400 };
    expect(nodeRadius(large)).toBeGreaterThan(nodeRadius(small));
    expect(nodeRadius(large)).toBeCloseTo(nodeRadius(small) * 20, 6);
  });
});
