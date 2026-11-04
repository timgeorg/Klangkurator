import { describe, expect, it } from "vitest";

import type { SongRelationship } from "@/lib/storage";
import { buildTransitions } from "@/lib/trackMap/transitions";
import type { TransitionEdge } from "@/lib/trackMap/transitions";

import { buildTransitionRows, filterRows, searchRows, sideIsLibrary, type RowSong } from "./transitionRows";

const song = (id: string, title: string, artist = "Artist"): RowSong => ({ id, title, artist });

const saved = (
  id: string,
  source: { id: string } | { artist: string; title: string },
  target: { id: string } | { artist: string; title: string },
  extra: Partial<SongRelationship> = {},
): SongRelationship => ({
  id,
  source_song_id: "id" in source ? source.id : null,
  source_track: "id" in source ? null : source,
  target_song_id: "id" in target ? target.id : null,
  target_track: "id" in target ? null : target,
  relationship_type: "transition",
  created_at: "2026-11-04T00:00:00Z",
  ...extra,
});

const edge = (from: string, to: string, sources: TransitionEdge["sources"] = []): TransitionEdge => ({
  source: from,
  target: to,
  kind: "transition",
  sources,
});

const library = [song("a", "Alpha"), song("b", "Beta"), song("c", "Gamma")];

describe("buildTransitionRows", () => {
  it("makes one row per saved transition, showing both library tracks", () => {
    const rows = buildTransitionRows({
      edges: [],
      relationships: [saved("r1", { id: "a" }, { id: "b" }, { notes: "works" })],
      songs: library,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].from).toMatchObject({ id: "a", title: "Alpha", typed: false });
    expect(rows[0].to).toMatchObject({ id: "b", title: "Beta", typed: false });
    expect(rows[0].relationshipId).toBe("r1");
    expect(rows[0].notes).toBe("works");
  });

  it("lists a saved transition whose side is a typed track", () => {
    const rows = buildTransitionRows({
      edges: [],
      relationships: [saved("r1", { artist: "Tate McRae", title: "Housewife" }, { artist: "", title: "Best of Both Worlds" })],
      songs: library,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].from).toMatchObject({ artist: "Tate McRae", title: "Housewife", typed: true });
    expect(rows[0].from.id).toBeUndefined();
    expect(rows[0].to).toMatchObject({ artist: "", title: "Best of Both Worlds", typed: true });
  });

  it("takes the idea mark from the saved transition of a row that a block also makes", () => {
    const rows = buildTransitionRows({
      edges: [edge("a", "b", [{ kind: "block", id: "k1", name: "Block K", notes: ["from A"] }])],
      relationships: [saved("r1", { id: "a" }, { id: "b" }, { idea: true })],
      songs: library,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].idea).toBe(true);
    expect(rows[0].relationshipId).toBe("r1");
    // Both the saved transition and the block name themselves (REQ-19-TL VC9).
    expect(rows[0].sources.map((source) => source.kind)).toEqual(["relationship", "block"]);
    expect(rows[0].sources[1]).toMatchObject({ id: "k1", name: "Block K", notes: ["from A"] });
  });

  it("keeps a row that only blocks and sets make without an id to edit", () => {
    const rows = buildTransitionRows({
      edges: [edge("a", "c", [{ kind: "set", id: "s1", name: "Set S", notes: [] }])],
      relationships: [],
      songs: library,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].relationshipId).toBeNull();
    expect(rows[0].idea).toBe(false);
  });

  it("keeps each direction as its own row", () => {
    const rows = buildTransitionRows({
      edges: [edge("a", "b"), edge("b", "a")],
      relationships: [],
      songs: library,
    });

    expect(rows.map((row) => `${row.from.title}→${row.to.title}`)).toEqual(["Alpha→Beta", "Beta→Alpha"]);
  });

  it("makes no row for a saved transition from a track to itself", () => {
    const rows = buildTransitionRows({
      edges: [],
      relationships: [saved("r1", { id: "a" }, { id: "a" })],
      songs: library,
    });

    expect(rows).toEqual([]);
  });

  it("skips a row whose library track is gone", () => {
    const rows = buildTransitionRows({
      edges: [edge("a", "gone")],
      relationships: [saved("r1", { id: "gone" }, { id: "b" })],
      songs: library,
    });

    expect(rows).toEqual([]);
  });

  it("sorts by the first title, then the second, ignoring case", () => {
    const rows = buildTransitionRows({
      edges: [],
      relationships: [
        saved("r1", { artist: "", title: "beta" }, { artist: "", title: "alpha" }),
        saved("r2", { artist: "", title: "Alpha" }, { artist: "", title: "gamma" }),
        saved("r3", { artist: "", title: "Alpha" }, { artist: "", title: "Beta" }),
      ],
      songs: library,
    });

    expect(rows.map((row) => `${row.from.title}/${row.to.title}`)).toEqual([
      "Alpha/Beta",
      "Alpha/gamma",
      "beta/alpha",
    ]);
  });

  it("merges two saved transitions of the same typed pair, case ignored", () => {
    const rows = buildTransitionRows({
      edges: [],
      relationships: [
        saved("r1", { artist: "Tate McRae", title: "Housewife" }, { artist: "", title: "Best" }),
        saved("r2", { artist: "tate mcrae", title: "HOUSEWIFE" }, { artist: "", title: "best" }),
      ],
      songs: library,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].relationshipId).toBe("r2");
  });

  it("counts a typed pair and the same library pair as different rows", () => {
    const rows = buildTransitionRows({
      edges: [edge("a", "b")],
      relationships: [saved("r1", { artist: "Artist", title: "Alpha" }, { artist: "Artist", title: "Beta" })],
      songs: library,
    });

    expect(rows).toHaveLength(2);
  });

  it("never lists a relationship of another type", () => {
    const rows = buildTransitionRows({
      edges: [],
      relationships: [
        { id: "x", source_song_id: "a", target_song_id: "b", relationship_type: "remix", created_at: "" },
      ],
      songs: library,
    });

    expect(rows).toEqual([]);
  });
});

describe("searchRows", () => {
  const rows = buildTransitionRows({
    edges: [],
    relationships: [
      saved("r1", { id: "a" }, { id: "b" }),
      saved("r2", { artist: "Tate McRae", title: "Housewife" }, { artist: "", title: "Best of Both Worlds" }),
    ],
    songs: library,
  });

  it("keeps every row for an empty query", () => {
    expect(searchRows(rows, "   ")).toHaveLength(2);
  });

  it("matches the title of either side, ignoring case", () => {
    expect(searchRows(rows, "BETA").map((row) => row.key)).toHaveLength(1);
    expect(searchRows(rows, "housewife")).toHaveLength(1);
  });

  it("matches the artist of either side", () => {
    expect(searchRows(rows, "tate")).toHaveLength(1);
  });

  it("keeps nothing when no side matches", () => {
    expect(searchRows(rows, "zzz")).toEqual([]);
  });
});

describe("filterRows", () => {
  const rows = buildTransitionRows({
    edges: [],
    relationships: [saved("r1", { id: "a" }, { id: "b" }, { idea: true }), saved("r2", { id: "b" }, { id: "c" })],
    songs: library,
  });

  it("keeps every row for all", () => {
    expect(filterRows(rows, "all")).toHaveLength(2);
  });

  it("keeps only the ideas", () => {
    expect(filterRows(rows, "ideas").map((row) => row.relationshipId)).toEqual(["r1"]);
  });

  it("keeps only the rows that are not ideas", () => {
    expect(filterRows(rows, "transitions").map((row) => row.relationshipId)).toEqual(["r2"]);
  });
});

describe("sideIsLibrary", () => {
  it("is true only for a side that is a library track", () => {
    expect(sideIsLibrary({ id: "a", artist: "", title: "Alpha", typed: false })).toBe(true);
    expect(sideIsLibrary({ artist: "", title: "Alpha", typed: true })).toBe(false);
  });
});

describe("buildTransitionRows with buildTransitions", () => {
  it("reads the block and set pairs the track map already finds", () => {
    const edges = buildTransitions({
      blocks: [
        {
          id: "k1",
          name: "Block K",
          color: "#000",
          songs: [
            { song_id: "a", position: 0, transition_notes: "blend the outro" },
            { song_id: "b", position: 1 },
          ],
          created_at: "",
          updated_at: "",
        },
      ],
      sets: [],
      songs: library,
    });

    const rows = buildTransitionRows({ edges, relationships: [], songs: library });

    expect(rows).toHaveLength(1);
    expect(rows[0].sources).toEqual([
      { kind: "block", id: "k1", name: "Block K", notes: ["blend the outro"] },
    ]);
  });
});
