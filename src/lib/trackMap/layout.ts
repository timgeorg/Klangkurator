// Track map (issue #8) — the headless force-directed layout (plan phase 2).
// This is the plan's algorithm contract: `solveLayout(nodes, links, seeds)`
// returns the positions the renderer draws, and the renderer only draws — it
// never simulates. Nodes are sorted by id before solving, so the same input
// always gives the same output (d3-force v3 draws its jiggle from a fixed-seed
// generator); a re-solve starts from the positions on screen, so the map keeps
// its shape.
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from "d3-force";
import type { SimulationLinkDatum, SimulationNodeDatum } from "d3-force";

import { labelledCollideRadius } from "./labels";
import type { MapLink, MapNode, Positions } from "./types";

/** The disc a track node draws at, in graph units (issue #31 doubles the old 7). */
export const TRACK_NODE_RADIUS = 20;

/** Link distance at `s = 0` (267) down to 97 at `s = 1`; it must clear the
 * label-aware collide floor, or a link would be pushed apart by the collision
 * and similarity could not express itself at all. */
export const LINK_DISTANCE_NEAR = 97;
export const LINK_DISTANCE_SPAN = 170;
/** The many-body charge and the range it acts over. */
export const CHARGE_STRENGTH = -500;
export const CHARGE_DISTANCE_MAX = 350;
/** The weak centre that keeps the map on the origin. */
export const CENTRE_STRENGTH = 0.05;
/**
 * Synchronous ticks after `simulation.stop()`. The issues make every node
 * bigger and give it room for its label, so the layout has further to travel
 * before it settles than the radius-7 map did. At 400 the measured movement
 * between two solves is 0.0 on the test map, and the warm-start test holds on a
 * real-sized map too.
 */
export const LAYOUT_TICKS = 400;
/** The golden angle: the spiral the new nodes with no seed of their own take. */
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
/** Distance between two turns of that spiral, about a link length. */
const SEED_SPACING = 30;

/**
 * The radius a node draws and collides at. A track is a disc of
 * `TRACK_NODE_RADIUS`; a cluster grows with the tracks it holds (by area, so
 * the radius takes the square root). Phase 6 tunes the cluster sizing.
 *
 * @param node - The map node.
 */
export function nodeRadius(node: MapNode): number {
  if (node.kind === "cluster") return TRACK_NODE_RADIUS * Math.sqrt(Math.max(1, node.count ?? 1));
  return TRACK_NODE_RADIUS;
}

/**
 * The radius the layout separates a node by. A track reserves room for its
 * label as well as its disc (issue #37: every label draws at once, so the layout
 * has to make room rather than the renderer hide some). A cluster also draws a
 * label — its value and count — so it reserves room for that too, at the
 * cluster's own size.
 *
 * @param node - The map node.
 */
function collideRadius(node: MapNode): number {
  const radius = nodeRadius(node);
  return labelledCollideRadius(radius, collideLabel(node));
}

/** The text a node reserves label room for: a track's title, a cluster's value. */
function collideLabel(node: MapNode): string {
  if (node.kind === "cluster") return `${node.label} · ${node.count ?? 0}`;
  return node.label;
}

/** A node as the simulation holds it: its id, its map node and a position. */
interface LayoutNode extends SimulationNodeDatum {
  id: string;
  node: MapNode;
}

/** A link as the simulation holds it: the two ends and the similarity that pulled them together. */
interface LayoutLink extends SimulationLinkDatum<LayoutNode> {
  s: number;
}

/**
 * The positions of every node, solved headless.
 *
 * Nodes are sorted by id before solving, links pull by
 * `30 + 120 × (1 − s)` at strength `s`, the many-body charge is −120 with
 * `distanceMax` 600, a weak centre (0.05) holds the mean on the origin and
 * collide separates nodes by their label-aware radius (`collideRadius`) — a
 * track reserves room for its title as well as its disc, so no two labels can
 * overlap however the map settles (issue #37). A node whose position is in
 * `seeds` — the positions on screen, mid-animation positions included — starts
 * there; a node without one starts at the mean of its linked neighbours'
 * seeds, else on a golden-angle spiral over the new nodes in id order. The
 * simulation is stopped and ticked `LAYOUT_TICKS` times synchronously, so the
 * result is deterministic and a re-solve of an unchanged map barely moves.
 *
 * Unlinked nodes feel only the charge and the centre, so they settle at the
 * edge of the map.
 *
 * @param nodes - The map's nodes.
 * @param links - What the layout runs on: the undirected nearest links.
 * @param seeds - The positions already on screen, for a warm start.
 */
export function solveLayout(nodes: readonly MapNode[], links: readonly MapLink[], seeds: Positions = new Map()): Positions {
  if (nodes.length === 0) return new Map();

  const ordered = [...nodes].sort((a, b) => compare(a.id, b.id));
  const neighbours = neighboursOf(links);
  const simNodes: LayoutNode[] = ordered.map((node) => ({ id: node.id, node }));

  // Seeds, in id order: an existing position, else the mean of the linked
  // neighbours that have one, else the spiral.
  let spiral = 0;
  for (const simNode of simNodes) {
    const seed = seeds.get(simNode.id);
    if (seed) {
      simNode.x = seed.x;
      simNode.y = seed.y;
      continue;
    }
    const linkedSeeds = (neighbours.get(simNode.id) ?? [])
      .map((id) => seeds.get(id))
      .filter((position): position is { x: number; y: number } => !!position);
    if (linkedSeeds.length > 0) {
      simNode.x = mean(linkedSeeds.map((position) => position.x));
      simNode.y = mean(linkedSeeds.map((position) => position.y));
      continue;
    }
    const radius = SEED_SPACING * Math.sqrt(spiral + 1);
    const angle = spiral * GOLDEN_ANGLE;
    simNode.x = Math.cos(angle) * radius;
    simNode.y = Math.sin(angle) * radius;
    spiral += 1;
  }

  const ids = new Set(ordered.map((node) => node.id));
  // A link to a node outside the set cannot be laid out; skip it rather than
  // let the link force throw on an unknown id.
  const simLinks: LayoutLink[] = links
    .filter((link) => ids.has(link.source) && ids.has(link.target))
    .map((link) => ({ source: link.source, target: link.target, s: link.s }));

  const simulation = forceSimulation<LayoutNode, LayoutLink>(simNodes)
    .force(
      "link",
      forceLink<LayoutNode, LayoutLink>(simLinks)
        .id((node) => node.id)
        .distance((link) => LINK_DISTANCE_NEAR + LINK_DISTANCE_SPAN * (1 - link.s))
        .strength((link) => link.s),
    )
    .force("charge", forceManyBody<LayoutNode>().strength(CHARGE_STRENGTH).distanceMax(CHARGE_DISTANCE_MAX))
    .force("centre", forceCenter<LayoutNode>(0, 0).strength(CENTRE_STRENGTH))
    .force("collide", forceCollide<LayoutNode>((node) => collideRadius(node.node)));

  simulation.stop();
  for (let tick = 0; tick < LAYOUT_TICKS; tick += 1) simulation.tick();

  const positions: Positions = new Map();
  for (const simNode of simNodes) positions.set(simNode.id, { x: simNode.x ?? 0, y: simNode.y ?? 0 });
  return positions;
}

/** Who each node is linked to, both ways round. */
function neighboursOf(links: readonly MapLink[]): Map<string, string[]> {
  const neighbours = new Map<string, string[]>();
  const add = (id: string, other: string): void => {
    const list = neighbours.get(id);
    if (list) list.push(other);
    else neighbours.set(id, [other]);
  };
  for (const link of links) {
    add(link.source, link.target);
    add(link.target, link.source);
  }
  return neighbours;
}

function mean(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function compare(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
