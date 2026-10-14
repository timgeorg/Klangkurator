import { describe, expect, it } from "vitest";

import { DEFAULT_INPUTS, MAP_INPUTS, type MapInput } from "./types";

// The plan fixes the 11 inputs of MapInput; DEFAULT_INPUTS must carry one
// setting per input so phases 1b and 2 can assume a total record.
describe("DEFAULT_INPUTS", () => {
  it("carries a setting for every MapInput", () => {
    const keys = Object.keys(DEFAULT_INPUTS) as MapInput[];
    expect([...keys].sort()).toEqual([...MAP_INPUTS].sort());
    expect(keys).toHaveLength(11);
  });

  it("matches the spec's default table", () => {
    expect(DEFAULT_INPUTS.bpm).toEqual({ enabled: true, weight: 3 });
    expect(DEFAULT_INPUTS.tags).toEqual({ enabled: true, weight: 3 });
    expect(DEFAULT_INPUTS.relationships).toEqual({ enabled: true, weight: 3 });
    expect(DEFAULT_INPUTS.genre).toEqual({ enabled: true, weight: 2 });
    expect(DEFAULT_INPUTS.subgenre).toEqual({ enabled: true, weight: 2 });
    expect(DEFAULT_INPUTS.energy).toEqual({ enabled: true, weight: 1 });
    expect(DEFAULT_INPUTS.danceability).toEqual({ enabled: true, weight: 1 });
    expect(DEFAULT_INPUTS.social_acceptance).toEqual({ enabled: true, weight: 1 });
    expect(DEFAULT_INPUTS.key).toEqual({ enabled: true, weight: 0.5 });
    expect(DEFAULT_INPUTS.year).toEqual({ enabled: false, weight: 1 });
    expect(DEFAULT_INPUTS.duration).toEqual({ enabled: false, weight: 1 });
  });
});