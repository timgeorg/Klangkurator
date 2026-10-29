// Track map (issue #8) — grouping tracks for clusters: the group key of each
// cluster dimension and the dimension choice (plan phase 1b), and the cluster
// features, the cluster similarity and the cluster nodes and links (plan phase
// 6). The choice rule is the plan's: genre, BPM range, subgenre and energy in
// that order, the first inside the `C_MIN`–`C_MAX` band, then the one nearest
// the band, then the crate and artist-initial fallbacks, and only when nothing
// can split the tracks the last resort (the first `T` tracks by title).
import { connectionSet, type Connections } from "./connections";
import { allNearest, linksFromNearest } from "./similarity";
import { toFeatures } from "./features";
import type {
  CamelotKey,
  ClusterChoiceReason,
  ClusterDimension,
  ClusterFilter,
  MapInputs,
  MapLink,
  MapNode,
  TrackFeatures,
  TrackMapSong,
} from "./types";

/** The plan's starting node threshold: above it the map clusters. */
export const DEFAULT_NODE_THRESHOLD = 500;
/** The plan's starting band for a dimension's group count. */
export const C_MIN = 4;
export const C_MAX = 60;

/** Tim's four cluster dimensions, in their priority order. */
export const CLUSTER_DIMENSIONS: readonly ClusterDimension[] = ["genre", "bpmRange", "subgenre", "energy"];
/** The two fallbacks, in their order (Tim's answer 3). */
export const FALLBACK_DIMENSIONS: readonly ClusterDimension[] = ["crate", "artistInitial"];

/** How many cluster links one cluster keeps: `min(CLUSTER_LINK_K, c − 1)` (plan › Clusters). */
export const CLUSTER_LINK_K = 8;

/** The dimensions as the rail and the canvas's accessible name write them. */
export const CLUSTER_DIMENSION_LABELS: Record<ClusterDimension, string> = {
  genre: "genre",
  bpmRange: "BPM range",
  subgenre: "subgenre",
  energy: "energy",
  crate: "crate",
  artistInitial: "artist initial",
};

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

/** The chosen dimension with why it was chosen. */
export interface ClusterChoice {
  /** The dimension to group by, or null for the last resort. */
  dimension: ClusterDimension | null;
  /** How many groups the chosen dimension makes; 0 for the last resort. */
  count: number;
  reason: ClusterChoiceReason;
}

/**
 * The dimension to cluster by, and why.
 *
 * Genre, BPM range, subgenre and energy are tried in that order; the first
 * with a group count inside `[min, max]` wins (`"band"`). A dimension with 1
 * group or none is never taken. When none fits the band, the one nearest it
 * wins, by `|ln(c / min)|` below or `|ln(c / max)|` above, ties by order
 * (`"nearest"`). When none of the four has 2 groups or more, crate is tried,
 * then the artist's first letter, each needing 2 groups or more
 * (`"fallback"`). When even those cannot split the tracks, the dimension is
 * null: the last resort, the first tracks by title with a notice (`TM-C10`).
 *
 * @param tracks - The shown tracks.
 * @param options - The band edges, defaulting to the plan's fixed values.
 */
export function clusterChoice(tracks: readonly ClusterTrack[], options: ClusterChoiceOptions = {}): ClusterChoice {
  const min = options.min ?? C_MIN;
  const max = options.max ?? C_MAX;

  const counts = CLUSTER_DIMENSIONS.map((dimension) => ({ dimension, c: groupCount(tracks, dimension) }));

  // A dimension with a single group (or none) is never taken, whatever the band says.
  const inside = counts.find((entry) => entry.c >= 2 && entry.c >= min && entry.c <= max);
  if (inside) return { dimension: inside.dimension, count: inside.c, reason: "band" };

  const splittable = counts.filter((entry) => entry.c >= 2);
  if (splittable.length) {
    const distance = (c: number): number => (c < min ? Math.abs(Math.log(c / min)) : Math.abs(Math.log(c / max)));
    let best = splittable[0];
    for (const entry of splittable.slice(1)) {
      if (distance(entry.c) < distance(best.c)) best = entry;
    }
    return { dimension: best.dimension, count: best.c, reason: "nearest" };
  }

  for (const dimension of FALLBACK_DIMENSIONS) {
    const c = groupCount(tracks, dimension);
    if (c >= 2) return { dimension, count: c, reason: "fallback" };
  }
  return { dimension: null, count: 0, reason: "lastResort" };
}

/**
 * The dimension to cluster by, or null for the last resort (the first tracks
 * by title, with a notice). `clusterChoice` says the same and why.
 *
 * @param tracks - The shown tracks.
 * @param options - The band edges, defaulting to the plan's fixed values.
 */
export function chooseClusterDimension(
  tracks: readonly ClusterTrack[],
  options: ClusterChoiceOptions = {},
): ClusterDimension | null {
  return clusterChoice(tracks, options).dimension;
}

/** Whether the map clusters at this many tracks (the plan: 501 clusters, 500 does not). */
export function shouldCluster(count: number, threshold: number = DEFAULT_NODE_THRESHOLD): boolean {
  return count > threshold;
}

// ── The cluster view of a library (phase 6) ───────────────

/**
 * A song as the cluster dimensions see it: its similarity features plus the
 * two fields `groupKey` reads beyond them, the artist and the crate (TM-C7,
 * TM-C9).
 *
 * @param song - The stored song.
 * @param feature - The song's features, paired up by song id.
 */
export function withClusterFields(
  song: Pick<TrackMapSong, "artist" | "root_folder">,
  feature: TrackFeatures,
): ClusterTrack {
  return { ...feature, artist: song.artist, root_folder: song.root_folder };
}

/** Whether a track is kept by every chosen cluster filter: its `groupKey` for
 * each filter's dimension equals that filter's value, so choosing a cluster
 * reveals exactly its members and no one else (TM-C3).
 *
 * @param track - The track, in its cluster view.
 * @param filters - The chosen cluster filters; none keeps every track.
 */
export function matchesClusterFilters(track: ClusterTrack, filters: readonly ClusterFilter[]): boolean {
  return filters.every((filter) => groupKey(track, filter.dimension) === filter.value);
}

/**
 * The songs kept by every chosen cluster filter (TM-C3). The features pair up
 * with the songs by id; a song the feature list is missing gets its features
 * built from the song, so a filter never silently drops it.
 *
 * @param songs - The library's songs, in their stored order.
 * @param features - The songs' features.
 * @param filters - The chosen cluster filters; none keeps every song.
 */
export function filterByClusterFilters(
  songs: readonly TrackMapSong[],
  features: readonly TrackFeatures[],
  filters: readonly ClusterFilter[],
): TrackMapSong[] {
  if (!filters.length) return [...songs];
  const featureIndex = new Map(features.map((feature) => [feature.id, feature]));
  return songs.filter((song) =>
    matchesClusterFilters(withClusterFields(song, featureIndex.get(song.id) ?? toFeatures(song)), filters),
  );
}

/** One cluster as the rail lists it. */
export interface ClusterGroup {
  /** The `groupKey` value a `ClusterFilter` matches. */
  value: string;
  /** The label the canvas draws, in its first-seen case where there is one. */
  label: string;
  count: number;
}

/**
 * The clusters a model holds, in node order, for the rail's list (TM-C1).
 * Cluster nodes carry their value, label and count; a track node is not a
 * cluster and is left out.
 *
 * @param nodes - The model's nodes.
 */
export function clusterGroups(nodes: readonly MapNode[]): ClusterGroup[] {
  return nodes.flatMap((node) =>
    node.kind === "cluster" && node.clusterValue !== undefined
      ? [{ value: node.clusterValue, label: node.label, count: node.count ?? 0 }]
      : [],
  );
}

/**
 * The features a cluster is compared with (plan › Clusters): the median BPM,
 * the most common genre and key, the subgenres and tags at least 25 % of the
 * members carry, and the mean of the rated values. A cluster carries no year
 * and no duration — the plan names neither — so a pair skips those two inputs,
 * as it skips any value one side lacks.
 */
export interface ClusterFeatures extends TrackFeatures {
  /** The member track ids, in the order they arrived. */
  memberIds: string[];
}

/**
 * One cluster's features, from its members.
 *
 * The median BPM, the most common genre (its display case kept for labels) and
 * the most common key, the subgenres and tags at least 25 % of the members
 * carry, and the mean of each rated value. A value no member carries is
 * missing, so the pair skips that input as it does for a track.
 *
 * @param id - The cluster node's id, which the similarity compares under.
 * @param members - The cluster's member tracks, in the order they arrived.
 */
export function clusterFeatures(id: string, members: readonly ClusterTrack[]): ClusterFeatures {
  const genre = mostCommon(members.map((member) => member.genre));
  return {
    id,
    bpm: median(members.map((member) => member.bpm)),
    key: mostCommonKey(members.map((member) => member.key)),
    genre,
    genreLabel:
      genre === undefined ? undefined : members.find((member) => member.genre === genre)?.genreLabel ?? genre,
    subgenres: sharedValues(members.map((member) => member.subgenres)),
    tagIds: sharedValues(members.map((member) => member.tagIds)),
    energy: mean(members.map((member) => member.energy)),
    people: mean(members.map((member) => member.people)),
    memberIds: members.map((member) => member.id),
  };
}

/** Everything `buildClusters` reads. */
export interface BuildClustersInput {
  /** The shown tracks, in their cluster view. */
  tracks: readonly ClusterTrack[];
  dimension: ClusterDimension;
  inputs: MapInputs;
  /** connections.ts output; without it the relationships input is skipped. */
  connections?: Connections;
  /** How many links each cluster keeps; defaults to `min(8, c − 1)`. */
  k?: number;
}

/** The clusters of a set of tracks: their nodes and their links. */
export interface ClusterBuild {
  /** One node per group value, in value order. */
  nodes: MapNode[];
  /** The cluster-to-cluster links the layout runs on. */
  links: MapLink[];
  /** Clusters in no link at all, as `MapModel.unlinkedCount` counts them. */
  unlinkedCount: number;
}

/**
 * The clusters of a set of tracks, grouped by `groupKey`.
 *
 * Each group becomes one node carrying its value, its label and its count. The
 * clusters are then compared through the same similarity rules as tracks —
 * their features come from `clusterFeatures` — and each keeps
 * `min(8, c − 1)` links, so a small map of clusters is not a hairball. A
 * cluster's connections are the union of its members', so a cluster is never
 * directly connected to another: only the shared-connections half of the
 * relationships rule applies between them.
 *
 * @param input - The tracks, the dimension, the inputs and the connections.
 */
export function buildClusters(input: BuildClustersInput): ClusterBuild {
  const groups = new Map<string, ClusterTrack[]>();
  for (const track of input.tracks) {
    const value = groupKey(track, input.dimension);
    const group = groups.get(value);
    if (group) group.push(track);
    else groups.set(value, [track]);
  }
  const ordered = [...groups.entries()].sort((a, b) => compare(a[0], b[0]));

  const nodes: MapNode[] = [];
  const features: ClusterFeatures[] = [];
  const connections: Connections = new Map();
  for (const [value, members] of ordered) {
    const id = clusterId(input.dimension, value);
    const label = clusterLabel(input.dimension, value, members);
    nodes.push({
      id,
      kind: "cluster",
      label,
      // A genre cluster draws in that genre's own colour; the other dimensions
      // name no genre, so their nodes stay neutral.
      genreLabel: input.dimension === "genre" ? label : undefined,
      clusterDimension: input.dimension,
      clusterValue: value,
      count: members.length,
    });
    features.push(clusterFeatures(id, members));
    const union = new Set<string>();
    for (const member of members) {
      for (const other of connectionSet(input.connections, member.id)) union.add(other);
    }
    connections.set(id, union);
  }

  const c = nodes.length;
  const k = input.k ?? Math.min(CLUSTER_LINK_K, Math.max(0, c - 1));
  const nearestLists = allNearest(features, { inputs: input.inputs, connections, k });
  return {
    nodes,
    links: linksFromNearest(nearestLists),
    unlinkedCount: [...nearestLists.values()].filter((entries) => entries.length === 0).length,
  };
}

/** The cluster node's id: opaque, but stable and unique per dimension and value. */
function clusterId(dimension: ClusterDimension, value: string): string {
  return `cluster:${dimension}:${value}`;
}

/**
 * The value the canvas labels a cluster with. A genre keeps its display case
 * (`genreLabel`, the plan's first-seen case); a subgenre's own values are
 * lowercased by `features.ts`, so its label is the group key.
 */
function clusterLabel(dimension: ClusterDimension, value: string, members: readonly ClusterTrack[]): string {
  if (dimension === "genre") return members[0].genreLabel?.trim() || value;
  return value;
}

/** The values at least a quarter of the sets carry, sorted. */
function sharedValues(sets: readonly (readonly string[])[]): string[] {
  const counts = new Map<string, number>();
  for (const values of sets) {
    for (const value of new Set(values)) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const threshold = sets.length * 0.25;
  return [...counts]
    .filter(([, count]) => count >= threshold)
    .map(([value]) => value)
    .sort(compare);
}

/** The median of the values that are there, or undefined when none is. */
function median(values: readonly (number | undefined)[]): number | undefined {
  const present = values.filter((value): value is number => value !== undefined).sort((a, b) => a - b);
  if (!present.length) return undefined;
  const middle = Math.floor(present.length / 2);
  return present.length % 2 ? present[middle] : (present[middle - 1] + present[middle]) / 2;
}

/** The mean of the values that are there, or undefined when none is. */
function mean(values: readonly (number | undefined)[]): number | undefined {
  const present = values.filter((value): value is number => value !== undefined);
  return present.length ? present.reduce((total, value) => total + value, 0) / present.length : undefined;
}

/** The most frequent value, ties going to the value seen first. */
function mostCommon(values: readonly (string | undefined)[]): string | undefined {
  const counts = new Map<string, number>();
  for (const value of values) if (value !== undefined) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best: string | undefined;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/** The most frequent key, ties going to the key seen first. */
function mostCommonKey(keys: readonly (CamelotKey | undefined)[]): CamelotKey | undefined {
  const counts = new Map<string, { key: CamelotKey; count: number }>();
  for (const key of keys) {
    if (!key) continue;
    const entry = counts.get(`${key.n}${key.mode}`);
    if (entry) entry.count += 1;
    else counts.set(`${key.n}${key.mode}`, { key, count: 1 });
  }
  let best: CamelotKey | undefined;
  let bestCount = 0;
  for (const entry of counts.values()) {
    if (entry.count > bestCount) {
      best = entry.key;
      bestCount = entry.count;
    }
  }
  return best;
}

/** A plain code-unit comparison, so a map never depends on a locale. */
function compare(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
