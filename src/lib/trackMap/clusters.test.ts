import { describe, expect, it } from "vitest";

import { buildModel } from "./buildModel";
import {
  buildClusters,
  chooseClusterDimension,
  clusterChoice,
  clusterFeatures,
  clusterGroups,
  CLUSTER_DIMENSION_LABELS,
  CLUSTER_LINK_K,
  C_MAX,
  C_MIN,
  DEFAULT_NODE_THRESHOLD,
  FALLBACK_DIMENSIONS,
  filterByClusterFilters,
  groupCount,
  groupKey,
  shouldCluster,
  withClusterFields,
  type ClusterTrack,
} from "./clusters";
import { buildFeatures } from "./features";
import { syntheticLibrary, type SyntheticLibraryOptions } from "./syntheticLibrary";
import { DEFAULT_INPUTS } from "./types";

/** A cluster track with the sets empty; overrides carry the values under test. */
function t(overrides: Partial<ClusterTrack> & { id: string }): ClusterTrack {
  return { subgenres: [], tagIds: [], ...overrides };
}

/** N tracks, one per index, shaped by the callback. */
function many(count: number, shape: (index: number) => Partial<ClusterTrack>): ClusterTrack[] {
  return Array.from({ length: count }, (_, index) => t({ id: `t${String(index).padStart(4, "0")}`, ...shape(index) }));
}

describe("groupKey — genre", () => {
  it("is the lowercased genre, or No genre", () => {
    expect(groupKey(t({ id: "a", genre: "techno" }), "genre")).toBe("techno");
    expect(groupKey(t({ id: "a" }), "genre")).toBe("No genre");
  });
});

describe("groupKey — bpmRange", () => {
  it("is the 10 BPM bin [lo, lo + 10), labelled with an en dash", () => {
    expect(groupKey(t({ id: "a", bpm: 120 }), "bpmRange")).toBe("120–130");
    expect(groupKey(t({ id: "a", bpm: 129.9 }), "bpmRange")).toBe("120–130");
    expect(groupKey(t({ id: "a", bpm: 130 }), "bpmRange")).toBe("130–140");
    expect(groupKey(t({ id: "a", bpm: 119.9 }), "bpmRange")).toBe("110–120");
    expect(groupKey(t({ id: "a", bpm: 87 }), "bpmRange")).toBe("80–90");
  });

  it("is No BPM when the BPM is missing", () => {
    expect(groupKey(t({ id: "a" }), "bpmRange")).toBe("No BPM");
    expect(groupKey(t({ id: "a", bpm: 0 }), "bpmRange")).toBe("No BPM");
  });
});

describe("groupKey — subgenre", () => {
  it("is the first-listed subgenre, else the genre, else No genre", () => {
    expect(groupKey(t({ id: "a", subgenres: ["deep", "acid"] }), "subgenre")).toBe("deep");
    expect(groupKey(t({ id: "a", genre: "techno" }), "subgenre")).toBe("techno");
    expect(groupKey(t({ id: "a" }), "subgenre")).toBe("No genre");
  });
});

describe("groupKey — energy", () => {
  it("is Unrated for 0, Below 1 under 1, else the meter's whole bar 1–5", () => {
    expect(groupKey(t({ id: "a", energy: 0 }), "energy")).toBe("Unrated");
    expect(groupKey(t({ id: "a" }), "energy")).toBe("Unrated");
    expect(groupKey(t({ id: "a", energy: 0.5 }), "energy")).toBe("Below 1");
    expect(groupKey(t({ id: "a", energy: 1 }), "energy")).toBe("1");
    expect(groupKey(t({ id: "a", energy: 2.9 }), "energy")).toBe("2");
    expect(groupKey(t({ id: "a", energy: 5 }), "energy")).toBe("5");
    expect(groupKey(t({ id: "a", energy: 5.9 }), "energy")).toBe("5");
  });
});

describe("groupKey — the fallbacks", () => {
  it("crate is the root folder, or No crate", () => {
    expect(groupKey(t({ id: "a", root_folder: "Crate A" }), "crate")).toBe("Crate A");
    expect(groupKey(t({ id: "a", root_folder: "  " }), "crate")).toBe("No crate");
    expect(groupKey(t({ id: "a" }), "crate")).toBe("No crate");
  });

  it("artistInitial is the first letter, uppercased A–Z, else #", () => {
    expect(groupKey(t({ id: "a", artist: "aphex" }), "artistInitial")).toBe("A");
    expect(groupKey(t({ id: "a", artist: "  Nina" }), "artistInitial")).toBe("N");
    expect(groupKey(t({ id: "a", artist: "808 State" }), "artistInitial")).toBe("#");
    expect(groupKey(t({ id: "a", artist: "Über" }), "artistInitial")).toBe("#");
    expect(groupKey(t({ id: "a", artist: "" }), "artistInitial")).toBe("#");
    expect(groupKey(t({ id: "a" }), "artistInitial")).toBe("#");
  });
});

describe("groupCount", () => {
  it("counts the distinct group values", () => {
    const tracks = [
      t({ id: "a", genre: "techno" }),
      t({ id: "b", genre: "techno" }),
      t({ id: "c", genre: "house" }),
    ];
    expect(groupCount(tracks, "genre")).toBe(2);
    expect(groupCount([], "genre")).toBe(0);
  });
});

describe("shouldCluster — the node threshold", () => {
  it("matches N = 500 (tracks) and N = 501 (clusters)", () => {
    expect(DEFAULT_NODE_THRESHOLD).toBe(500);
    expect(shouldCluster(500)).toBe(false);
    expect(shouldCluster(501)).toBe(true);
    expect(shouldCluster(0)).toBe(false);
  });
});

describe("chooseClusterDimension — the band", () => {
  it("uses the plan's starting edges", () => {
    expect(C_MIN).toBe(4);
    expect(C_MAX).toBe(60);
  });

  it("matches N = 1,200 with 9 genres: genre", () => {
    const tracks = many(1200, (index) => ({ genre: `g${index % 9}`, bpm: 90 + (index % 10) * 10 }));
    expect(groupCount(tracks, "genre")).toBe(9);
    expect(chooseClusterDimension(tracks)).toBe("genre");
  });

  it("matches 2 genres and BPMs from 90 to 180: genre fails, BPM range wins", () => {
    const tracks = many(10, (index) => ({ genre: `g${index % 2}`, bpm: 90 + index * 10 }));
    expect(groupCount(tracks, "genre")).toBe(2);
    expect(groupCount(tracks, "bpmRange")).toBe(10);
    expect(chooseClusterDimension(tracks)).toBe("bpmRange");
  });

  it("matches the band edges: c = 3 fails, 4 passes, 60 passes, 61 fails", () => {
    // BPM range always holds four bins here, so it is what the band catches
    // when genre falls outside it.
    const bpms = [95, 115, 135, 155];

    const three = bpms.map((bpm, index) => t({ id: `a${index}`, bpm, genre: `g${index % 3}` }));
    expect(groupCount(three, "genre")).toBe(3);
    expect(groupCount(three, "bpmRange")).toBe(4);
    expect(chooseClusterDimension(three)).toBe("bpmRange");

    const four = bpms.map((bpm, index) => t({ id: `b${index}`, bpm, genre: `g${index}` }));
    expect(groupCount(four, "genre")).toBe(4);
    expect(chooseClusterDimension(four)).toBe("genre");

    const sixty = many(60, (index) => ({ genre: `g${index}`, bpm: bpms[index % 4] }));
    expect(groupCount(sixty, "genre")).toBe(60);
    expect(chooseClusterDimension(sixty)).toBe("genre");

    const sixtyOne = many(61, (index) => ({ genre: `g${index}`, bpm: bpms[index % 4] }));
    expect(groupCount(sixtyOne, "genre")).toBe(61);
    expect(groupCount(sixtyOne, "bpmRange")).toBe(4);
    expect(chooseClusterDimension(sixtyOne)).toBe("bpmRange");
  });
});

describe("chooseClusterDimension — the nearest band", () => {
  it("matches the plan's example: subgenre, the nearest of the four", () => {
    const tracks = many(75, (index) => ({
      genre: `g${index % 2}`, // c = 2, |ln(2 / 4)| = 0.693
      bpm: 95 + (index % 3) * 10, // c = 3, |ln(3 / 4)| = 0.288
      subgenres: [`s${index}`], // c = 75, |ln(75 / 60)| = 0.223
      energy: 3, // c = 1, never taken
    }));
    expect(groupCount(tracks, "genre")).toBe(2);
    expect(groupCount(tracks, "bpmRange")).toBe(3);
    expect(groupCount(tracks, "subgenre")).toBe(75);
    expect(groupCount(tracks, "energy")).toBe(1);
    expect(chooseClusterDimension(tracks)).toBe("subgenre");
  });

  it("ties by order", () => {
    // genre c = 3 and BPM range c = 3 have the same distance; genre comes first.
    const tracks = many(3, (index) => ({ genre: `g${index}`, bpm: [95, 105, 115][index] }));
    expect(groupCount(tracks, "genre")).toBe(3);
    expect(groupCount(tracks, "bpmRange")).toBe(3);
    expect(chooseClusterDimension(tracks)).toBe("genre");
  });
});

describe("chooseClusterDimension — the fallbacks", () => {
  it("clusters 1,200 tracks without metadata by crate", () => {
    const tracks = many(1200, (index) => ({ root_folder: `Crate ${index % 12}`, artist: "Same Artist" }));
    expect(groupCount(tracks, "genre")).toBe(1);
    expect(groupCount(tracks, "bpmRange")).toBe(1);
    expect(groupCount(tracks, "subgenre")).toBe(1);
    expect(groupCount(tracks, "energy")).toBe(1);
    expect(groupCount(tracks, "crate")).toBe(12);
    expect(chooseClusterDimension(tracks)).toBe("crate");
  });

  it("falls to the artist's first letter when one crate holds them all", () => {
    const tracks = many(1200, (index) => ({
      root_folder: "One Crate",
      artist: index % 2 ? "Alice" : "Bob",
    }));
    expect(groupCount(tracks, "crate")).toBe(1);
    expect(groupCount(tracks, "artistInitial")).toBe(2);
    expect(chooseClusterDimension(tracks)).toBe("artistInitial");
  });

  it("gives null (the last resort) when one crate and one artist hold them all", () => {
    const tracks = many(1200, () => ({ root_folder: "One Crate", artist: "One Artist" }));
    expect(groupCount(tracks, "crate")).toBe(1);
    expect(groupCount(tracks, "artistInitial")).toBe(1);
    expect(chooseClusterDimension(tracks)).toBeNull();
  });

  it("keeps the fallback order crate, then artist initial", () => {
    expect(FALLBACK_DIMENSIONS).toEqual(["crate", "artistInitial"]);
    const tracks = many(4, (index) => ({
      root_folder: `Crate ${index}`,
      artist: index % 2 ? "Alice" : "Bob",
    }));
    expect(groupCount(tracks, "crate")).toBe(4);
    expect(groupCount(tracks, "artistInitial")).toBe(2);
    expect(chooseClusterDimension(tracks)).toBe("crate");
  });

  it("never takes a dimension with a single group, not even by the nearest band", () => {
    const tracks = many(4, (index) => ({ genre: "techno", artist: index % 2 ? "Alice" : "Bob" }));
    // All four dimensions hold one group each; the artist splits them.
    expect(groupCount(tracks, "genre")).toBe(1);
    expect(chooseClusterDimension(tracks, { min: 1, max: 1 })).not.toBe("genre");
    expect(chooseClusterDimension(tracks)).toBe("artistInitial");
  });
});

describe("clusterChoice — the reason, for the rail (TM-C1)", () => {
  it("says band when a dimension is inside it, nearest when none is", () => {
    const inside = many(1200, (index) => ({ genre: `g${index % 9}` }));
    expect(clusterChoice(inside)).toEqual({ dimension: "genre", count: 9, reason: "band" });

    const near = many(75, (index) => ({
      genre: `g${index % 2}`, // 2, above the band's floor
      bpm: 95 + (index % 3) * 10, // 3, nearer the floor
      subgenres: [`s${index}`], // 75, nearest the ceiling
      energy: 3,
    }));
    expect(clusterChoice(near)).toEqual({ dimension: "subgenre", count: 75, reason: "nearest" });
  });

  it("says fallback for the crate and the artist, and lastResort for nothing", () => {
    const crate = many(1200, (index) => ({ root_folder: `Crate ${index % 12}`, artist: "Same Artist" }));
    expect(clusterChoice(crate)).toEqual({ dimension: "crate", count: 12, reason: "fallback" });

    const artist = many(1200, (index) => ({ root_folder: "One Crate", artist: index % 2 ? "Alice" : "Bob" }));
    expect(clusterChoice(artist)).toEqual({ dimension: "artistInitial", count: 2, reason: "fallback" });

    const stuck = many(1200, () => ({ root_folder: "One Crate", artist: "One Artist" }));
    expect(clusterChoice(stuck)).toEqual({ dimension: null, count: 0, reason: "lastResort" });
  });
});

describe("withClusterFields — a song in its cluster view", () => {
  it("carries the artist and the crate alongside the features", () => {
    const [song] = syntheticLibrary({ count: 1, seed: 1 });
    const [feature] = buildFeatures([song]);
    const track = withClusterFields(song, feature);
    expect(track.artist).toBe(song.artist);
    expect(track.root_folder).toBe(song.root_folder);
    expect(track.bpm).toBe(feature.bpm);
  });
});

describe("clusterFeatures — the cluster's own values (plan › Clusters)", () => {
  it("takes the median BPM, the most common genre and key, and the mean ratings", () => {
    const members: ClusterTrack[] = [
      t({ id: "a", bpm: 120, genre: "techno", genreLabel: "Techno", key: { n: 8, mode: "A" }, energy: 1, people: 2 }),
      t({ id: "b", bpm: 130, genre: "techno", genreLabel: "Techno", key: { n: 8, mode: "A" }, energy: 3, people: 4 }),
      // Unrated values are already undefined in features, so a member carries none.
      t({ id: "c", bpm: 140, genre: "house", genreLabel: "House", key: { n: 9, mode: "A" }, energy: 5 }),
    ];
    const feature = clusterFeatures("cluster:genre:techno", members);

    expect(feature.bpm).toBe(130);
    expect(feature.genre).toBe("techno");
    expect(feature.genreLabel).toBe("Techno");
    expect(feature.key).toEqual({ n: 8, mode: "A" });
    expect(feature.energy).toBe(3); // (1 + 3 + 5) / 3
    expect(feature.people).toBe(3); // (2 + 4) / 2, the unrated member skipped
    expect(feature.memberIds).toEqual(["a", "b", "c"]);
  });

  it("keeps only the subgenres and tags at least 25 % of the members carry", () => {
    const members: ClusterTrack[] = [
      t({ id: "a", subgenres: ["deep"], tagIds: ["dark"] }),
      t({ id: "b", subgenres: ["deep", "acid"], tagIds: ["dark"] }),
      t({ id: "c", subgenres: ["acid"], tagIds: ["warm"] }),
      t({ id: "d", subgenres: [], tagIds: [] }),
    ];
    const feature = clusterFeatures("c", members);
    // 25 % of four is one, so every value carried once qualifies; each is unique in the union.
    expect(feature.subgenres).toEqual(["acid", "deep"]);
    expect(feature.tagIds).toEqual(["dark", "warm"]);
  });

  it("drops a value fewer than a quarter of the members carry, and leaves missing values missing", () => {
    const members: ClusterTrack[] = [
      t({ id: "a", subgenres: ["peak"], tagIds: ["rare"] }),
      t({ id: "b" }),
      t({ id: "c" }),
      t({ id: "d" }),
      t({ id: "e" }),
    ];
    const feature = clusterFeatures("c", members);
    // One of five is below the quarter (1.25), so the subgenre and tag drop.
    expect(feature.subgenres).toEqual([]);
    expect(feature.tagIds).toEqual([]);
    // No member carries a BPM or a rating, so those are missing, never NaN.
    expect(feature.bpm).toBeUndefined();
    expect(feature.energy).toBeUndefined();
  });
});

describe("buildClusters — the nodes and links", () => {
  // The same BPM everywhere, so every cluster pair has at least one input to
  // compare on and links always exist.
  const tracks = many(60, (index) => ({
    genre: `g${index % 6}`,
    bpm: 128,
    subgenres: [`s${index % 3}`],
  }));

  it("makes one node per group value, in value order, with labels and counts", () => {
    const build = buildClusters({ tracks, dimension: "genre", inputs: DEFAULT_INPUTS });
    expect(build.nodes.map((node) => node.id)).toEqual([
      "cluster:genre:g0",
      "cluster:genre:g1",
      "cluster:genre:g2",
      "cluster:genre:g3",
      "cluster:genre:g4",
      "cluster:genre:g5",
    ]);
    expect(build.nodes.every((node) => node.kind === "cluster")).toBe(true);
    expect(build.nodes.map((node) => node.count)).toEqual([10, 10, 10, 10, 10, 10]);
    expect(build.nodes[0].clusterDimension).toBe("genre");
    expect(build.nodes[0].clusterValue).toBe("g0");
  });

  it("keeps min(8, c − 1) links per cluster and never links a cluster to itself", () => {
    const build = buildClusters({ tracks, dimension: "genre", inputs: DEFAULT_INPUTS });
    expect(build.links.length).toBeGreaterThan(0);
    const degree = new Map<string, number>();
    for (const link of build.links) {
      expect(link.source).not.toBe(link.target);
      expect(link.source < link.target).toBe(true);
      expect(link.s).toBeGreaterThan(0);
      degree.set(link.source, (degree.get(link.source) ?? 0) + 1);
      degree.set(link.target, (degree.get(link.target) ?? 0) + 1);
    }
    // Six clusters allow at most five links each, below the cap.
    expect(CLUSTER_LINK_K).toBe(8);
    for (const node of build.nodes) expect(degree.get(node.id) ?? 0).toBeLessThanOrEqual(5);
    // One link per pair, the union of the nearest sets.
    expect(new Set(build.links.map((link) => `${link.source}\u0000${link.target}`)).size).toBe(build.links.length);
  });

  it("reduces the k to c − 1 when there are fewer clusters than the cap", () => {
    const two = many(1200, (index) => ({ genre: `g${index % 2}`, bpm: 128 }));
    const build = buildClusters({ tracks: two, dimension: "genre", inputs: DEFAULT_INPUTS });
    expect(build.nodes).toHaveLength(2);
    // Two clusters, k = min(8, 1) = 1: exactly one link, each with one neighbour.
    expect(build.links).toHaveLength(1);
    const [link] = build.links;
    expect(link.s).toBeGreaterThan(0);
    expect(build.unlinkedCount).toBe(0);
  });

  it("labels a genre cluster in its display case and a subgenre in its own", () => {
    const labelled: ClusterTrack[] = [
      t({ id: "a", genre: "melodic techno", genreLabel: "Melodic Techno" }),
      t({ id: "b", genre: "melodic techno", genreLabel: "Melodic Techno" }),
    ];
    const byGenre = buildClusters({ tracks: labelled, dimension: "genre", inputs: DEFAULT_INPUTS });
    expect(byGenre.nodes[0].label).toBe("Melodic Techno");
    // A genre cluster draws in its genre's colour, so it carries the label.
    expect(byGenre.nodes[0].genreLabel).toBe("Melodic Techno");
    const bySubgenre = buildClusters({ tracks: labelled, dimension: "subgenre", inputs: DEFAULT_INPUTS });
    expect(bySubgenre.nodes[0].label).toBe("melodic techno");
    // The other dimensions name no genre, so their nodes stay neutral.
    expect(bySubgenre.nodes[0].genreLabel).toBeUndefined();
  });
});

describe("clusters from the seeded generator — the contract's fixtures (TM-C1–TM-C10)", () => {
  /** A generated library in its cluster view, with its features built. */
  function fixture(options: SyntheticLibraryOptions): ClusterTrack[] {
    const songs = syntheticLibrary(options);
    const features = buildFeatures(songs);
    const byId = new Map(features.map((feature) => [feature.id, feature]));
    return songs.map((song) => withClusterFields(song, byId.get(song.id)!));
  }

  it("TM-C1: 1,200 tracks in 9 genres → genre", () => {
    const tracks = fixture({ count: 1200, seed: 21, genreCount: 9 });
    expect(groupCount(tracks, "genre")).toBe(9);
    expect(clusterChoice(tracks).dimension).toBe("genre");
  });

  it("TM-C2: 2 genres with BPMs from 90 to 180 → BPM range, labelled 120–130", () => {
    const tracks = fixture({ count: 1200, seed: 22, genreCount: 2, bpmMin: 90, bpmMax: 180 });
    expect(groupCount(tracks, "genre")).toBe(2);
    expect(groupCount(tracks, "bpmRange")).toBe(10);
    expect(clusterChoice(tracks).dimension).toBe("bpmRange");
    const build = buildClusters({ tracks, dimension: "bpmRange", inputs: DEFAULT_INPUTS });
    expect(build.nodes.map((node) => node.clusterValue)).toContain("120–130");
  });

  it("TM-C4: 2 genres, all between 120 and 129 BPM, 8 subgenres → subgenre; a track without one sits in its genre", () => {
    const tracks = fixture({ count: 1200, seed: 23, genreCount: 2, subgenreCount: 8, bpmMin: 120, bpmMax: 129 });
    expect(groupCount(tracks, "bpmRange")).toBe(1);
    expect(groupCount(tracks, "genre")).toBe(2);
    // Eight subgenres plus the two genre keys of the tracks that lack one.
    expect(groupCount(tracks, "subgenre")).toBe(10);
    expect(clusterChoice(tracks).dimension).toBe("subgenre");
    const bare = tracks.find((track) => track.subgenres.length === 0)!;
    expect(groupKey(bare, "subgenre")).toBe(bare.genre);
  });

  it("TM-C6: 1 genre, one BPM bin, no subgenres, energy spread → energy", () => {
    const tracks = fixture({
      count: 1200,
      seed: 24,
      genreCount: 1,
      subgenreCount: 0,
      bpmMin: 120,
      bpmMax: 129,
      energySpread: true,
    });
    expect(groupCount(tracks, "genre")).toBe(1);
    expect(groupCount(tracks, "bpmRange")).toBe(1);
    expect(groupCount(tracks, "subgenre")).toBe(1);
    // Unrated, Below 1 and the bars 1–5.
    expect(groupCount(tracks, "energy")).toBe(7);
    expect(clusterChoice(tracks).dimension).toBe("energy");
  });

  it("TM-C7: no genre, BPM, subgenre or energy, 12 crates → crate", () => {
    const tracks = fixture({
      count: 1200,
      seed: 25,
      crateCount: 12,
      omit: { genre: true, bpm: true, subgenre: true, energy: true },
    });
    expect(groupCount(tracks, "genre")).toBe(1);
    expect(groupCount(tracks, "bpmRange")).toBe(1);
    expect(groupCount(tracks, "subgenre")).toBe(1);
    expect(groupCount(tracks, "energy")).toBe(1);
    expect(groupCount(tracks, "crate")).toBe(12);
    expect(clusterChoice(tracks)).toEqual({ dimension: "crate", count: 12, reason: "fallback" });
  });

  it("TM-C9: the same in one crate, artists across the alphabet → artist initial, A showing only A's", () => {
    const songs = syntheticLibrary({
      count: 1200,
      seed: 26,
      crateCount: 1,
      artistSpread: "alphabet",
      omit: { genre: true, bpm: true, subgenre: true, energy: true },
    });
    const features = buildFeatures(songs);
    const featuresById = new Map(features.map((feature) => [feature.id, feature]));
    const tracks = songs.map((song) => withClusterFields(song, featuresById.get(song.id)!));

    expect(groupCount(tracks, "crate")).toBe(1);
    expect(groupCount(tracks, "artistInitial")).toBe(26);
    expect(clusterChoice(tracks).dimension).toBe("artistInitial");

    // Choosing "A" keeps exactly the tracks whose artist starts with A (TM-C9).
    const members = filterByClusterFilters(songs, features, [{ dimension: "artistInitial", value: "A" }]);
    expect(members.length).toBeGreaterThan(0);
    expect(members.every((song) => (song.artist ?? "").startsWith("A"))).toBe(true);
    expect(members.length).toBe(tracks.filter((track) => groupKey(track, "artistInitial") === "A").length);
  });

  it("TM-C10: one crate, one artist → the last resort", () => {
    const tracks = fixture({
      count: 1200,
      seed: 27,
      crateCount: 1,
      artistSpread: "single",
      omit: { genre: true, bpm: true, subgenre: true, energy: true },
    });
    expect(groupCount(tracks, "crate")).toBe(1);
    expect(groupCount(tracks, "artistInitial")).toBe(1);
    expect(clusterChoice(tracks)).toEqual({ dimension: null, count: 0, reason: "lastResort" });
  });

  it("never names tags as a dimension (TM-C5)", () => {
    const dimensions = Object.keys(CLUSTER_DIMENSION_LABELS);
    expect(dimensions).not.toContain("tags");
    expect(dimensions.sort()).toEqual(["artistInitial", "bpmRange", "crate", "energy", "genre", "subgenre"]);
  });
});

describe("buildModel — cluster mode (TM-C1–TM-C10)", () => {
  it("clusters 1,200 tracks in 9 genres into 9 genre nodes", () => {
    const songs = syntheticLibrary({ count: 1200, seed: 31, genreCount: 9 });
    const model = buildModel({ songs, features: buildFeatures(songs), inputs: DEFAULT_INPUTS, threshold: 500 });
    expect(model.clusterDimension).toBe("genre");
    expect(model.clusterReason).toBe("band");
    expect(model.nodes).toHaveLength(9);
    expect(model.nodes.every((node) => node.kind === "cluster")).toBe(true);
    expect(model.lastResort).toBe(false);
    // Every shown track is in exactly one cluster (TM-C1).
    expect(model.nodes.reduce((total, node) => total + (node.count ?? 0), 0)).toBe(1200);
  });

  it("keeps track mode below the threshold", () => {
    const songs = syntheticLibrary({ count: 500, seed: 32, genreCount: 9 });
    const model = buildModel({ songs, features: buildFeatures(songs), inputs: DEFAULT_INPUTS });
    expect(model.nodes).toHaveLength(500);
    expect(model.nodes.every((node) => node.kind === "track")).toBe(true);
    expect(model.clusterDimension).toBeNull();
  });

  it("clusters 501 tracks, the first count above the threshold", () => {
    const songs = syntheticLibrary({ count: 501, seed: 33, genreCount: 9 });
    const model = buildModel({ songs, features: buildFeatures(songs), inputs: DEFAULT_INPUTS });
    expect(model.clusterDimension).toBe("genre");
    expect(model.nodes.every((node) => node.kind === "cluster")).toBe(true);
  });

  it("re-runs the choice over the members: a cluster still above the threshold clusters again (TM-C3)", () => {
    const songs = syntheticLibrary({ count: 1200, seed: 34, genreCount: 2, subgenreCount: 8, bpmMin: 120, bpmMax: 129 });
    const features = buildFeatures(songs);
    const first = buildModel({ songs, features, inputs: DEFAULT_INPUTS });
    expect(first.clusterDimension).toBe("subgenre");

    // Choosing a cluster keeps exactly its members (here the Techno genre,
    // through the same filter mechanism a chosen cluster uses). Still above the
    // threshold, so the remaining tracks cluster again (TM-C3).
    const members = filterByClusterFilters(songs, features, [{ dimension: "genre", value: "techno" }]);
    expect(members.length).toBeGreaterThan(500);
    expect(members.length).toBeLessThan(songs.length);
    const again = buildModel({ songs: members, features, inputs: DEFAULT_INPUTS });
    expect(again.clusterDimension).toBe("subgenre");
    expect(again.nodes.every((node) => node.kind === "cluster")).toBe(true);
  });

  it("reveals the tracks when a chosen cluster is below the threshold (TM-C3)", () => {
    const songs = syntheticLibrary({ count: 1200, seed: 37, genreCount: 2, subgenreCount: 8, bpmMin: 120, bpmMax: 129 });
    const features = buildFeatures(songs);
    const members = filterByClusterFilters(songs, features, [{ dimension: "subgenre", value: "peak time" }]);
    expect(members.length).toBeGreaterThan(0);
    expect(members.length).toBeLessThanOrEqual(500);

    const model = buildModel({ songs: members, features, inputs: DEFAULT_INPUTS });
    expect(model.clusterDimension).toBeNull();
    expect(model.nodes).toHaveLength(members.length);
    expect(model.nodes.every((node) => node.kind === "track")).toBe(true);
  });

  it("the last resort shows the first T by title, as tracks", () => {
    const songs = syntheticLibrary({
      count: 1200,
      seed: 35,
      crateCount: 1,
      artistSpread: "single",
      omit: { genre: true, bpm: true, subgenre: true, energy: true },
    });
    const model = buildModel({ songs, features: buildFeatures(songs), inputs: DEFAULT_INPUTS });
    expect(model.lastResort).toBe(true);
    expect(model.clusterReason).toBe("lastResort");
    expect(model.clusterDimension).toBeNull();
    expect(model.nodes).toHaveLength(500);
    expect(model.nodes.every((node) => node.kind === "track")).toBe(true);
    // The first T by title: no omitted track sorts before the last shown one.
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
    const shown = new Set(model.nodes.map((node) => node.id));
    const omitted = songs.filter((song) => !shown.has(song.id));
    expect(omitted).toHaveLength(700);
    const lastShown = model.nodes
      .map((node) => node.label)
      .reduce((a, b) => (collator.compare(a, b) >= 0 ? a : b));
    expect(omitted.every((song) => collator.compare(lastShown, song.title) <= 0)).toBe(true);
  });

  it("clusterGroups reads the rail's list back off the nodes", () => {
    const songs = syntheticLibrary({ count: 1200, seed: 36, genreCount: 9 });
    const model = buildModel({ songs, features: buildFeatures(songs), inputs: DEFAULT_INPUTS });
    const groups = clusterGroups(model.nodes);
    expect(groups).toHaveLength(9);
    expect(groups.reduce((total, group) => total + group.count, 0)).toBe(1200);
  });
});
