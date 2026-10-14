import { describe, expect, it } from "vitest";

import {
  chooseClusterDimension,
  C_MAX,
  C_MIN,
  DEFAULT_NODE_THRESHOLD,
  FALLBACK_DIMENSIONS,
  groupCount,
  groupKey,
  shouldCluster,
  type ClusterTrack,
} from "./clusters";

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
