import { describe, expect, it } from "vitest";

import {
  PARALLEL_EDGE_SPACING,
  offsetEdges,
  onScreenEdgeKinds,
  transitionNotes,
  visibleEdges,
  type LayerFlags,
} from "./layerEdges";
import type { MapEdge, TransitionSource } from "./types";

const ALL_ON: LayerFlags = { relationships: true, transitions: true, nearest: true };

function relationshipEdge(source: string, target: string, type: string): MapEdge {
  return { source, target, kind: "relationship", relationshipType: type };
}

function transitionEdge(source: string, target: string, sources: TransitionSource[] = []): MapEdge {
  return { source, target, kind: "transition", sources };
}

function nearestEdge(source: string, target: string): MapEdge {
  return { source, target, kind: "nearest" };
}

function source(
  kind: TransitionSource["kind"],
  id: string,
  notes: string[],
  name?: string,
): TransitionSource {
  return { kind, id, name, notes };
}

describe("visibleEdges — the layer switches", () => {
  const edges: MapEdge[] = [
    nearestEdge("A", "B"),
    relationshipEdge("A", "B", "remix"),
    transitionEdge("A", "B", [source("relationship", "r1", ["echo out"])]),
  ];

  it("draws every kind when every layer is on and the selection is an end", () => {
    expect(visibleEdges(edges, ALL_ON, "A")).toEqual(edges);
  });

  it("drops the authored relationships when that layer is off", () => {
    const drawn = visibleEdges(edges, { ...ALL_ON, relationships: false }, "A");
    expect(drawn.map((edge) => edge.kind)).toEqual(["nearest", "transition"]);
  });

  it("drops the transitions when that layer is off", () => {
    const drawn = visibleEdges(edges, { ...ALL_ON, transitions: false }, "A");
    expect(drawn.map((edge) => edge.kind)).toEqual(["nearest", "relationship"]);
  });

  it("shows the nearest layer only around the selected track", () => {
    const both: MapEdge[] = [nearestEdge("A", "B"), nearestEdge("C", "D")];
    expect(visibleEdges(both, ALL_ON, "A")).toEqual([both[0]]);
    expect(visibleEdges(both, ALL_ON, "C")).toEqual([both[1]]);
    expect(visibleEdges(both, ALL_ON, null)).toEqual([]);
  });

  it("drops the nearest layer entirely when it is off, selection or not", () => {
    expect(visibleEdges([nearestEdge("A", "B")], { ...ALL_ON, nearest: false }, "A")).toEqual([]);
  });

  it("keeps the model's order and leaves the model's edges untouched", () => {
    const model: MapEdge[] = [transitionEdge("C", "D"), relationshipEdge("A", "B", "cover"), nearestEdge("E", "F")];
    const drawn = visibleEdges(model, ALL_ON, "E");
    expect(drawn).toEqual(model);
    expect(drawn.every((edge, index) => edge === model[index])).toBe(true);
  });
});

describe("offsetEdges — side by side, never on top", () => {
  it("leaves a lone edge on the line", () => {
    const edges = [relationshipEdge("A", "B", "remix")];
    expect(offsetEdges(edges)).toEqual([{ edge: edges[0], offset: 0 }]);
  });

  it("takes a pair with two edges off the line, one each side", () => {
    const edges = [transitionEdge("A", "B"), nearestEdge("A", "B")];
    expect(offsetEdges(edges).map((entry) => entry.offset)).toEqual([
      -PARALLEL_EDGE_SPACING / 2,
      PARALLEL_EDGE_SPACING / 2,
    ]);
  });

  it("puts two relationship types on one pair on opposite sides", () => {
    const edges = [relationshipEdge("A", "B", "mashup"), relationshipEdge("A", "B", "remix")];
    const offsets = offsetEdges(edges).map((entry) => entry.offset);
    expect(offsets).toEqual([-PARALLEL_EDGE_SPACING / 2, PARALLEL_EDGE_SPACING / 2]);
  });

  it("spreads three types across the line, the middle one on it", () => {
    const edges = [
      relationshipEdge("A", "B", "cover"),
      relationshipEdge("A", "B", "edit"),
      relationshipEdge("A", "B", "remix"),
    ];
    expect(offsetEdges(edges).map((entry) => entry.offset)).toEqual([
      -PARALLEL_EDGE_SPACING,
      0,
      PARALLEL_EDGE_SPACING,
    ]);
  });

  it("keeps the two directions of one transition apart", () => {
    const edges = [transitionEdge("A", "B"), transitionEdge("B", "A")];
    expect(offsetEdges(edges).map((entry) => entry.offset)).toEqual([
      -PARALLEL_EDGE_SPACING / 2,
      PARALLEL_EDGE_SPACING / 2,
    ]);
  });

  it("puts a relationship and a transition on one pair beside each other", () => {
    const edges = [relationshipEdge("A", "B", "remix"), transitionEdge("B", "A")];
    // The relationship leads by kind, whatever the pair's own direction is.
    expect(offsetEdges(edges).map((entry) => entry.offset)).toEqual([
      -PARALLEL_EDGE_SPACING / 2,
      PARALLEL_EDGE_SPACING / 2,
    ]);
  });

  it("gives a nearest edge its own lane beside the authored ones on the pair", () => {
    const edges = [
      nearestEdge("A", "B"),
      relationshipEdge("A", "B", "mashup"),
      relationshipEdge("A", "B", "remix"),
    ];
    // Authored kinds lead, the computed nearest edge takes the last lane, so
    // the two kinds of edge on one pair never cover each other (TM-L5).
    expect(offsetEdges(edges).map((entry) => entry.offset)).toEqual([
      PARALLEL_EDGE_SPACING,
      -PARALLEL_EDGE_SPACING,
      0,
    ]);
  });

  it("leaves a pair with a single nearest edge on the line", () => {
    const edges = [nearestEdge("A", "B")];
    expect(offsetEdges(edges).map((entry) => entry.offset)).toEqual([0]);
  });

  it("pairs by endpoints, not by direction or kind, and leaves other pairs alone", () => {
    const edges = [relationshipEdge("A", "B", "remix"), relationshipEdge("B", "A", "remix"), relationshipEdge("C", "D", "remix")];
    expect(offsetEdges(edges).map((entry) => entry.offset)).toEqual([
      -PARALLEL_EDGE_SPACING / 2,
      PARALLEL_EDGE_SPACING / 2,
      0,
    ]);
  });

  it("is deterministic and keeps one entry per edge, in order", () => {
    const edges = [relationshipEdge("A", "B", "mashup"), transitionEdge("A", "B"), relationshipEdge("A", "B", "remix")];
    const first = offsetEdges(edges);
    const second = offsetEdges(edges);
    expect(first).toEqual(second);
    expect(first.map((entry) => entry.edge)).toEqual(edges);
  });
});

describe("transitionNotes", () => {
  it("merges the notes of every source, once each, in order of appearance", () => {
    const edge = transitionEdge("T1", "T2", [
      source("relationship", "r1", ["echo out"]),
      source("block", "B", ["filter swap"], "Block B"),
      source("set", "S", ["filter swap", "echo out"], "Set S"),
    ]);
    expect(transitionNotes(edge)).toEqual(["echo out", "filter swap"]);
  });

  it("is empty for a transition without notes", () => {
    expect(transitionNotes(transitionEdge("A", "B"))).toEqual([]);
  });

  it("is empty for an edge of another kind", () => {
    expect(transitionNotes(relationshipEdge("A", "B", "remix"))).toEqual([]);
    expect(transitionNotes(nearestEdge("A", "B"))).toEqual([]);
  });
});

describe("onScreenEdgeKinds", () => {
  it("lists the authored types on screen in the palette's order", () => {
    const kinds = onScreenEdgeKinds([
      relationshipEdge("A", "B", "same_sample"),
      relationshipEdge("B", "C", "remix"),
      relationshipEdge("C", "D", "remix"),
    ]);
    expect(kinds.relationshipTypes).toEqual(["remix", "same_sample"]);
  });

  it("reads the transition and nearest layers off what is drawn", () => {
    expect(onScreenEdgeKinds([transitionEdge("A", "B")])).toMatchObject({ transitions: true, nearest: false });
    expect(onScreenEdgeKinds([nearestEdge("A", "B")])).toMatchObject({ transitions: false, nearest: true });
  });

  it("names nothing when nothing is drawn", () => {
    expect(onScreenEdgeKinds([])).toEqual({ relationshipTypes: [], transitions: false, nearest: false });
  });

  it("keeps a type the palette does not name, after the named ones", () => {
    const kinds = onScreenEdgeKinds([
      relationshipEdge("A", "B", "unheard_of"),
      relationshipEdge("B", "C", "cover"),
    ]);
    expect(kinds.relationshipTypes).toEqual(["cover", "unheard_of"]);
  });
});
