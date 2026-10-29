// Track map (issue #8) — the per-input similarity table, the weighted
// composite and the nearest tracks (plan phase 1b). Every rule here is the
// plan's algorithm contract: missing values are skipped per pair, the
// composite is symmetric and rounded to 9 decimals, and a pair needs the
// minimum overlap before it counts at all.
import type { MapInput, MapInputs, MapLink, TrackFeatures } from "./types";

import { MAP_INPUTS } from "./types";
import { connectionSet, type Connections } from "./connections";

/** How many nearest tracks a node links to (plan: proposed, k = 8). */
export const NEAREST_K = 8;

/** The scale of the BPM rule: a fold distance of 0.2 is already 0. */
const BPM_SCALE = 0.2;
/** The Camelot rule's step count: four steps apart or more is 0. */
const KEY_STEPS = 4;
/** The relationship rule's shared-connection weight. */
const SHARED_CONNECTIONS = 0.5;

/** The options the composite and `nearest` read. */
export interface SimilarityOptions {
  inputs: MapInputs;
  /** connections.ts output; without it the relationships input is skipped. */
  connections?: Connections;
  /** How many nearest tracks to keep; defaults to `NEAREST_K`. */
  k?: number;
}

/** One entry of a nearest-tracks list. */
export interface NearestEntry {
  id: string;
  s: number;
}

/**
 * The similarity a single input gives a pair, or undefined when either track
 * lacks the value (the pair skips that input).
 *
 * @param input - The input to measure.
 * @param a - One track's features.
 * @param b - The other track's features.
 * @param connections - The built connections, for the relationships input.
 */
export function inputSimilarity(
  input: MapInput,
  a: TrackFeatures,
  b: TrackFeatures,
  connections?: Connections,
): number | undefined {
  switch (input) {
    case "bpm":
      return both(a.bpm, b.bpm, bpmSimilarity);
    case "key":
      return both(a.key, b.key, keySimilarity);
    case "genre":
      return both(a.genre, b.genre, (x, y) => (x === y ? 1 : 0));
    case "subgenre":
      return jaccardInput(a.subgenres, b.subgenres);
    case "tags":
      return jaccardInput(a.tagIds, b.tagIds);
    case "energy":
      return both(a.energy, b.energy, ratingSimilarity);
    case "people":
      return both(a.people, b.people, ratingSimilarity);
    case "year":
      return both(a.year, b.year, (x, y) => Math.max(0, 1 - Math.abs(x - y) / 10));
    case "duration":
      return both(a.duration, b.duration, (x, y) => Math.max(0, 1 - Math.abs(x - y) / 180));
    case "relationships":
      return relationshipSimilarity(a.id, b.id, connections);
    default:
      return undefined;
  }
}

/**
 * The pair's similarity: the weighted mean over the enabled inputs both
 * tracks carry. Undefined when the pair is not compared at all — fewer than
 * `min(2, |E|)` inputs overlap. Rounded to 9 decimals, so the same pair
 * always compares equal with itself.
 *
 * @param a - One track's features.
 * @param b - The other track's features.
 * @param options - The enabled inputs, their weights and the connections.
 */
export function similarity(a: TrackFeatures, b: TrackFeatures, options: SimilarityOptions): number | undefined {
  const enabled = enabledInputs(options.inputs);
  if (!enabled.length) return undefined;
  return composite(a, b, enabled, options.inputs, options.connections);
}

/** The enabled inputs, in `MAP_INPUTS` order. */
function enabledInputs(inputs: MapInputs): MapInput[] {
  return MAP_INPUTS.filter((input) => inputs[input]?.enabled);
}

/** The weighted mean over the enabled inputs both tracks carry. */
function composite(
  a: TrackFeatures,
  b: TrackFeatures,
  enabled: readonly MapInput[],
  weights: MapInputs,
  connections?: Connections,
): number | undefined {
  let weighted = 0;
  let total = 0;
  let compared = 0;
  for (const input of enabled) {
    const s = inputSimilarity(input, a, b, connections);
    if (s === undefined) continue;
    weighted += weights[input].weight * s;
    total += weights[input].weight;
    compared += 1;
  }

  if (compared < Math.min(2, enabled.length) || !total) return undefined;
  return round9(weighted / total);
}

/**
 * A track's nearest tracks: the first `k` candidates by similarity
 * descending, then song id ascending. Only pairs with a similarity above 0
 * are candidates, so an unlinked track gets an empty list.
 *
 * @param a - The track to rank the others against.
 * @param tracks - Every shown track, `a` included.
 * @param options - The enabled inputs, the connections and `k`.
 */
export function nearest(
  a: TrackFeatures,
  tracks: readonly TrackFeatures[],
  options: SimilarityOptions,
): NearestEntry[] {
  const enabled = enabledInputs(options.inputs);
  const candidates: NearestEntry[] = [];
  for (const other of tracks) {
    if (other.id === a.id) continue;
    const s = composite(a, other, enabled, options.inputs, options.connections);
    if (s !== undefined && s > 0) candidates.push({ id: other.id, s });
  }
  return takeNearest(candidates, options.k);
}

/**
 * Every track's nearest list, with each pair measured once.
 *
 * @param tracks - The shown tracks.
 * @param options - The enabled inputs, the connections and `k`.
 */
export function allNearest(
  tracks: readonly TrackFeatures[],
  options: SimilarityOptions,
): Map<string, NearestEntry[]> {
  const enabled = enabledInputs(options.inputs);
  const candidates = new Map<string, NearestEntry[]>(tracks.map((track) => [track.id, []]));
  for (let i = 0; i < tracks.length; i += 1) {
    for (let j = i + 1; j < tracks.length; j += 1) {
      const s = composite(tracks[i], tracks[j], enabled, options.inputs, options.connections);
      if (s === undefined || s <= 0) continue;
      candidates.get(tracks[i].id)!.push({ id: tracks[j].id, s });
      candidates.get(tracks[j].id)!.push({ id: tracks[i].id, s });
    }
  }
  return new Map(
    [...candidates].map(([id, entries]) => [id, takeNearest(entries, options.k)]),
  );
}

/**
 * The undirected union of the nearest sets: `{A, B}` is a link when
 * `B ∈ nearest(A)` or `A ∈ nearest(B)`, with `s = S(A, B)`. One link per pair,
 * `source < target`, sorted. This is what the layout runs on, for tracks and
 * for clusters alike.
 *
 * @param nearestLists - The per-node nearest lists, `allNearest`'s output.
 */
export function linksFromNearest(nearestLists: Map<string, NearestEntry[]>): MapLink[] {
  const links = new Map<string, MapLink>();
  for (const [id, entries] of nearestLists) {
    for (const entry of entries) {
      const [source, target] = id < entry.id ? [id, entry.id] : [entry.id, id];
      links.set(`${source}\u0000${target}`, { source, target, s: entry.s });
    }
  }
  return [...links.values()].sort(
    (a, b) =>
      compare(a.source, b.source) || compare(a.target, b.target),
  );
}

// ── The per-input rules ───────────────────────────────────

/**
 * BPM by tempo ratio with half and double time folded together:
 * `x = |log2(a / b)| mod 1`, `d = min(x, 1 − x)`, `s = max(0, 1 − d / 0.2)`.
 * So 87 and 174 fold together (s = 1), and an octave apart is never further
 * than the fold allows.
 */
function bpmSimilarity(a: number, b: number): number {
  const x = Math.abs(Math.log2(a / b)) % 1;
  const d = Math.min(x, 1 - x);
  return Math.max(0, 1 - d / BPM_SCALE);
}

/**
 * Key by distance on the Camelot wheel: the circular number distance, plus 1
 * when the modes differ; `s = max(0, 1 − steps / 4)`.
 */
function keySimilarity(a: { n: number; mode: "A" | "B" }, b: { n: number; mode: "A" | "B" }): number {
  const distance = Math.abs(a.n - b.n);
  const steps = Math.min(distance, 12 - distance) + (a.mode === b.mode ? 0 : 1);
  return Math.max(0, 1 - steps / KEY_STEPS);
}

/** Ratings by difference on the 0–5 scale. */
function ratingSimilarity(a: number, b: number): number {
  return 1 - Math.abs(a - b) / 5;
}

/** Overlap of two sets; an empty set is missing, so the pair skips the input. */
function jaccardInput(a: readonly string[], b: readonly string[]): number | undefined {
  if (!a.length || !b.length) return undefined;
  return jaccard(a, b);
}

/**
 * The plan's relationship rule: 1 when `B ∈ R(A)`; else half the Jaccard of
 * the two connection sets when both are non-empty; else skip. Two remixes of
 * the same original share `R = {X}` and score 0.5.
 */
function relationshipSimilarity(a: string, b: string, connections?: Connections): number | undefined {
  const aNeighbours = connectionSet(connections, a);
  if (aNeighbours.has(b)) return 1;
  const bNeighbours = connectionSet(connections, b);
  if (!aNeighbours.size || !bNeighbours.size) return undefined;
  return SHARED_CONNECTIONS * jaccard(aNeighbours, bNeighbours);
}

// ── Helpers ───────────────────────────────────────────────

function both<T>(a: T | undefined, b: T | undefined, score: (a: T, b: T) => number): number | undefined {
  return a === undefined || b === undefined ? undefined : score(a, b);
}

function jaccard(a: Iterable<string>, b: Iterable<string>): number {
  const left = a instanceof Set ? a : new Set(a);
  const right = b instanceof Set ? b : new Set(b);
  let shared = 0;
  for (const value of left) if (right.has(value)) shared += 1;
  const union = left.size + right.size - shared;
  return union ? shared / union : 0;
}

/** `S` descending, then song id ascending; the first `k`, never more. */
function takeNearest(candidates: readonly NearestEntry[], k?: number): NearestEntry[] {
  const limit = k ?? NEAREST_K;
  return [...candidates]
    .sort((a, b) => b.s - a.s || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, Math.max(0, limit));
}

/** Rounds the 9 decimals the plan compares at. */
export function round9(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}

/** A plain code-unit comparison, so a link's order never depends on a locale. */
function compare(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
