// Track map (issue #8) — grouping tracks for clusters (plan phase 1b): the
// group key of each cluster dimension and the dimension choice. Node building
// and cluster features are phase 6; this module carries the rules the choice
// rule is tested against, with the starting thresholds the plan proposes.
import type { ClusterDimension, TrackFeatures } from "./types";

/** The plan's starting node threshold: above it the map clusters. */
export const DEFAULT_NODE_THRESHOLD = 500;
/** The plan's starting band for a dimension's group count. */
export const C_MIN = 4;
export const C_MAX = 60;

/** Tim's four cluster dimensions, in their priority order. */
export const CLUSTER_DIMENSIONS: readonly ClusterDimension[] = ["genre", "bpmRange", "subgenre", "energy"];
/** The two fallbacks, in their order (Tim's answer 3). */
export const FALLBACK_DIMENSIONS: readonly ClusterDimension[] = ["crate", "artistInitial"];

/**
 * The fields `groupKey` needs beyond the similarity features: the crate and
 * the artist come from the stored song, not from `TrackFeatures`.
 */
export interface ClusterTrack extends TrackFeatures {
  artist?: string;
  /** The track's crate, the storage field `root_folder`. */
  root_folder?: string;
}

/** A track's group value for one dimension, the string a `ClusterFilter` matches. */
export function groupKey(track: ClusterTrack, dimension: ClusterDimension): string {
  switch (dimension) {
    case "genre":
      return track.genre || "No genre";
    case "bpmRange":
      return bpmRangeKey(track.bpm);
    case "subgenre":
      return track.subgenres[0] || track.genre || "No genre";
    case "energy":
      return energyKey(track.energy);
    case "crate":
      return track.root_folder?.trim() || "No crate";
    case "artistInitial":
      return artistInitialKey(track.artist);
    default:
      return "No genre";
  }
}

/** The 10 BPM bin `[lo, lo + 10)`, labelled "120–130"; missing BPM is "No BPM". */
function bpmRangeKey(bpm?: number): string {
  // Features normalise ≤ 0 to missing; the guard keeps a raw track honest too.
  if (bpm === undefined || !Number.isFinite(bpm) || bpm <= 0) return "No BPM";
  const lo = Math.floor(bpm / 10) * 10;
  return `${lo}–${lo + 10}`;
}

/** "Unrated" for 0 (missing), "Below 1" under 1, else the meter's whole bar 1–5. */
function energyKey(energy?: number): string {
  if (energy === undefined || energy <= 0) return "Unrated";
  if (energy < 1) return "Below 1";
  // The meter is 0–5 with one decimal, so the floor is 1–5 for every rated value.
  return String(Math.floor(energy));
}

/** The artist's first letter, A–Z; a digit, a symbol or no artist is "#". */
function artistInitialKey(artist?: string): string {
  const first = (artist ?? "").trim().charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : "#";
}

/** How many groups a dimension would make over the given tracks. */
export function groupCount(tracks: readonly ClusterTrack[], dimension: ClusterDimension): number {
  const values = new Set<string>();
  for (const track of tracks) values.add(groupKey(track, dimension));
  return values.size;
}

export interface ClusterChoiceOptions {
  /** The band edges; the plan's starting values are `C_MIN` and `C_MAX`. */
  min?: number;
  max?: number;
}

/**
 * The dimension to cluster by, or null for the last resort (the first tracks
 * by title, with a notice).
 *
 * Genre, BPM range, subgenre and energy are tried in that order; the first
 * with a group count inside `[min, max]` wins. A dimension with 1 group or
 * none is never taken. When none fits the band, the one nearest it wins, by
 * `|ln(c / min)|` below or `|ln(c / max)|` above, ties by order. When none of
 * the four has 2 groups or more, crate is tried, then the artist's first
 * letter, each needing 2 groups or more.
 *
 * @param tracks - The shown tracks.
 * @param options - The band edges, defaulting to the plan's start values.
 */
export function chooseClusterDimension(
  tracks: readonly ClusterTrack[],
  options: ClusterChoiceOptions = {},
): ClusterDimension | null {
  const min = options.min ?? C_MIN;
  const max = options.max ?? C_MAX;

  const counts = CLUSTER_DIMENSIONS.map((dimension) => ({ dimension, c: groupCount(tracks, dimension) }));

  // A dimension with a single group (or none) is never taken, whatever the band says.
  const inside = counts.find((entry) => entry.c >= 2 && entry.c >= min && entry.c <= max);
  if (inside) return inside.dimension;

  const splittable = counts.filter((entry) => entry.c >= 2);
  if (splittable.length) {
    const distance = (c: number): number => (c < min ? Math.abs(Math.log(c / min)) : Math.abs(Math.log(c / max)));
    let best = splittable[0];
    for (const entry of splittable.slice(1)) {
      if (distance(entry.c) < distance(best.c)) best = entry;
    }
    return best.dimension;
  }

  for (const dimension of FALLBACK_DIMENSIONS) {
    if (groupCount(tracks, dimension) >= 2) return dimension;
  }
  return null;
}

/** Whether the map clusters at this many tracks (the plan: 501 clusters, 500 does not). */
export function shouldCluster(count: number, threshold: number = DEFAULT_NODE_THRESHOLD): boolean {
  return count > threshold;
}
