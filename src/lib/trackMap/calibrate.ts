// Track map (issue #8) — the phase 3 calibration (plan › Phases row 3 and
// › Risks and spikes): the spread of `S` on a real library at the default
// inputs. Development-only: nothing in the app imports it, so it never reaches
// the built bundle. It reads a library JSON, so it needs no backend:
//
//   npx vite-node src/lib/trackMap/calibrate.ts -- /tmp/kk-sandbox/.klangkurator/library.json
//
// Point it at a sandbox copy, never the real library (AGENTS.md, the plan's
// sandbox rule).
import { readFileSync } from "node:fs";

import { buildFeatures } from "@/lib/trackMap/features";
import { nearest, similarity } from "@/lib/trackMap/similarity";
import { DEFAULT_INPUTS, type TrackFeatures } from "@/lib/trackMap/types";
import type { Song, SongTag } from "@/lib/storage";

/** The fields the calibration counts, to show what the similarity can use. */
interface Coverage {
  tracks: number;
  bpm: number;
  key: number;
  genre: number;
  subgenre: number;
  tags: number;
  ratings: number;
}

/** min / median / max of a list of numbers, to 4 decimals. */
function spread(values: number[]): { min: number; median: number; max: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (index: number) => Number(sorted[index].toFixed(4));
  if (!sorted.length) return { min: 0, median: 0, max: 0 };
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return { min: at(0), median: Number(median.toFixed(4)), max: at(sorted.length - 1) };
}

function coverageOf(features: readonly TrackFeatures[]): Coverage {
  return {
    tracks: features.length,
    bpm: features.filter((feature) => feature.bpm !== undefined).length,
    key: features.filter((feature) => feature.key !== undefined).length,
    genre: features.filter((feature) => feature.genre !== undefined).length,
    subgenre: features.filter((feature) => feature.subgenres.length > 0).length,
    tags: features.filter((feature) => feature.tagIds.length > 0).length,
    ratings: features.filter(
      (feature) => feature.energy !== undefined && feature.people !== undefined,
    ).length,
  };
}

const path = process.argv[2];
if (!path) throw new Error("Pass a library JSON path (a sandbox copy).");

const library = JSON.parse(readFileSync(path, "utf8")) as { songs: Song[]; song_tags?: SongTag[] };
const features = buildFeatures(library.songs, library.song_tags ?? []);
const options = { inputs: DEFAULT_INPUTS };

const pairwise: number[] = [];
for (let i = 0; i < features.length; i += 1) {
  for (let j = i + 1; j < features.length; j += 1) {
    const s = similarity(features[i], features[j], options);
    if (s !== undefined) pairwise.push(s);
  }
}

const neighbourScores: number[] = [];
let unlinked = 0;
for (const feature of features) {
  const list = nearest(feature, features, options);
  if (!list.length) unlinked += 1;
  else neighbourScores.push(list[0].s);
}

const comparedPairs = (features.length * (features.length - 1)) / 2;
console.log(
  JSON.stringify(
    {
      library: path,
      tracks: features.length,
      pairs: comparedPairs,
      compared: pairwise.length,
      notCompared: comparedPairs - pairwise.length,
      pairwiseS: spread(pairwise),
      nearestNeighbourS: spread(neighbourScores),
      unlinked,
      coverage: coverageOf(features),
    },
    null,
    2,
  ),
);
