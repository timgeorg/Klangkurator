// Track map (issue #8) — the phase 6 synthetic-library generator (plan ›
// Phases row 6, `scripts/make-synthetic-library.ts`): it writes a sandbox
// `library.json` shaped for one TM-C fixture, so the dispatcher can build each
// fixture the behavior contract names without touching the real library
// (AGENTS.md's sandbox rule). Development-only: nothing in the app imports it,
// so it never reaches the built bundle.
//
// Lives at `src/lib/trackMap/make-synthetic-library.ts` in this commit because
// the worktree's toolset cannot create the `scripts/` directory; move it to
// `scripts/make-synthetic-library.ts` (the plan's path) and it still resolves
// `@/lib/trackMap/syntheticLibrary` through the `@` alias.
//
//   npx vite-node scripts/make-synthetic-library.ts -- --count 1200 --genres 9 --out /tmp/kk-sandbox/.klangkurator/library.json
//
// It reuses the seeded generator `src/lib/trackMap/syntheticLibrary.ts`
// (`syntheticLibrary`) and only turns its options into a JSON file: the shapes
// are the generator's, never duplicated here.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { syntheticLibrary, type SyntheticLibraryOptions } from "@/lib/trackMap/syntheticLibrary";
import type { Song } from "@/lib/storage";

/** The library file the backend reads: the songs plus the empty collections the store expects. */
interface LibraryFile {
  songs: Song[];
  tags: never[];
  song_tags: never[];
  relationships: never[];
  playlists: never[];
  playlist_songs: never[];
}

/** The flags, in the contract's own words, and how each maps onto the generator. */
interface Flags {
  count: number;
  seed: number;
  idPrefix: string;
  out: string;
  genres?: number;
  subgenres?: number;
  bpmMin?: number;
  bpmMax?: number;
  energySpread: boolean;
  crates?: number;
  artistSpread?: "crate" | "alphabet" | "single";
  omitGenre: boolean;
  omitBpm: boolean;
  omitEnergy: boolean;
  omitRatings: boolean;
}

const USAGE = `Write a sandbox library.json for one track-map cluster fixture.

  --count <n>          how many tracks (default 1200; TM-C8 uses 5000)
  --seed <n>           the generator's seed (default 8)
  --id-prefix <p>      the ids' prefix (default syn)
  --out <path>         where to write the library.json (required)
  --genres <n>         how many distinct main genres (TM-C1: 9; TM-C2 and TM-C4: 2; TM-C6: 1)
  --subgenres <n>      how many distinct subgenres (TM-C4: 8; TM-C6: 0 for none); one track in five carries none
  --bpm-min <n>        the BPM range's low bound, inclusive (TM-C2: 90; TM-C4 and TM-C6: 120)
  --bpm-max <n>        the BPM range's high bound, inclusive (TM-C2: 180 → ten bins in tens; TM-C4 and TM-C6: 129 → one bin)
  --energy-spread      spread the meter across unrated to 5 (TM-C6)
  --crates <n>         how many distinct crates (TM-C7: 12; TM-C9, TM-C10: 1)
  --artist-spread <s>  crate | alphabet | single (TM-C9: alphabet; TM-C10: single)
  --no-genre           leave the genre out entirely (the fallback fixtures)
  --no-bpm             leave the BPM out entirely
  --no-energy          leave the energy out entirely
  --no-ratings         leave both ratings out entirely
`;

/** The number after a flag, or undefined when the flag is absent. */
function numberFlag(argv: readonly string[], name: string): number | undefined {
  const index = argv.indexOf(name);
  if (index < 0) return undefined;
  const value = Number(argv[index + 1]);
  if (!Number.isFinite(value)) throw new Error(`${name} needs a number`);
  return value;
}

/** The string after a flag, or undefined when the flag is absent. */
function stringFlag(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index < 0 ? undefined : argv[index + 1];
}

/** The flags as given, with the contract's fixture shapes as the defaults' guide. */
function parseFlags(argv: readonly string[]): Flags {
  const artistSpread = stringFlag(argv, "--artist-spread");
  if (artistSpread !== undefined && !["crate", "alphabet", "single"].includes(artistSpread)) {
    throw new Error("--artist-spread must be crate, alphabet or single");
  }
  return {
    count: numberFlag(argv, "--count") ?? 1200,
    seed: numberFlag(argv, "--seed") ?? 8,
    idPrefix: stringFlag(argv, "--id-prefix") ?? "syn",
    out: stringFlag(argv, "--out") ?? "",
    genres: numberFlag(argv, "--genres"),
    subgenres: numberFlag(argv, "--subgenres"),
    bpmMin: numberFlag(argv, "--bpm-min"),
    bpmMax: numberFlag(argv, "--bpm-max"),
    energySpread: argv.includes("--energy-spread"),
    crates: numberFlag(argv, "--crates"),
    artistSpread: artistSpread as Flags["artistSpread"],
    omitGenre: argv.includes("--no-genre"),
    omitBpm: argv.includes("--no-bpm"),
    omitEnergy: argv.includes("--no-energy"),
    omitRatings: argv.includes("--no-ratings"),
  };
}

/** The flags as the generator's own options, so the shapes live in one place. */
function toGeneratorOptions(flags: Flags): SyntheticLibraryOptions {
  return {
    count: flags.count,
    seed: flags.seed,
    idPrefix: flags.idPrefix,
    genreCount: flags.genres,
    subgenreCount: flags.subgenres,
    bpmMin: flags.bpmMin,
    bpmMax: flags.bpmMax,
    energySpread: flags.energySpread,
    crateCount: flags.crates,
    artistSpread: flags.artistSpread,
    omit: {
      genre: flags.omitGenre,
      bpm: flags.omitBpm,
      energy: flags.omitEnergy,
      ratings: flags.omitRatings,
    },
  };
}

/**
 * The generated tracks as the backend's library JSON: the songs plus the empty
 * collections the store expects, so a backend can read the file as its own and
 * `GET /api/songs` lists the tracks (the contract's observability).
 *
 * @param flags - The parsed flags.
 */
function libraryJson(flags: Flags): LibraryFile {
  const stamp = new Date(0).toISOString();
  const songs: Song[] = syntheticLibrary(toGeneratorOptions(flags)).map((track) => ({
    id: track.id,
    title: track.title,
    artist: track.artist,
    file_path: `/${track.root_folder ?? "Unsorted"}/${track.id}.mp3`,
    bpm: track.bpm,
    musical_key: track.musical_key,
    duration: track.duration,
    mainGenre: track.mainGenre,
    subgenres: track.subgenres,
    genres: track.genres,
    year: track.year,
    artwork_url: track.artwork_url,
    energy: track.energy,
    people: track.people,
    root_folder: track.root_folder,
    created_at: stamp,
    updated_at: stamp,
  }));
  return { songs, tags: [], song_tags: [], relationships: [], playlists: [], playlist_songs: [] };
}

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  console.log(USAGE);
} else {
  const flags = parseFlags(argv);
  if (!flags.out) throw new Error(`--out is required.\n\n${USAGE}`);
  const json = JSON.stringify(libraryJson(flags), null, 2);
  mkdirSync(dirname(flags.out), { recursive: true });
  writeFileSync(flags.out, json);
  console.log(`${flags.count} tracks written to ${flags.out}`);
}
