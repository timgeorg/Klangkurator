import { describe, expect, it } from "vitest";

import { buildFeatures } from "./features";
import { allNearest, type SimilarityOptions } from "./similarity";
import { syntheticLibrary } from "./syntheticLibrary";
import { MAP_INPUTS, type MapInput, type MapInputs } from "./types";

/** Inputs where only the named ones are on, each at the given weight. */
function inputs(spec: Partial<Record<MapInput, number>>): MapInputs {
  const built = {} as MapInputs;
  for (const input of MAP_INPUTS) {
    const weight = spec[input];
    built[input] = { enabled: weight !== undefined, weight: weight ?? 1 };
  }
  return built;
}

describe("syntheticLibrary", () => {
  it("generates the count asked for, with unique ids", () => {
    const songs = syntheticLibrary({ count: 25, seed: 1 });
    expect(songs).toHaveLength(25);
    expect(new Set(songs.map((song) => song.id)).size).toBe(25);
    expect(syntheticLibrary({ count: 0 })).toEqual([]);
    expect(syntheticLibrary({ count: 3 })).toHaveLength(3);
  });

  it("is deterministic: the same seed gives the same tracks", () => {
    expect(syntheticLibrary({ count: 40, seed: 9 })).toEqual(syntheticLibrary({ count: 40, seed: 9 }));
  });

  it("gives a different library for a different seed", () => {
    const a = syntheticLibrary({ count: 40, seed: 1 });
    const b = syntheticLibrary({ count: 40, seed: 2 });
    expect(a).not.toEqual(b);
  });

  it("prefixes the ids, so two libraries never collide", () => {
    const songs = syntheticLibrary({ count: 3, seed: 1, idPrefix: "big" });
    expect(songs.every((song) => song.id.startsWith("big-"))).toBe(true);
  });

  it("carries the fields the features read, and they survive normalisation", () => {
    const songs = syntheticLibrary({ count: 200, seed: 5 });
    const features = buildFeatures(songs);
    expect(features).toHaveLength(200);
    // Every track carries a BPM, a parseable key, a genre and a crate.
    expect(features.every((feature) => feature.bpm !== undefined)).toBe(true);
    expect(features.every((feature) => feature.key !== undefined)).toBe(true);
    expect(features.every((feature) => feature.genre !== undefined)).toBe(true);
    expect(songs.every((song) => !!song.root_folder)).toBe(true);
  });

  it("produces ratings on the 0–5 scale with one decimal", () => {
    const songs = syntheticLibrary({ count: 100, seed: 4 });
    for (const song of songs) {
      for (const value of [song.energy, song.danceability, song.social_acceptance]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(5);
        expect(Math.abs(Math.round(value * 10) - value * 10)).toBeLessThan(1e-9);
      }
    }
  });

  it("writes keys in more than one notation, so the parser meets them all", () => {
    const keys = syntheticLibrary({ count: 300, seed: 6 }).map((song) => song.musical_key ?? "");
    expect(keys.some((key) => /^[A-G][#b]?m$/.test(key) || /^[A-G][#b]?$/.test(key))).toBe(true);
    expect(keys.some((key) => /minor|major/.test(key))).toBe(true);
    expect(keys.some((key) => /^\d{1,2}[AB]$/.test(key))).toBe(true);
  });

  it("runs 500 tracks through the similarity fast enough for the perf test", () => {
    const features = buildFeatures(syntheticLibrary({ count: 500 }));
    const options: SimilarityOptions = { inputs: inputs({ bpm: 3, genre: 2, subgenre: 2, key: 0.5 }) };
    const started = performance.now();
    const all = allNearest(features, options);
    expect(all.size).toBe(500);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe("syntheticLibrary — the fixture shapes (phase 6)", () => {
  it("clamps the genre, subgenre and crate pools, so a fixture gets the count it asks for", () => {
    const nine = syntheticLibrary({ count: 600, seed: 11, genreCount: 9 });
    expect(new Set(nine.map((song) => song.mainGenre)).size).toBe(9);

    const eight = syntheticLibrary({ count: 600, seed: 12, subgenreCount: 8 });
    expect(new Set(eight.flatMap((song) => song.subgenres ?? [])).size).toBe(8);

    const twelve = syntheticLibrary({ count: 600, seed: 13, crateCount: 12 });
    expect(new Set(twelve.map((song) => song.root_folder)).size).toBe(12);

    // More than the pool is clamped to the pool, never past it.
    const clamped = syntheticLibrary({ count: 600, seed: 14, genreCount: 999 });
    expect(new Set(clamped.map((song) => song.mainGenre)).size).toBe(12);
  });

  it("leaves some tracks without a subgenre, so a fixture has one to place in its genre cluster", () => {
    const songs = syntheticLibrary({ count: 600, seed: 15, subgenreCount: 8 });
    const bare = songs.filter((song) => (song.subgenres ?? []).length === 0);
    expect(bare.length).toBeGreaterThan(0);
    expect(bare.every((song) => song.mainGenre !== undefined)).toBe(true);
  });

  it("spans the BPM range it is given, with a bin for every round ten", () => {
    const songs = syntheticLibrary({ count: 2000, seed: 15, bpmMin: 90, bpmMax: 180 });
    const bpms = songs.map((song) => song.bpm ?? 0);
    expect(Math.min(...bpms)).toBeGreaterThanOrEqual(90);
    expect(Math.max(...bpms)).toBeLessThanOrEqual(180);
    const bins = new Set(bpms.map((bpm) => Math.floor(bpm / 10)));
    expect(bins.size).toBe(10); // 90s through 170s
  });

  it("spreads the energy meter across unrated to 5 when asked", () => {
    const spread = syntheticLibrary({ count: 1200, seed: 16, energySpread: true });
    const values = new Set(spread.map((song) => song.energy));
    expect(values.has(0)).toBe(true);
    expect(values.has(5)).toBe(true);
    expect(Math.max(...[...values] as number[])).toBe(5);
  });

  it("leaves the asked-for fields out, so a fallback fixture has nothing to cluster by", () => {
    const bare = syntheticLibrary({
      count: 300,
      seed: 17,
      omit: { genre: true, bpm: true, subgenre: true, energy: true, ratings: true, crate: true },
    });
    expect(bare.every((song) => !song.mainGenre)).toBe(true);
    expect(bare.every((song) => song.bpm === undefined)).toBe(true);
    expect(bare.every((song) => (song.subgenres ?? []).length === 0)).toBe(true);
    expect(bare.every((song) => song.energy === 0)).toBe(true);
    expect(bare.every((song) => song.danceability === 0 && song.social_acceptance === 0)).toBe(true);
    expect(bare.every((song) => song.root_folder === undefined)).toBe(true);
  });

  it("spreads the artists by crate, across the alphabet, or not at all", () => {
    const byCrate = syntheticLibrary({ count: 300, seed: 18 });
    expect(new Set(byCrate.map((song) => song.artist)).size).toBe(6);

    const alphabet = syntheticLibrary({ count: 300, seed: 19, artistSpread: "alphabet" });
    expect(new Set(alphabet.map((song) => (song.artist ?? "")[0])).size).toBe(26);

    const single = syntheticLibrary({ count: 300, seed: 20, artistSpread: "single" });
    expect(new Set(single.map((song) => song.artist)).size).toBe(1);
  });

  it("stays deterministic with the fixture flags", () => {
    const a = syntheticLibrary({ count: 60, seed: 7, genreCount: 9, bpmMin: 90, bpmMax: 180, energySpread: true });
    const b = syntheticLibrary({ count: 60, seed: 7, genreCount: 9, bpmMin: 90, bpmMax: 180, energySpread: true });
    expect(a).toEqual(b);
  });
});
