import { describe, expect, it } from "vitest";

import {
  DENSE_FLOOR_MIN,
  GAP_DIMENSIONS,
  MIN_MEASURED,
  bucket,
  TEMPO_GRID,
  denseFloor,
  dimensionReport,
  gridFit,
  reportLibraryGaps,
  thinRuns,
} from "./libraryGaps";
import type { TrackMapSong } from "./trackMap/types";

/** A stored song carrying only what the gap report reads. */
function song(bpm?: number, energy = 0, year?: number, duration?: number): TrackMapSong {
  return { id: `s${Math.random()}`, title: "T", artist: "A", bpm, energy, year, duration };
}

/** `count` songs at each value, so a bin list reads like a histogram. */
function at(values: readonly [number, number][]): TrackMapSong[] {
  return values.flatMap(([value, count]) => Array.from({ length: count }, () => song(value)));
}

const bpmSpec = GAP_DIMENSIONS.find((spec) => spec.dimension === "bpm")!;

describe("denseFloor", () => {
  it("never falls below the minimum", () => {
    expect(denseFloor(0)).toBe(DENSE_FLOOR_MIN);
    expect(denseFloor(100)).toBe(DENSE_FLOOR_MIN);
  });

  it("takes 2 % of the measured count once that is larger", () => {
    expect(denseFloor(1906)).toBe(39);
    expect(denseFloor(2500)).toBe(50);
  });
});

describe("bucket", () => {
  it("puts the maximum inside the last bin rather than past it", () => {
    const { from, counts } = bucket([120, 140], 2);
    expect(from).toBe(120);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(2);
    expect(counts[counts.length - 1]).toBe(1);
  });

  it("starts the domain at the minimum's bin floor", () => {
    const { from, counts } = bucket([128.7, 129.1, 131.4], 2);
    expect(from).toBe(128);
    expect(counts).toEqual([2, 1]);
  });

  it("returns no bins for no values", () => {
    expect(bucket([], 2)).toEqual({ from: 0, counts: [] });
  });
});

describe("gridFit", () => {
  it("counts a lattice point as on the grid", () => {
    const constant = TEMPO_GRID.numerator / TEMPO_GRID.denominator;
    expect(gridFit([constant / 20, constant / 19]).onGrid).toBe(2);
  });

  it("does not count a value between two lattice points", () => {
    const constant = TEMPO_GRID.numerator / TEMPO_GRID.denominator;
    // 128 sits 1.20 BPM from its nearest grid point, far past the tolerance.
    expect(gridFit([128]).onGrid).toBe(0);
    expect(gridFit([128]).distinct).toBe(1);
  });

  it("counts a distinct value once, however many tracks carry it", () => {
    expect(gridFit([129.2, 129.2, 129.2]).distinct).toBe(1);
  });
});

describe("thinRuns", () => {
  it("reports the run between two dense sides", () => {
    const runs = thinRuns([100, 0, 0, 0, 100], 5);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ first: 1, end: 4, count: 0, leftFlank: 100, rightFlank: 100 });
  });

  it("never reports a run that reaches the first bin", () => {
    expect(thinRuns([0, 0, 100], 5)).toEqual([]);
  });

  it("never reports a run that reaches the last bin", () => {
    expect(thinRuns([100, 0, 0], 5)).toEqual([]);
  });

  it("reports nothing when every bin is dense", () => {
    expect(thinRuns([5, 5, 5, 5], 5)).toEqual([]);
  });

  it("measures the ratio against the smaller flank, not the larger", () => {
    // Both flanks are dense at floor 39. The cap is 10 % of the smaller one,
    // 40 -> 4.0, so 8 is over it. The larger flank alone would allow 41.7.
    expect(thinRuns([417, 8, 40], 39)).toEqual([]);
    expect(thinRuns([417, 8, 548], 39)).toHaveLength(1);
  });

  it("counts a bin that sits exactly on the floor as dense", () => {
    const atFloor = thinRuns([39, 0, 39], 39);
    expect(atFloor).toHaveLength(1);
    expect(atFloor[0]).toMatchObject({ leftFlank: 39, rightFlank: 39 });
  });

  it("keeps a run whose count is exactly the cap", () => {
    expect(thinRuns([100, 10, 100], 50)).toHaveLength(1);
    expect(thinRuns([100, 11, 100], 50)).toEqual([]);
  });

  it("sums the whole run before comparing", () => {
    // Two thin bins of 5 each: the run totals 10, which is exactly the cap.
    expect(thinRuns([100, 5, 5, 100], 50)).toHaveLength(1);
    // Three thin bins of 5: 15 is over 10.
    expect(thinRuns([100, 5, 5, 5, 100], 50)).toEqual([]);
  });
});

describe("dimensionReport", () => {
  it("reports not enough data below the guard", () => {
    const report = dimensionReport(at([[128, MIN_MEASURED - 1]]), bpmSpec);
    expect(report.insufficient).toBe(true);
    expect(report.regions).toEqual([]);
    expect(report.measured).toBe(MIN_MEASURED - 1);
  });

  it("judges at exactly the guard", () => {
    const report = dimensionReport(at([[128, MIN_MEASURED]]), bpmSpec);
    expect(report.insufficient).toBe(false);
    expect(report.regions).toEqual([]);
  });

  it("reproduces the sandbox library's BPM regions exactly", () => {
    // Every distinct BPM value in the sandbox library with its count, so this
    // fixture is the real histogram: 1,906 measured tracks of 1,907.
    const library: [number, number][] = [
      [60.1, 2], [61.5, 4], [63, 15], [64.6, 6], [66.3, 6], [68, 3], [69.8, 17],
      [71.8, 6], [73.8, 16], [76, 1], [78.3, 8], [80.7, 2], [83.4, 38],
      [86.1, 24], [89.1, 32], [92.3, 38], [95.7, 33], [99.4, 36], [103.4, 26],
      [107.7, 13], [112.3, 17], [117.5, 73], [123, 417], [125, 2], [126, 5],
      [127, 1], [128, 5], [129.2, 543], [132, 2], [136, 142], [143.6, 197],
      [150, 1], [152, 114], [161.5, 37], [172.3, 18], [184.6, 5], [198.8, 1],
    ];
    const report = dimensionReport(at(library), bpmSpec);
    expect(report.insufficient).toBe(false);
    expect(report.measured).toBe(1906);
    // max(5, ceil(0.02 x 1906)) = 39, the floor the plan records.
    expect(report.floor).toBe(39);
    // 31 of the 37 distinct values sit on the analyser's grid.
    expect(report.grid).toMatchObject({ onGrid: 31, distinct: 37 });
    expect(report.regions.map((region) => [region.from, region.to, region.count, region.leftFlank, region.rightFlank])).toEqual([
      [118, 122, 0, 73, 417],
      [124, 128, 8, 417, 548],
      // Tim's 130-134 gap, widened to the 2-BPM bins the report draws.
      [130, 136, 2, 548, 142],
      [138, 142, 0, 142, 197],
      [144, 152, 1, 197, 114],
    ]);
  });

  it("leaves unmeasured values out of the dimension", () => {
    // 60 rated tracks at 3, and 60 that are 0 because 0 means unrated.
    const songs = [
      ...Array.from({ length: 60 }, () => song(undefined, 3)),
      ...Array.from({ length: 60 }, () => song(undefined, 0)),
    ];
    const energySpec = GAP_DIMENSIONS.find((spec) => spec.dimension === "energy")!;
    const report = dimensionReport(songs, energySpec);
    expect(report.measured).toBe(60);
    expect(report.bins[0].from).toBe(3);
  });

  it("marks the bins a region covers", () => {
    const report = dimensionReport(at([[100, 60], [130, 60]]), bpmSpec);
    const marked = report.bins.filter((bin) => bin.inRegion).map((bin) => bin.from);
    expect(marked).toEqual(report.bins.filter((bin) => !bin.dense).map((bin) => bin.from));
    expect(marked.length).toBeGreaterThan(0);
  });
});

describe("reportLibraryGaps", () => {
  it("reports the four dimensions in their fixed order", () => {
    const reports = reportLibraryGaps([]);
    expect(reports.map((report) => report.dimension)).toEqual(["bpm", "energy", "year", "playtime"]);
    expect(reports.every((report) => report.insufficient)).toBe(true);
  });
});
