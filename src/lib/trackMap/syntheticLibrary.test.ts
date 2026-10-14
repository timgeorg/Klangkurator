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
