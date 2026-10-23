import { describe, expect, it } from "vitest";

import type { Block, DJSet, SongRelationship } from "@/lib/storage";

import { buildModel } from "./buildModel";
import { buildConnections } from "./connections";
import { buildFeatures } from "./features";
import { buildTransitions } from "./transitions";
import { syntheticLibrary } from "./syntheticLibrary";
import { DEFAULT_INPUTS, MAP_INPUTS, type MapInput, type MapInputs, type TrackMapSong } from "./types";

/** Inputs where only the named ones are on, each at the given weight. */
function inputs(spec: Partial<Record<MapInput, number>>): MapInputs {
  const built = {} as MapInputs;
  for (const input of MAP_INPUTS) {
    const weight = spec[input];
    built[input] = { enabled: weight !== undefined, weight: weight ?? 1 };
  }
  return built;
}

function song(id: string, overrides: Partial<TrackMapSong> = {}): TrackMapSong {
  return {
    id,
    title: `Title ${id}`,
    artist: "Artist",
    energy: 0,
    people: 0,
    ...overrides,
  };
}

describe("buildModel — nodes", () => {
  it("makes one track node per shown song, in the given order", () => {
    const songs = [song("a", { title: "Alpha", artwork_url: "a.jpg" }), song("b", { mainGenre: "Techno" })];
    const features = buildFeatures(songs);
    const model = buildModel({ songs, features, inputs: inputs({ bpm: 1 }) });

    expect(model.nodes).toHaveLength(2);
    expect(model.nodes[0]).toEqual({
      id: "a",
      kind: "track",
      label: "Alpha",
      coverUrl: "a.jpg",
      genreLabel: undefined,
    });
    expect(model.nodes[1].genreLabel).toBe("Techno");
    expect(model.clusterDimension).toBeNull();
  });

  it("builds features for a song missing from the feature list", () => {
    const songs = [song("a", { bpm: 128 }), song("b", { bpm: 128 })];
    const model = buildModel({ songs, features: buildFeatures([songs[0]]), inputs: inputs({ bpm: 1 }) });
    expect(model.links).toEqual([{ source: "a", target: "b", s: 1 }]);
  });
});

describe("buildModel — links", () => {
  it("matches worked example 1: two pairs, nothing crossing", () => {
    const songs = [song("A", { bpm: 128 }), song("B", { bpm: 130 }), song("C", { bpm: 174 }), song("D", { bpm: 87 })];
    const model = buildModel({ songs, features: buildFeatures(songs), inputs: inputs({ bpm: 1 }), k: 1 });

    expect(model.links.map((link) => `${link.source}–${link.target}`)).toEqual(["A–B", "C–D"]);
    expect(model.links[0].s).toBeCloseTo(0.888, 3);
    expect(model.links[1].s).toBe(1);
  });

  it("honours k: with k = 1, C's tie picks A by id, so A links to both", () => {
    const songs = [song("A", { bpm: 128 }), song("B", { bpm: 128 }), song("C", { bpm: 128 })];
    const model = buildModel({ songs, features: buildFeatures(songs), inputs: inputs({ bpm: 1 }), k: 1 });
    expect(model.links.map((link) => `${link.source}–${link.target}`)).toEqual(["A–B", "A–C"]);
  });

  it("matches worked example 2: E–F and F–G, the union of the nearest sets", () => {
    const songs = [
      song("E", { bpm: 128, mainGenre: "Techno" }),
      song("F", { bpm: 128, mainGenre: "Techno" }),
      song("G", { mainGenre: "House" }),
    ];
    const songTags = [
      { song_id: "F", tag_id: "dark" },
      { song_id: "G", tag_id: "dark" },
    ];
    const model = buildModel({
      songs,
      features: buildFeatures(songs, songTags),
      inputs: inputs({ bpm: 3, genre: 2, tags: 3 }),
      k: 1,
    });

    expect(model.links.map((link) => `${link.source}–${link.target}`)).toEqual(["E–F", "F–G"]);
    expect(model.links[0].s).toBeCloseTo(1.0, 9);
    expect(model.links[1].s).toBeCloseTo(0.6, 9);
  });

  it("orders every link source < target", () => {
    const songs = [song("z", { bpm: 128 }), song("a", { bpm: 128 }), song("m", { bpm: 128 })];
    const model = buildModel({ songs, features: buildFeatures(songs), inputs: inputs({ bpm: 1 }) });
    for (const link of model.links) expect(link.source < link.target).toBe(true);
    expect(model.links.map((link) => `${link.source}–${link.target}`)).toEqual(["a–m", "a–z", "m–z"]);
  });

  it("counts the unlinked tracks", () => {
    const songs = [song("A", { bpm: 128 }), song("B", { bpm: 130 }), song("L", { bpm: 174 })];
    const model = buildModel({ songs, features: buildFeatures(songs), inputs: inputs({ bpm: 1 }), k: 1 });
    expect(model.unlinkedCount).toBe(1); // L's only pair (A, B) is 0
  });

  it("leaves tracks with no comparable input unlinked, and never NaNs", () => {
    const songs = [song("A"), song("B"), song("C", { bpm: 128 })];
    const model = buildModel({ songs, features: buildFeatures(songs), inputs: inputs({ bpm: 3, genre: 2 }) });
    expect(model.links).toEqual([]);
    expect(model.unlinkedCount).toBe(3);
    expect(model.nodes.every((node) => typeof node.id === "string")).toBe(true);
  });

  it("runs at the default inputs and is deterministic", () => {
    const make = () => {
      const songs = syntheticLibrary({ count: 12, seed: 3 });
      return buildModel({ songs, features: buildFeatures(songs), inputs: DEFAULT_INPUTS });
    };
    const first = make();
    const second = make();
    expect(first.nodes).toHaveLength(12);
    expect(first).toEqual(second);
  });
});

describe("buildModel — edges", () => {
  // All four carry the same BPM, so every pair links and nearest edges exist.
  const songs = [song("A", { bpm: 128 }), song("B", { bpm: 128 }), song("C", { bpm: 128 }), song("D", { bpm: 128 })];

  it("draws a nearest edge for every link, and a transition edge per direction", () => {
    const relationships: SongRelationship[] = [
      {
        id: "r1",
        source_song_id: "A",
        target_song_id: "B",
        relationship_type: "transition",
        notes: "echo out",
        created_at: "",
      },
    ];
    const transitions = buildTransitions({ relationships });
    const model = buildModel({
      songs,
      features: buildFeatures(songs),
      inputs: inputs({ bpm: 1 }),
      relationships,
      transitions,
    });

    const kinds = model.edges.map((edge) => edge.kind);
    expect(kinds.filter((kind) => kind === "nearest")).toHaveLength(model.links.length);
    expect(kinds).toContain("transition");
    const transition = model.edges.find((edge) => edge.kind === "transition")!;
    expect(transition).toMatchObject({ source: "A", target: "B" });
    expect(transition.sources![0].notes).toEqual(["echo out"]);
  });

  it("draws the seven non-transition relationship types, not the transition one", () => {
    const relationships: SongRelationship[] = [
      { id: "r1", source_song_id: "A", target_song_id: "B", relationship_type: "remix", created_at: "" },
      { id: "r2", source_song_id: "B", target_song_id: "C", relationship_type: "mashup", created_at: "" },
      { id: "r3", source_song_id: "C", target_song_id: "D", relationship_type: "transition", created_at: "" },
    ];
    const model = buildModel({ songs, features: buildFeatures(songs), inputs: inputs({ bpm: 1 }), relationships });
    const authored = model.edges.filter((edge) => edge.kind === "relationship");
    expect(authored.map((edge) => edge.relationshipType)).toEqual(["remix", "mashup"]);
  });

  it("drops an edge whose endpoints are not both shown", () => {
    const relationships: SongRelationship[] = [
      { id: "r1", source_song_id: "A", target_song_id: "gone", relationship_type: "remix", created_at: "" },
    ];
    const model = buildModel({ songs, features: buildFeatures(songs), inputs: inputs({ bpm: 1 }), relationships });
    expect(model.edges.filter((edge) => edge.kind === "relationship")).toEqual([]);
  });

  it("keeps the transitions filtered to the shown tracks", () => {
    const relationships: SongRelationship[] = [
      { id: "r1", source_song_id: "A", target_song_id: "B", relationship_type: "transition", created_at: "" },
      { id: "r2", source_song_id: "B", target_song_id: "gone", relationship_type: "transition", created_at: "" },
    ];
    const transitions = buildTransitions({ relationships });
    const model = buildModel({ songs, features: buildFeatures(songs), inputs: inputs({ bpm: 1 }), transitions });
    expect(model.edges.filter((edge) => edge.kind === "transition").map((edge) => `${edge.source}→${edge.target}`)).toEqual([
      "A→B",
    ]);
  });

  it("feeds connections so a relationship makes a pair alike", () => {
    const relationships: SongRelationship[] = [
      { id: "r1", source_song_id: "A", target_song_id: "B", relationship_type: "remix", created_at: "" },
    ];
    const connections = buildConnections(relationships);
    const model = buildModel({
      songs: [song("A"), song("B")],
      features: buildFeatures([song("A"), song("B")]),
      inputs: inputs({ relationships: 3 }),
      connections,
    });
    expect(model.links).toEqual([{ source: "A", target: "B", s: 1 }]);
  });
});

describe("buildModel — with a block and a set", () => {
  it("adds the set's and block's transitions to the map's edges", () => {
    const songs = [song("T1"), song("T2")];
    const blocks: Block[] = [
      {
        id: "B",
        name: "Block B",
        songs: [
          { song_id: "T1", position: 0, transition_notes: "filter swap" },
          { song_id: "T2", position: 1 },
        ],
        color: "#000",
        created_at: "",
        updated_at: "",
      },
    ];
    const sets: DJSet[] = [
      {
        id: "S",
        name: "Set S",
        items: [
          { id: "i0", type: "song", ref_id: "T1", position: 0 },
          { id: "i1", type: "block", ref_id: "B", position: 1 },
        ],
        phases: [],
        color: "#000",
        created_at: "",
        updated_at: "",
      } as DJSet,
    ];
    const transitions = buildTransitions({ blocks, sets, songs });
    const connections = buildConnections([], transitions);
    const model = buildModel({
      songs,
      features: buildFeatures(songs),
      inputs: inputs({ relationships: 3 }),
      connections,
      transitions,
    });

    const edge = model.edges.find((candidate) => candidate.kind === "transition")!;
    expect(edge).toMatchObject({ source: "T1", target: "T2" });
    expect(edge.sources!.map((source) => source.kind)).toEqual(["block", "set"]);
    expect(model.links).toEqual([{ source: "T1", target: "T2", s: 1 }]);
  });
});
