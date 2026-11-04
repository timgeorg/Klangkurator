// Library gap report (issue #9) — the pure half: bucket one dimension, then
// find the runs that are thin between two dense sides. The numbers are the
// plan's algorithm contract (docs/plans/LIBRARY_GAPS_PLAN.md), and the shapes
// follow docs/requirements/35_LIBRARY_GAPS.md REQ-9-GR. No React and no
// storage, so a test can fix the answers on synthetic data.
import { toFeatures } from "@/lib/trackMap/features";
import type { TrackMapSong } from "@/lib/trackMap/types";

/** Below this many measured tracks a dimension cannot be judged. */
export const MIN_MEASURED = 50;

/** A bin is dense from this share of the dimension's measured tracks… */
export const DENSE_FLOOR_SHARE = 0.02;

/** …but never below this many tracks in a bin. */
export const DENSE_FLOOR_MIN = 5;

/** A run is thin at this share of its smaller dense flank, or below. */
export const THIN_RATIO = 0.1;

/**
 * The tempo grid the analyser can produce: `beat_track` at `hop_length=512` and
 * `sr=22050` reads one period off the onset envelope, so every tempo it stores
 * is `60 × 22050 / 512 ÷ k` to within a rounding step. The constant is
 * `backend/scanner/audio_analysis.py`'s, and the note in the BPM section
 * quotes it.
 */
export const TEMPO_GRID = { numerator: 60 * 22050, denominator: 512 } as const;

/** How near a stored tempo must sit to a grid point to count as on the grid. */
export const TEMPO_GRID_TOLERANCE = 0.05;

export type GapDimension = "bpm" | "energy" | "year" | "playtime";

type GapField = "bpm" | "energy" | "year" | "duration";

export interface GapDimensionSpec {
  dimension: GapDimension;
  /** The feature field the dimension reads. */
  field: GapField;
  width: number;
  label: string;
  /** The width as a reader says it: "2 BPM", "120 s". */
  widthLabel: string;
  /** How an edge of a bin reads, for the axis and the region rows. */
  format: (value: number) => string;
}

export interface GapBin {
  /** Inclusive low edge. */
  from: number;
  /** Exclusive high edge. */
  to: number;
  count: number;
  dense: boolean;
  /** True when the bin lies inside a reported region. */
  inRegion: boolean;
}

export interface GapRegion {
  /** Inclusive low edge of the run's first bin. */
  from: number;
  /** Exclusive high edge of the run's last bin. */
  to: number;
  /** Tracks inside the run, summed over its bins. */
  count: number;
  /** The dense bin on the left, by its count. */
  leftFlank: number;
  /** The dense bin on the right, by its count. */
  rightFlank: number;
}

/** How far a dimension's values follow a quantisation grid. */
export interface GridFit {
  /** Distinct values that land on `TEMPO_GRID` within its tolerance. */
  onGrid: number;
  /** Distinct values in the dimension. */
  distinct: number;
  /** The grid constant `60 × sr / hop`, for the note. */
  constant: number;
}

export interface DimensionReport {
  dimension: GapDimension;
  label: string;
  width: number;
  widthLabel: string;
  format: (value: number) => string;
  /** Tracks in this dimension that carry a usable value. */
  measured: number;
  /** The dense floor this section was judged with. */
  floor: number;
  /** Every bin of the data-driven domain, in ascending order. */
  bins: GapBin[];
  regions: GapRegion[];
  /** True when there are too few measured tracks to judge the dimension. */
  insufficient: boolean;
  /** Present only for BPM: how far the stored tempos follow the analyser grid. */
  grid?: GridFit;
}

/** One run of non-dense bins, by index, before the edges are known. */
interface RunIndices {
  first: number;
  /** Exclusive. */
  end: number;
  count: number;
  leftFlank: number;
  rightFlank: number;
}

const bpmFormat = (value: number): string => `${Math.round(value * 10) / 10}`;
const energyFormat = (value: number): string => `${Math.round(value * 10) / 10}`;
const yearFormat = (value: number): string => `${Math.round(value)}`;
const playtimeFormat = (value: number): string => {
  const total = Math.round(value);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

/** The four dimensions, in the order the page shows them. */
export const GAP_DIMENSIONS: readonly GapDimensionSpec[] = [
  { dimension: "bpm", field: "bpm", width: 2, label: "BPM", widthLabel: "2 BPM", format: bpmFormat },
  { dimension: "energy", field: "energy", width: 0.5, label: "Energy", widthLabel: "0.5 rating", format: energyFormat },
  { dimension: "year", field: "year", width: 1, label: "Year", widthLabel: "1 year", format: yearFormat },
  { dimension: "playtime", field: "duration", width: 120, label: "Playtime", widthLabel: "2 minutes", format: playtimeFormat },
];

/**
 * The dense floor of one dimension.
 *
 * @param measured - How many tracks carry a usable value in this dimension.
 * @returns The larger of `DENSE_FLOOR_MIN` and `DENSE_FLOOR_SHARE` of the count.
 */
export function denseFloor(measured: number): number {
  return Math.max(DENSE_FLOOR_MIN, Math.ceil(DENSE_FLOOR_SHARE * measured));
}

/**
 * Count values into fixed-width bins over a domain that follows the data.
 *
 * The low edge is the minimum's bin floor. The high edge is the maximum's bin
 * floor plus one width, so the maximum falls inside the last bin rather than
 * past it. A value at or beyond an edge is clamped into the end bin, so a
 * rounding error can never drop a track.
 *
 * @param values - The measured values, all finite and greater than 0.
 * @param width - The bin width, greater than 0.
 * @returns The low edge and the counts, in ascending order.
 */
export function bucket(values: readonly number[], width: number): { from: number; counts: number[] } {
  if (values.length === 0) return { from: 0, counts: [] };
  let min = values[0];
  let max = values[0];
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const from = Math.floor(min / width) * width;
  const to = Math.floor(max / width) * width + width;
  const size = Math.max(1, Math.round((to - from) / width));
  const counts = new Array<number>(size).fill(0);
  for (const value of values) {
    const index = Math.min(Math.max(Math.floor((value - from) / width), 0), size - 1);
    counts[index] += 1;
  }
  return { from, counts };
}

/**
 * How far a set of values sits on the analyser's tempo grid.
 *
 * This is a measurement, not a correction: nothing is snapped or rounded, and
 * the bins keep the stored values. The count lets the report say that a hole
 * between two grid points is partly a resolution effect rather than a gap in
 * the collection.
 *
 * @param values - The distinct measured tempos.
 */
export function gridFit(values: readonly number[]): GridFit {
  const constant = TEMPO_GRID.numerator / TEMPO_GRID.denominator;
  const distinct = new Set(values);
  let onGrid = 0;
  for (const value of distinct) {
    const k = Math.round(constant / value);
    if (k > 0 && Math.abs(constant / k - value) <= TEMPO_GRID_TOLERANCE) onGrid += 1;
  }
  return { onGrid, distinct: distinct.size, constant };
}

/**
 * The runs of non-dense bins that count as thin regions, by bin index.
 *
 * A bin is dense from `floor` up. A run is a region only when a dense bin
 * bounds it on each side, so a run that reaches either end of the list never
 * is: at the edge of the data there is no second side to be thin between.
 *
 * @param counts - The bin counts, in ascending domain order.
 * @param floor - The dense floor for this bin list.
 */
export function thinRuns(counts: readonly number[], floor: number): RunIndices[] {
  const dense = counts.map((count) => count >= floor);
  const runs: RunIndices[] = [];
  let i = 0;
  while (i < counts.length) {
    if (dense[i]) {
      i += 1;
      continue;
    }
    let last = i;
    while (last + 1 < counts.length && !dense[last + 1]) last += 1;
    // The run is maximal among non-dense bins, so its neighbours are dense by
    // construction. The only way it is not between two sides is that it has no
    // neighbour on one of them.
    const bounded = i > 0 && last + 1 < counts.length;
    if (bounded) {
      let count = 0;
      for (let k = i; k <= last; k += 1) count += counts[k];
      if (count <= THIN_RATIO * Math.min(counts[i - 1], counts[last + 1])) {
        runs.push({ first: i, end: last + 1, count, leftFlank: counts[i - 1], rightFlank: counts[last + 1] });
      }
    }
    i = last + 1;
  }
  return runs;
}

/**
 * The report for one dimension.
 *
 * A value is measured when `toFeatures` kept it, which is the rule the track
 * map applies: absent, zero and non-finite are missing. A missing value never
 * becomes a bin of its own, so an unrated energy of 0 cannot invent a gap at
 * the bottom of the axis.
 *
 * @param songs - The library's songs.
 * @param spec - The dimension to report.
 */
export function dimensionReport(songs: readonly TrackMapSong[], spec: GapDimensionSpec): DimensionReport {
  const values: number[] = [];
  for (const song of songs) {
    const value = toFeatures(song)[spec.field];
    if (typeof value === "number") values.push(value);
  }
  const measured = values.length;
  const floor = denseFloor(measured);
  const grid = spec.dimension === "bpm" ? gridFit(values) : undefined;
  if (measured < MIN_MEASURED) {
    return {
      dimension: spec.dimension,
      label: spec.label,
      width: spec.width,
      widthLabel: spec.widthLabel,
      format: spec.format,
      measured,
      floor,
      bins: [],
      regions: [],
      insufficient: true,
      grid,
    };
  }
  const { from, counts } = bucket(values, spec.width);
  const runs = thinRuns(counts, floor);
  const inRegion = new Array<boolean>(counts.length).fill(false);
  const regions: GapRegion[] = runs.map((run) => {
    for (let k = run.first; k < run.end; k += 1) inRegion[k] = true;
    return {
      from: from + run.first * spec.width,
      to: from + run.end * spec.width,
      count: run.count,
      leftFlank: run.leftFlank,
      rightFlank: run.rightFlank,
    };
  });
  const bins: GapBin[] = counts.map((count, index) => ({
    from: from + index * spec.width,
    to: from + (index + 1) * spec.width,
    count,
    dense: count >= floor,
    inRegion: inRegion[index],
  }));
  return {
    dimension: spec.dimension,
    label: spec.label,
    width: spec.width,
    widthLabel: spec.widthLabel,
    format: spec.format,
    measured,
    floor,
    bins,
    regions,
    insufficient: false,
    grid,
  };
}

/**
 * Every dimension's report, in the page's fixed order.
 *
 * @param songs - The library's songs.
 */
export function reportLibraryGaps(songs: readonly TrackMapSong[]): DimensionReport[] {
  return GAP_DIMENSIONS.map((spec) => dimensionReport(songs, spec));
}
