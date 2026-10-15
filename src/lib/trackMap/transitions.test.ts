import { describe, expect, it } from "vitest";

import type { Block, DJSet, SetItem, SongRelationship } from "@/lib/storage";

import { buildTransitions, type TransitionInputs } from "./transitions";

const relationship = (
  id: string,
  source: string,
  target: string,
  type: SongRelationship["relationship_type"] = "remix",
  notes?: string,
): SongRelationship => ({
  id,
  source_song_id: source,
  target_song_id: target,
  relationship_type: type,
  notes,
  created_at: "2026-10-15T00:00:00Z",
});

const songItem = (position: number, songId: string, notes?: string): SetItem => ({
  id: `item-${position}`,
  type: "song",
  ref_id: songId,
  position,
  transition_notes: notes,
});

const blockItem = (position: number, blockId: string, notes?: string): SetItem => ({
  id: `item-${position}`,
  type: "block",
  ref_id: blockId,
  position,
  transition_notes: notes,
});

const set = (items: SetItem[], id = "S", name = "Set S"): DJSet =>
  ({ id, name, items, phases: [], color: "#000", created_at: "", updated_at: "" }) as DJSet;

const block = (id: string, name: string, songs: Array<[string, number, string?]>): Block => ({
  id,
  name,
  songs: songs.map(([song_id, position, transition_notes]) => ({ song_id, position, transition_notes })),
  color: "#000",
  created_at: "",
  updated_at: "",
});

const songs = (...ids: string[]) => ids.map((id) => ({ id }));

describe("buildTransitions — the three sources and dedup", () => {
  it("matches the worked example: T1→T2 from all three, and the set's neighbours", () => {
    const inputs: TransitionInputs = {
      relationships: [relationship("r1", "T1", "T2", "transition", "echo out")],
      blocks: [block("B", "Block B", [["T1", 0, "filter swap"], ["T2", 1]])],
      sets: [set([songItem(0, "S1"), blockItem(1, "B"), songItem(2, "S2")])],
      songs: songs("T1", "T2", "S1", "S2"),
    };
    const edges = buildTransitions(inputs);

    expect(edges.map((edge) => `${edge.source}→${edge.target}`)).toEqual(["S1→T1", "T1→T2", "T2→S2"]);

    const main = edges.find((edge) => edge.source === "T1" && edge.target === "T2")!;
    expect(main.kind).toBe("transition");
    expect(main.sources).toHaveLength(3);
    expect(main.sources.map((source) => source.kind)).toEqual(["relationship", "block", "set"]);
    expect(main.sources[0]).toMatchObject({ kind: "relationship", id: "r1", notes: ["echo out"] });
    expect(main.sources[1]).toMatchObject({ kind: "block", id: "B", name: "Block B", notes: ["filter swap"] });
    expect(main.sources[2]).toMatchObject({ kind: "set", id: "S", notes: ["filter swap"] });

    const into = edges.find((edge) => edge.source === "S1")!;
    expect(into.sources.map((source) => source.kind)).toEqual(["set"]);

    const out = edges.find((edge) => edge.source === "T2")!;
    expect(out.target).toBe("S2");
    expect(out.sources.map((source) => source.kind)).toEqual(["set"]);
  });

  it("gives a set item's note to the pair that leaves it", () => {
    const inputs: TransitionInputs = {
      blocks: [block("B", "Block B", [["T1", 0], ["T2", 1]])],
      sets: [set([songItem(0, "S1", "drop on the 1"), blockItem(1, "B")])],
      songs: songs("S1", "T1", "T2"),
    };
    const edges = buildTransitions(inputs);
    const into = edges.find((edge) => edge.source === "S1" && edge.target === "T1")!;
    expect(into.sources[0].notes).toEqual(["drop on the 1"]);
  });

  it("carries a set item's note across a block's own last track", () => {
    // The block's second song leaves the block, so the item boundary's note applies.
    const inputs: TransitionInputs = {
      blocks: [block("B", "Block B", [["T1", 0, "inside the block"], ["T2", 1]])],
      sets: [set([blockItem(0, "B", "out of the block"), songItem(1, "S2")])],
      songs: songs("T1", "T2", "S2"),
    };
    const edges = buildTransitions(inputs);
    const inside = edges.find((edge) => edge.source === "T1" && edge.target === "T2")!;
    expect(inside.sources.find((source) => source.kind === "block")!.notes).toEqual(["inside the block"]);
    const leaving = edges.find((edge) => edge.source === "T2" && edge.target === "S2")!;
    expect(leaving.sources[0].notes).toEqual(["out of the block"]);
  });

  it("keeps the two directions apart (A→B and B→A are separate edges)", () => {
    const inputs: TransitionInputs = {
      relationships: [relationship("r1", "A", "B", "transition"), relationship("r2", "B", "A", "transition")],
    };
    const edges = buildTransitions(inputs);
    expect(edges.map((edge) => `${edge.source}→${edge.target}`)).toEqual(["A→B", "B→A"]);
  });

  it("collapses a fact a source repeats, and keeps its notes unique", () => {
    // The same block twice in one set repeats its T1→T2 fact; one block source, one note.
    const inputs: TransitionInputs = {
      blocks: [block("B", "Block B", [["T1", 0, "swap"], ["T2", 1]])],
      sets: [set([blockItem(0, "B"), blockItem(1, "B")])],
      songs: songs("T1", "T2"),
    };
    const edges = buildTransitions(inputs);
    const main = edges.find((edge) => edge.source === "T1" && edge.target === "T2")!;
    const blockSources = main.sources.filter((source) => source.kind === "block");
    expect(blockSources).toHaveLength(1);
    expect(blockSources[0].notes).toEqual(["swap"]);
  });

  it("keeps one source per (kind, id), not per fact", () => {
    const inputs: TransitionInputs = {
      relationships: [
        relationship("r2", "A", "B", "transition", "second"),
        relationship("r1", "A", "B", "transition", "first"),
        relationship("r3", "A", "B", "transition", "second"),
      ],
    };
    const edges = buildTransitions(inputs);
    expect(edges).toHaveLength(1);
    expect(edges[0].sources).toHaveLength(3); // one per (kind, id)
    expect(edges[0].sources.map((source) => source.id)).toEqual(["r1", "r2", "r3"]);
  });
});

describe("buildTransitions — gaps and edge cases", () => {
  it("matches the worked example: a deleted track breaks the chain", () => {
    const inputs: TransitionInputs = {
      sets: [set([songItem(0, "S1"), songItem(1, "gone"), songItem(2, "S2")])],
      songs: songs("S1", "S2"),
    };
    const edges = buildTransitions(inputs);
    expect(edges.map((edge) => `${edge.source}→${edge.target}`)).not.toContain("S1→S2");
    expect(edges).toEqual([]);
  });

  it("a missing block breaks the chain around its slot", () => {
    const inputs: TransitionInputs = {
      sets: [set([songItem(0, "S1"), blockItem(1, "gone"), songItem(2, "S2")])],
      blocks: [],
      songs: songs("S1", "S2"),
    };
    expect(buildTransitions(inputs)).toEqual([]);
  });

  it("a missing song inside a block breaks the chain inside the block too", () => {
    const inputs: TransitionInputs = {
      blocks: [block("B", "Block B", [["T1", 0], ["gone", 1], ["T2", 2]])],
      sets: [],
      songs: songs("T1", "T2"),
    };
    expect(buildTransitions(inputs)).toEqual([]);
  });

  it("reads a block's consecutive pairs by position, not by order in the array", () => {
    const inputs: TransitionInputs = {
      blocks: [block("B", "Block B", [["T2", 1], ["T1", 0, "swap"]])],
      songs: songs("T1", "T2"),
    };
    const edges = buildTransitions(inputs);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ source: "T1", target: "T2" });
    expect(edges[0].sources[0].notes).toEqual(["swap"]);
  });

  it("skips a pair whose from equals its to", () => {
    const inputs: TransitionInputs = {
      relationships: [relationship("r1", "A", "A", "transition")],
      blocks: [block("B", "Block B", [["A", 0], ["A", 1]])],
      sets: [set([songItem(0, "A"), songItem(1, "A")])],
      songs: songs("A"),
    };
    expect(buildTransitions(inputs)).toEqual([]);
  });

  it("orders sources relationship, block, set, then by name and id", () => {
    const inputs: TransitionInputs = {
      relationships: [relationship("r1", "T1", "T2", "transition")],
      blocks: [
        block("bz", "Zeta", [["T1", 0], ["T2", 1]]),
        block("ba", "Alpha", [["T1", 0], ["T2", 1]]),
      ],
      sets: [
        set([songItem(0, "T1"), songItem(1, "T2")], "s2", "Second"),
        set([songItem(0, "T1"), songItem(1, "T2")], "s1", "First"),
      ],
      songs: songs("T1", "T2"),
    };
    const edge = buildTransitions(inputs)[0];
    expect(edge.sources.map((source) => `${source.kind}:${source.name ?? source.id}`)).toEqual([
      "relationship:r1",
      "block:Alpha",
      "block:Zeta",
      "set:First",
      "set:Second",
    ]);
  });

  it("never reads a set's phases", () => {
    const phased = {
      ...set([], "S", "Set S"),
      phases: [
        { id: "p1", name: "Phase", position: 0, items: [songItem(0, "P1"), songItem(1, "P2")] },
      ],
    } as DJSet;
    expect(buildTransitions({ sets: [phased], songs: songs("P1", "P2") })).toEqual([]);
  });

  it("reads only relationships of type transition", () => {
    const inputs: TransitionInputs = {
      relationships: [relationship("r1", "A", "B", "remix"), relationship("r2", "C", "D", "bootleg")],
      songs: songs("A", "B", "C", "D"),
    };
    expect(buildTransitions(inputs)).toEqual([]);
  });

  it("returns nothing for an empty library", () => {
    expect(buildTransitions({})).toEqual([]);
    expect(buildTransitions({ relationships: [], blocks: [], sets: [], songs: [] })).toEqual([]);
  });

  it("sorts its edges by source then target, so the result is stable", () => {
    const inputs: TransitionInputs = {
      relationships: [
        relationship("r1", "B", "C", "transition"),
        relationship("r2", "A", "C", "transition"),
        relationship("r3", "A", "B", "transition"),
      ],
    };
    expect(buildTransitions(inputs).map((edge) => `${edge.source}→${edge.target}`)).toEqual(["A→B", "A→C", "B→C"]);
  });
});
