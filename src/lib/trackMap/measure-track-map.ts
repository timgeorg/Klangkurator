// Track map (issue #8) — the phase 6 scale measurement (plan › Phases row 6,
// › Risks and spikes, NFR-12): the re-solve time at 500, 1,000 and 5,000
// tracks, on deterministic synthetic libraries, so the numbers the plan fixes
// are measured rather than guessed. Development-only: nothing in the app
// imports it, so it never reaches the built bundle.
//
//   npx vite-node src/lib/trackMap/measure-track-map.ts
//
// It measures the CPU-bound half of a change: `buildModel` (the similarity and
// the cluster choice) plus `solveLayout` (the 300 synchronous ticks). That is
// the re-solve TM-C8 bounds. The pan-frame cost is a renderer measurement and
// belongs to Chromium — see the plan's phase 6 measurement section for that
// command; the layout is what this harness proves fits in the budget.
import { performance } from "node:perf_hooks";

import { buildModel } from "@/lib/trackMap/buildModel";
import { buildFeatures } from "@/lib/trackMap/features";
import { solveLayout } from "@/lib/trackMap/layout";
import { syntheticLibrary } from "@/lib/trackMap/syntheticLibrary";
import { DEFAULT_INPUTS, type Positions } from "@/lib/trackMap/types";

/** The library sizes NFR-12 names. */
const SIZES = [500, 1000, 5000];
/** How many times each size is re-solved; the first run is dropped as a warm-up. */
const RUNS = 5;

/** One re-solve: build the model and solve the layout from no seeds. */
function reSolve(count: number): { ms: number; nodes: number; dim: string; links: number } {
  const songs = syntheticLibrary({ count, seed: 41, genreCount: 9, bpmMin: 80, bpmMax: 180 });
  const features = buildFeatures(songs);

  const startedAt = performance.now();
  const model = buildModel({ songs, features, inputs: DEFAULT_INPUTS });
  const positions: Positions = solveLayout(model.nodes, model.links, new Map());
  const ms = performance.now() - startedAt;

  return {
    ms,
    nodes: model.nodes.length,
    dim: model.clusterDimension ?? (model.lastResort ? "last resort" : "tracks"),
    links: model.links.length,
  };
}

/** The ms values sorted, with the p95 index the contract's limit reads. */
function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Number(sorted[Math.max(0, index)].toFixed(1));
}

const rows = SIZES.map((count) => {
  // A warm-up run, then the measured ones; positions are not reused, so every
  // run is a cold re-solve, the worst case a change can cost.
  reSolve(count);
  const runs = Array.from({ length: RUNS }, () => reSolve(count));
  const times = runs.map((run) => run.ms);
  const last = runs[runs.length - 1];
  return {
    tracks: count,
    nodes: last.nodes,
    dimension: last.dim,
    links: last.links,
    medianMs: percentile(times, 50),
    p95Ms: percentile(times, 95),
    maxMs: Number(Math.max(...times).toFixed(1)),
  };
});

console.log(JSON.stringify({ inputs: "default", runsPerSize: RUNS, rows }, null, 2));
