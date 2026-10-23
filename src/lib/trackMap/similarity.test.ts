import { describe, expect, it } from "vitest";

import { buildFeatures, parseCamelot, toFeatures } from "./features";
import { allNearest, inputSimilarity, nearest, round9, similarity, type SimilarityOptions } from "./similarity";
import { syntheticLibrary } from "./syntheticLibrary";
import { MAP_INPUTS, type MapInput, type MapInputs, type TrackFeatures } from "./types";

/** Features with the two sets empty; overrides carry the values under test. */
function feat(overrides: Partial<TrackFeatures> & { id: string }): TrackFeatures {
  return { subgenres: [], tagIds: [], ...overrides };
}

/** A feature set with the first BPM of "128", the key "Am" and the genre "Techno". */
function track(id: string, overrides: Partial<TrackFeatures> = {}): TrackFeatures {
  return feat({ id, bpm: 128, key: parseCamelot("Am"), genre: "techno", genreLabel: "Techno", ...overrides });
}

/** Inputs where only the named ones are on, each at the given weight. */
function inputs(spec: Partial<Record<MapInput, number>>): MapInputs {
  const built = {} as MapInputs;
  for (const input of MAP_INPUTS) {
    const weight = spec[input];
    built[input] = { enabled: weight !== undefined, weight: weight ?? 1 };
  }
  return built;
}

describe("inputSimilarity — BPM", () => {
  it("matches the plan's examples, to the precision the plan states", () => {
    const s = (a: number, b: number) => inputSimilarity("bpm", feat({ id: "a", bpm: a }), feat({ id: "b", bpm: b }));
    expect(s(128, 130)!.toFixed(3)).toBe("0.888");
    expect(s(87, 174)!.toFixed(3)).toBe("1.000");
    expect(s(120, 128)!.toFixed(3)).toBe("0.534");
    expect(s(128, 140)!.toFixed(3)).toBe("0.354");
  });

  it("folds half and double time together", () => {
    const s = (a: number, b: number) => inputSimilarity("bpm", feat({ id: "a", bpm: a }), feat({ id: "b", bpm: b }));
    expect(s(87, 174)).toBeCloseTo(1, 9);
    expect(s(128, 64)).toBeCloseTo(1, 9);
    expect(s(128, 256)).toBeCloseTo(1, 9);
    expect(s(174, 43.5)).toBeCloseTo(1, 9);
  });

  it("is 0 at and beyond the fold scale, never NaN", () => {
    const s = (a: number, b: number) => inputSimilarity("bpm", feat({ id: "a", bpm: a }), feat({ id: "b", bpm: b }));
    expect(s(128, 156)).toBe(0);
    expect(Number.isNaN(s(128, 156))).toBe(false);
    expect(s(87, 100)).toBeGreaterThanOrEqual(0);
  });

  it("skips the input when either track has no BPM", () => {
    expect(inputSimilarity("bpm", track("a"), feat({ id: "b" }))).toBeUndefined();
    expect(inputSimilarity("bpm", feat({ id: "a" }), track("b"))).toBeUndefined();
  });
});

describe("inputSimilarity — key", () => {
  it("matches the plan's examples", () => {
    const s = (a: string, b: string) =>
      inputSimilarity("key", feat({ id: "a", key: parseCamelot(a) }), feat({ id: "b", key: parseCamelot(b) }));
    expect(s("8A", "8A")).toBeCloseTo(1, 9);
    expect(s("8A", "9A")).toBeCloseTo(0.75, 9);
    expect(s("8A", "8B")).toBeCloseTo(0.75, 9);
    expect(s("8A", "9B")).toBeCloseTo(0.5, 9);
    expect(s("8A", "2A")).toBe(0);
    expect(s("1A", "12A")).toBeCloseTo(0.75, 9);
  });

  it("skips a track without a key", () => {
    expect(inputSimilarity("key", track("a"), feat({ id: "b" }))).toBeUndefined();
  });
});

describe("inputSimilarity — genre, subgenre and tags", () => {
  it("genre is 1 when equal, else 0", () => {
    expect(inputSimilarity("genre", track("a"), track("b"))).toBe(1);
    expect(inputSimilarity("genre", track("a"), track("b", { genre: "house" }))).toBe(0);
    expect(inputSimilarity("genre", track("a"), feat({ id: "b" }))).toBeUndefined();
  });

  it("subgenre and tags are the Jaccard of the two sets", () => {
    const a = feat({ id: "a", subgenres: ["deep", "acid"] });
    const b = feat({ id: "b", subgenres: ["deep", "hard"] });
    expect(inputSimilarity("subgenre", a, b)).toBeCloseTo(1 / 3, 9);
    const c = feat({ id: "c", tagIds: ["x"] });
    const d = feat({ id: "d", tagIds: ["x", "y"] });
    expect(inputSimilarity("tags", c, d)).toBeCloseTo(0.5, 9);
    expect(inputSimilarity("tags", c, feat({ id: "e", tagIds: ["x"] }))).toBe(1);
  });

  it("skips an empty set, which is missing", () => {
    expect(inputSimilarity("tags", track("a"), feat({ id: "b", tagIds: ["x"] }))).toBeUndefined();
    expect(inputSimilarity("subgenre", feat({ id: "a" }), feat({ id: "b" }))).toBeUndefined();
  });
});

describe("inputSimilarity — the ratings, year and duration", () => {
  it("the two ratings are 1 − |a − b| / 5", () => {
    // Values present, so the rule is exercised on its own; toFeatures makes a 0 absent.
    expect(inputSimilarity("energy", feat({ id: "a", energy: 3 }), feat({ id: "b", energy: 4 }))).toBeCloseTo(0.8, 9);
    expect(inputSimilarity("people", feat({ id: "a", people: 3 }), feat({ id: "b", people: 3 }))).toBe(1);
    expect(inputSimilarity("people", feat({ id: "a", people: 5 }), feat({ id: "b", people: 1 }))).toBeCloseTo(0.2, 9);
  });

  it("skips an unrated track", () => {
    expect(inputSimilarity("energy", track("a"), feat({ id: "b", energy: 3 }))).toBeUndefined();
  });

  it("year is 1 − |a − b| / 10, floored at 0", () => {
    expect(inputSimilarity("year", feat({ id: "a", year: 2000 }), feat({ id: "b", year: 2005 }))).toBeCloseTo(0.5, 9);
    expect(inputSimilarity("year", feat({ id: "a", year: 2000 }), feat({ id: "b", year: 2010 }))).toBe(0);
  });

  it("duration is 1 − |a − b| / 180, floored at 0", () => {
    expect(inputSimilarity("duration", feat({ id: "a", duration: 300 }), feat({ id: "b", duration: 300 }))).toBe(1);
    expect(inputSimilarity("duration", feat({ id: "a", duration: 300 }), feat({ id: "b", duration: 390 }))).toBeCloseTo(0.5, 9);
    expect(inputSimilarity("duration", feat({ id: "a", duration: 300 }), feat({ id: "b", duration: 480 }))).toBe(0);
  });
});

describe("inputSimilarity — relationships", () => {
  const connections = new Map([
    ["a", new Set(["o"])],
    ["b", new Set(["o"])],
    ["o", new Set(["a", "b"])],
  ]);

  it("is 1 between connected tracks", () => {
    expect(inputSimilarity("relationships", feat({ id: "a" }), feat({ id: "o" }), connections)).toBe(1);
    expect(inputSimilarity("relationships", feat({ id: "o" }), feat({ id: "a" }), connections)).toBe(1);
  });

  it("is half the shared-connection Jaccard, so two remixes of one original score 0.5", () => {
    expect(inputSimilarity("relationships", feat({ id: "a" }), feat({ id: "b" }), connections)).toBe(0.5);
  });

  it("skips a pair where either side has no connection at all", () => {
    expect(inputSimilarity("relationships", feat({ id: "a" }), feat({ id: "z" }), connections)).toBeUndefined();
    expect(inputSimilarity("relationships", feat({ id: "a" }), feat({ id: "b" }))).toBeUndefined();
  });
});

describe("similarity — the composite", () => {
  it("matches worked example 2", () => {
    const options: SimilarityOptions = { inputs: inputs({ bpm: 3, genre: 2, tags: 3 }) };
    const e = feat({ id: "E", bpm: 128, genre: "techno" });
    const f = feat({ id: "F", bpm: 128, genre: "techno", tagIds: ["dark"] });
    const g = feat({ id: "G", genre: "house", tagIds: ["dark"] });

    expect(similarity(e, f, options)).toBeCloseTo(1.0, 9); // BPM 1 and genre 1 over 3 + 2
    expect(similarity(e, g, options)).toBeUndefined(); // only genre compares, min overlap 2
    expect(similarity(f, g, options)).toBeCloseTo(0.6, 9); // genre 0 and tags 1 over 2 + 3
  });

  it("skips each missing value and weighs the rest", () => {
    const options: SimilarityOptions = { inputs: inputs({ bpm: 3, energy: 1 }) };
    const a = feat({ id: "a", bpm: 128, energy: 5 });
    const b = feat({ id: "b", bpm: 130, energy: 5 });
    const bpm = inputSimilarity("bpm", a, b)!;
    expect(similarity(a, b, options)).toBeCloseTo((3 * bpm + 1 * 1) / 4, 8);
  });

  it("needs the minimum overlap: min(2, |E|)", () => {
    const twoInputs: SimilarityOptions = { inputs: inputs({ bpm: 3, energy: 1 }) };
    const a = feat({ id: "a", bpm: 128 });
    const b = feat({ id: "b", bpm: 128, energy: 3 });
    expect(similarity(a, b, twoInputs)).toBeUndefined(); // one comparable input, two enabled

    const oneInput: SimilarityOptions = { inputs: inputs({ bpm: 3 }) };
    expect(similarity(a, b, oneInput)).toBeCloseTo(1, 9); // min(2, 1) = 1
  });

  it("is symmetric and rounded to 9 decimals", () => {
    const options: SimilarityOptions = { inputs: inputs({ bpm: 1, subgenre: 1, genre: 1 }) };
    const a = feat({ id: "a", bpm: 128, genre: "techno", subgenres: ["deep", "acid"] });
    const b = feat({ id: "b", bpm: 133, genre: "techno", subgenres: ["deep", "hard", "peak"] });
    const s = similarity(a, b, options)!;
    expect(similarity(b, a, options)).toBe(s);
    const bpm = inputSimilarity("bpm", a, b)!;
    const subgenre = inputSimilarity("subgenre", a, b)!;
    // The same weighted mean, rounded to the 9 decimals the plan compares at.
    expect(s).toBe(round9((bpm + 1 * 1 + 1 * subgenre) / 3));
    expect(Math.abs(s - (bpm + 1 + subgenre) / 3)).toBeLessThan(1e-8);
  });

  it("is undefined when no input is enabled", () => {
    expect(similarity(track("a"), track("b"), { inputs: inputs({}) })).toBeUndefined();
  });

  it("never divides by 0 with the lightest weight", () => {
    const options: SimilarityOptions = { inputs: inputs({ bpm: 0.5 }) };
    expect(similarity(track("a"), track("b"), options)).toBeCloseTo(1, 9);
  });
});

describe("nearest", () => {
  it("matches worked example 1: nothing crosses between the pairs", () => {
    const options: SimilarityOptions = { inputs: inputs({ bpm: 1 }), k: 1 };
    const a = feat({ id: "A", bpm: 128 });
    const b = feat({ id: "B", bpm: 130 });
    const c = feat({ id: "C", bpm: 174 });
    const d = feat({ id: "D", bpm: 87 });
    const tracks = [a, b, c, d];

    expect(similarity(a, b, options)).toBeCloseTo(0.888, 3);
    expect(similarity(c, d, options)).toBeCloseTo(1, 9);
    expect(similarity(a, c, options)).toBe(0);
    expect(similarity(a, d, options)).toBe(0);
    expect(similarity(b, c, options)).toBe(0);
    expect(similarity(b, d, options)).toBe(0);

    expect(nearest(a, tracks, options)).toEqual([{ id: "B", s: similarity(a, b, options) }]);
    expect(nearest(b, tracks, options)).toEqual([{ id: "A", s: similarity(a, b, options) }]);
    expect(nearest(c, tracks, options).map((entry) => entry.id)).toEqual(["D"]);
    expect(nearest(d, tracks, options).map((entry) => entry.id)).toEqual(["C"]);
  });

  it("matches worked example 2 with k = 1", () => {
    const options: SimilarityOptions = { inputs: inputs({ bpm: 3, genre: 2, tags: 3 }), k: 1 };
    const e = feat({ id: "E", bpm: 128, genre: "techno" });
    const f = feat({ id: "F", bpm: 128, genre: "techno", tagIds: ["dark"] });
    const g = feat({ id: "G", genre: "house", tagIds: ["dark"] });
    const tracks = [e, f, g];

    expect(nearest(e, tracks, options).map((entry) => entry.id)).toEqual(["F"]);
    expect(nearest(f, tracks, options).map((entry) => entry.id)).toEqual(["E"]);
    expect(nearest(g, tracks, options).map((entry) => entry.id)).toEqual(["F"]);
  });

  it("matches worked example 3: a tie breaks by song id", () => {
    const options: SimilarityOptions = { inputs: inputs({ bpm: 1 }), k: 1 };
    const x = feat({ id: "X", bpm: 120 });
    const y = feat({ id: "Y", bpm: 125 });
    const z = feat({ id: "Z", bpm: 115.2 });
    const tracks = [x, y, z];

    expect(inputSimilarity("bpm", x, y)!.toFixed(3)).toBe("0.706");
    expect(inputSimilarity("bpm", x, z)!.toFixed(3)).toBe("0.706");
    expect(similarity(x, y, options)).toBe(similarity(x, z, options));
    expect(nearest(x, tracks, options).map((entry) => entry.id)).toEqual(["Y"]);
    expect(nearest(x, tracks, { ...options, k: 2 }).map((entry) => entry.id)).toEqual(["Y", "Z"]);
  });

  it("matches worked example 4: fewer candidates than k", () => {
    const options: SimilarityOptions = { inputs: inputs({ bpm: 1 }), k: 8 };
    const x = feat({ id: "X", bpm: 120 });
    const y = feat({ id: "Y", bpm: 125 });
    const z = feat({ id: "Z", bpm: 115.2 });
    const tracks = [x, y, z];

    for (const track of tracks) {
      const list = nearest(track, tracks, options);
      expect(list).toHaveLength(2);
      expect(list.map((entry) => entry.id)).not.toContain(track.id);
    }
  });

  it("matches worked example 5: a 0 BPM is missing, and the pair compares on its other inputs", () => {
    const options: SimilarityOptions = { inputs: inputs({ bpm: 3, genre: 2, energy: 1 }) };
    const raw = { title: "x", artist: "y", people: 0 };
    const a = toFeatures({ ...raw, id: "A", bpm: 0, mainGenre: "Techno", energy: 4 });
    const b = toFeatures({ ...raw, id: "B", bpm: 0, mainGenre: "Techno", energy: 4 });

    expect(a.bpm).toBeUndefined(); // 0 is missing before the similarity ever sees it
    expect(inputSimilarity("bpm", a, b)).toBeUndefined();
    const s = similarity(a, b, options);
    expect(s).toBe(1);
    expect(Number.isNaN(s as number)).toBe(false);
    expect(nearest(a, [a, b], options)).toEqual([{ id: "B", s: 1 }]);
  });

  it("leaves a track with no candidate above 0 unlinked", () => {
    const options: SimilarityOptions = { inputs: inputs({ key: 1 }) };
    const lonely = feat({ id: "L", key: parseCamelot("8A") });
    const far = feat({ id: "F", key: parseCamelot("2A") });
    expect(similarity(lonely, far, options)).toBe(0);
    expect(nearest(lonely, [lonely, far], options)).toEqual([]);
  });

  it("keeps at most k, S descending and then id ascending", () => {
    // The ratings give S = 1 − |a − b| / 5 on a 1-D scale, so the order is fixed.
    const options: SimilarityOptions = { inputs: inputs({ energy: 1, people: 1 }), k: 2 };
    const a = feat({ id: "A", energy: 5, people: 5 });
    const tracks = [
      a,
      feat({ id: "B", energy: 4, people: 4 }),
      feat({ id: "C", energy: 3, people: 3 }),
      feat({ id: "D", energy: 4, people: 4 }),
    ];
    // B and D tie at 0.8, so the id breaks it; C (0.6) is third and dropped.
    expect(nearest(a, tracks, options).map((entry) => entry.id)).toEqual(["B", "D"]);
  });

  it("defaults k to 8", () => {
    const options: SimilarityOptions = { inputs: inputs({ energy: 1, people: 1 }) };
    const tracks = Array.from({ length: 12 }, (_, index) =>
      feat({ id: `t${String(index).padStart(2, "0")}`, energy: 5, people: 5 }),
    );
    expect(nearest(tracks[0], tracks, options)).toHaveLength(8);
  });
});

describe("allNearest", () => {
  it("measures each pair once and mirrors the result", () => {
    const options: SimilarityOptions = { inputs: inputs({ bpm: 1 }), k: 1 };
    const a = feat({ id: "A", bpm: 128 });
    const b = feat({ id: "B", bpm: 130 });
    const c = feat({ id: "C", bpm: 174 });
    const all = allNearest([a, b, c], options);
    expect(all.get("A")).toEqual([{ id: "B", s: similarity(a, b, options) }]);
    expect(all.get("B")!.map((entry) => entry.id)).toEqual(["A"]);
    expect(all.get("C")).toEqual([]);
  });
});

describe("nearest over 500 synthetic tracks", () => {
  it("completes in under 1 s", () => {
    const features = buildFeatures(syntheticLibrary({ count: 500, seed: 7 }));
    const options: SimilarityOptions = {
      inputs: inputs({ bpm: 3, tags: 3, genre: 2, subgenre: 2, key: 0.5, energy: 1, people: 1 }),
    };
    const started = performance.now();
    const all = allNearest(features, options);
    const elapsed = performance.now() - started;

    expect(all.size).toBe(500);
    expect(elapsed).toBeLessThan(1000);
  });
});
