// Track map (issue #8) — what the renderer may draw under the active layers
// (plan phase 5). `visibleEdges` is the plan's step 10 filter: the model's
// edges narrowed by the rail's three layer switches and, for the computed
// nearest layer, by the selection. `offsetEdges` gives the edges that share a
// pair their side-by-side place, so several relationship types between the same
// two tracks — and a computed nearest line beside an authored one — are drawn
// beside each other rather than on top of one another (TM-L1, TM-L5) and A→B
// sits beside B→A (TM-L3). `onScreenEdgeKinds` reads the kinds actually drawn,
// which the rail's legend names, and `transitionNotes` the notes a transition
// edge carries, which the canvas shows as its label while a track is selected
// (TM-L2, TM-L6).
//
// Nothing here is a dependency of the model (`buildModel`), so switching a
// layer redraws and never re-solves the layout: no node moves (TM-L4).
import { RELATIONSHIP_TYPES } from "@/lib/relationshipStyle";

import type { MapEdge } from "./types";

/** The map's layer switches: the `layers` slice of `useMapConfig`. */
export interface LayerFlags {
  relationships: boolean;
  transitions: boolean;
  nearest: boolean;
}

/** The kinds a group of edges is spread in: authored first, nearest last. */
const KIND_ORDER: Record<MapEdge["kind"], number> = { relationship: 0, transition: 1, nearest: 2 };
/** The gap two edges on the same pair leave each other, in px. */
export const PARALLEL_EDGE_SPACING = 6;

/** An edge with the side-by-side place it takes among the edges on its pair. */
export interface OffsetEdge {
  edge: MapEdge;
  /** Perpendicular offset from the straight line between the two tracks, in px. */
  offset: number;
}

/** The edge kinds the canvas is drawing, which the rail's legend names. */
export interface EdgeKinds {
  /** The authored relationship types on screen, in the order the legends list them. */
  relationshipTypes: string[];
  transitions: boolean;
  nearest: boolean;
}

/**
 * The edges the renderer may draw under these layers, in the model's order.
 *
 * The authored relationships and the transitions each follow their own switch;
 * the computed nearest edges show only around the selected track, so the map is
 * not a hairball of every link. Switching a layer changes this list and nothing
 * else — the layout is solved from the model, never from the layers (TM-L4).
 *
 * @param edges - Every edge the model holds.
 * @param layers - The rail's layer switches.
 * @param selectedId - The selected track, or null; the nearest layer follows it.
 */
export function visibleEdges(
  edges: readonly MapEdge[],
  layers: LayerFlags,
  selectedId: string | null = null,
): MapEdge[] {
  return edges.filter((edge) => {
    if (edge.kind === "relationship") return layers.relationships;
    if (edge.kind === "transition") return layers.transitions;
    return layers.nearest && (edge.source === selectedId || edge.target === selectedId);
  });
}

/**
 * The edges with the side-by-side offset each one draws at.
 *
 * Every edge that joins the same two tracks — several relationship types, the
 * two directions of a transition, and the computed nearest edge beside them —
 * is spread symmetrically across the line, so they are drawn beside each other
 * and never on top of each other (TM-L1, TM-L3, TM-L5). A pair carrying a single
 * edge keeps it on the line. The spread follows the pair's lower id to its
 * higher one, so a pair's edges keep their own sides whichever way each one
 * points. The returned list keeps the input order, one entry per edge, and is
 * deterministic.
 *
 * @param edges - The edges to place.
 */
export function offsetEdges(edges: readonly MapEdge[]): OffsetEdge[] {
  const byPair = new Map<string, number[]>();
  edges.forEach((edge, index) => {
    const list = byPair.get(pairKey(edge));
    if (list) list.push(index);
    else byPair.set(pairKey(edge), [index]);
  });

  const offsets = new Map<number, number>();
  for (const indexes of byPair.values()) {
    const ordered = [...indexes].sort((a, b) => compareEdges(edges[a], edges[b]));
    ordered.forEach((index, position) => {
      offsets.set(index, (position - (ordered.length - 1) / 2) * PARALLEL_EDGE_SPACING);
    });
  }

  return edges.map((edge, index) => ({ edge, offset: offsets.get(index) ?? 0 }));
}

/**
 * The kinds of edge the canvas is drawing, for the legend: the authored
 * relationship types on screen in the palette's own order (then any type the
 * data carries that the palette does not name, sorted), and whether a
 * transition or a nearest edge is on screen.
 *
 * The legend names what is drawn rather than what could be, so a switched-off
 * layer — or a type the library holds no edge for — stays out of it (TM-L1,
 * TM-L5).
 *
 * @param edges - The edges the canvas is drawing.
 */
export function onScreenEdgeKinds(edges: readonly MapEdge[]): EdgeKinds {
  const types = new Set<string>();
  let transitions = false;
  let nearest = false;
  for (const edge of edges) {
    if (edge.kind === "relationship") {
      if (edge.relationshipType) types.add(edge.relationshipType);
    } else if (edge.kind === "transition") {
      transitions = true;
    } else {
      nearest = true;
    }
  }

  const named = new Set<string>(RELATIONSHIP_TYPES);
  const known = RELATIONSHIP_TYPES.filter((type) => type !== "transition" && types.has(type));
  const rest = [...types].filter((type) => !named.has(type)).sort(compare);
  return { relationshipTypes: [...known, ...rest], transitions, nearest };
}

/**
 * The notes a transition edge carries, once each, in order of appearance across
 * its sources: the same note written on a block and on the set that contains it
 * is one label (TM-L2). An edge of another kind, or a transition without notes,
 * carries none.
 *
 * @param edge - The edge to read.
 */
export function transitionNotes(edge: MapEdge): string[] {
  if (edge.kind !== "transition") return [];
  const notes: string[] = [];
  for (const source of edge.sources ?? []) {
    for (const note of source.notes) if (!notes.includes(note)) notes.push(note);
  }
  return notes;
}

/** The pair two edges share, whatever way each of them points. */
function pairKey(edge: MapEdge): string {
  return edge.source <= edge.target
    ? `${edge.source}\u0000${edge.target}`
    : `${edge.target}\u0000${edge.source}`;
}

/** The order a pair's own edges are spread in: by kind, then type, then direction. */
function compareEdges(a: MapEdge, b: MapEdge): number {
  const kind = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  if (kind !== 0) return kind;
  const type = compare(a.relationshipType ?? "", b.relationshipType ?? "");
  if (type !== 0) return type;
  return compare(a.source, b.source) || compare(a.target, b.target);
}

/** A plain code-unit comparison, so the spread never depends on a locale. */
function compare(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
