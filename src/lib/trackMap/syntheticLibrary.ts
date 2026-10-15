// Track map (issue #8) — a seeded generator of fake tracks (plan phase 1b):
// the shapes the contract's large libraries need, so a test can put 500 or
// 5,000 tracks through the similarity without touching the real library, and so
// the phase 6 dispatcher can build each TM-C fixture (plan phase 6,
// `scripts/make-synthetic-library.ts`). The same seed always gives the same
// tracks, so the perf test is repeatable.
import type { TrackMapSong } from "./types";

/** The fields a generated track carries, with a stable `id`. */
export type SyntheticSong = TrackMapSong;

/** The shapes the contract's fixtures need (TM-C1–TM-C10). */
export interface SyntheticLibraryOptions {
  /** How many tracks to generate; defaults to 500. */
  count?: number;
  /** The generator's seed; defaults to 1. */
  seed?: number;
  /** A prefix for the ids, so two libraries never collide. */
  idPrefix?: string;
  /** How many distinct main genres to use, from the pool's start; defaults to the whole pool. */
  genreCount?: number;
  /** How many distinct subgenres to use, from the pool's start; defaults to the whole pool; 0 leaves every track without one. One track in five carries none, so a subgenre fixture has one to place in its genre cluster (TM-C4). */
  subgenreCount?: number;
  /** The BPM range, both bounds inclusive, so a fixture names the integer BPMs it wants (TM-C2: 90–180 → all ten bins in tens; TM-C4 and TM-C6: 120–129 → one bin). Defaults to 80–190. */
  bpmMin?: number;
  bpmMax?: number;
  /** Spread the energy meter across unrated (0) to 5 in equal steps, so every energy group occurs (TM-C6). */
  energySpread?: boolean;
  /** How many distinct crates to spread the tracks over; defaults to the whole pool. */
  crateCount?: number;
  /**
   * How the artist names vary: by crate (the default), across the alphabet
   * (TM-C9), or not at all (TM-C10).
   */
  artistSpread?: "crate" | "alphabet" | "single";
  /** The fields to leave out, so a library with nothing to cluster by can be built (TM-C7, TM-C9, TM-C10). */
  omit?: SyntheticOmit;
}

/** The fields a fixture library can leave missing. */
export interface SyntheticOmit {
  genre?: boolean;
  bpm?: boolean;
  subgenre?: boolean;
  energy?: boolean;
  crate?: boolean;
  /** Also leave out the other two ratings, so nothing rated remains. */
  ratings?: boolean;
}

// The keys the analyser writes, in short notation; the generator also writes
// long and Camelot ones, so the parser meets every notation in a big library.
const KEYS = [
  "Am", "C", "F#m", "A", "Gm", "D#", "Bbm", "F", "Cm", "E", "Em", "G",
  "Dm", "Bb", "C#m", "A minor", "C# major", "8A", "12B", "3A",
];
// The default pool is the first seven; the rest let a fixture ask for nine
// genres or eight subgenres (TM-C1, TM-C4) without changing the default shape.
const GENRE_POOL = ["Techno", "House", "Trance", "Ambient", "Breaks", "Electro", "Dub", "Disco", "Downtempo", "Garage", "IDM", "Jungle"];
const GENRE_DEFAULT = 7;
const SUBGENRE_POOL = ["Peak Time", "Deep", "Melodic", "Hard", "Acid", "Progressive", "Downtempo", "Minimal", "Tribal", "Ambient"];
const SUBGENRE_DEFAULT = 7;
const CARRIER_WORDS = ["Drift", "Pulse", "Static", "Halo", "Vapor", "Grain", "Signal", "Ember"];
const CRATE_POOL = ["Crate A", "Crate B", "Crate C", "Crate D", "Crate E", "Crate F", "Crate G", "Crate H", "Crate I", "Crate J", "Crate K", "Crate L"];
const CRATE_DEFAULT = 6;
// 26 names, so `artistSpread: "alphabet"` reaches every letter A–Z (TM-C9).
const ALPHABET_ARTISTS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => `${letter} Artist`);

/**
 * A seeded, deterministic library of fake tracks.
 *
 * Every track carries the fields the features read (`bpm`, a key in one of
 * the three notations, genre, subgenre, ratings, year, duration and a
 * `root_folder`). `seed` fixes every value, so two calls with the same
 * options give the same tracks.
 *
 * The options shape the library for a fixture: how many genres, subgenres and
 * crates to spread over (a pool's start, so the shapes nest), the BPM range,
 * whether the energy meter spans unrated to 5, how the artists vary, and which
 * fields to leave out entirely — the last for the fallback fixtures, whose
 * tracks have nothing to cluster by (TM-C7, TM-C9, TM-C10).
 *
 * @param options - The count, the seed, the id prefix and the fixture shape.
 */
export function syntheticLibrary(options: SyntheticLibraryOptions = {}): SyntheticSong[] {
  const count = options.count ?? 500;
  const prefix = options.idPrefix ?? "syn";
  const random = mulberry32(options.seed ?? 1);
  const omit = options.omit ?? {};

  const genres = GENRE_POOL.slice(0, clampCount(options.genreCount ?? GENRE_DEFAULT, GENRE_POOL.length));
  const subgenres = SUBGENRE_POOL.slice(0, clampCount(options.subgenreCount ?? SUBGENRE_DEFAULT, SUBGENRE_POOL.length));
  const crates = CRATE_POOL.slice(0, clampCount(options.crateCount ?? CRATE_DEFAULT, CRATE_POOL.length));
  const bpmMin = options.bpmMin ?? 80;
  const bpmMax = options.bpmMax ?? 190;
  const bpmSpan = Math.max(0, Math.ceil(bpmMax) - Math.ceil(bpmMin) + 1);

  const songs: SyntheticSong[] = [];
  for (let index = 0; index < count; index += 1) {
    // The group-defining fields cycle by index, so a fixture gets exactly the
    // number of genres, subgenres and crates it asks for, and every value
    // occurs; the seed still fixes BPM, key, ratings, duration and title.
    // The energy spread walks the meter's whole range in equal steps, so every
    // energy group occurs (TM-C6).
    const energy = options.energySpread ? Math.round(((index % 11) / 10) * 5 * 10) / 10 : rating(random);
    const hasSubgenre = !omit.subgenre && subgenres.length > 0 && index % 5 !== 4;
    songs.push({
      id: `${prefix}-${String(index + 1).padStart(5, "0")}`,
      title: `${pick(CARRIER_WORDS, random)} ${index + 1}`,
      artist: artistOf(index, crates, options.artistSpread ?? "crate"),
      bpm: omit.bpm ? undefined : bpmMin + Math.floor(random() * bpmSpan),
      musical_key: pick(KEYS, random),
      duration: 180 + Math.floor(random() * 300),
      mainGenre: omit.genre || !genres.length ? undefined : genres[index % genres.length],
      genres: [],
      subgenres: hasSubgenre ? [subgenres[index % subgenres.length]] : [],
      year: 1995 + Math.floor(random() * 30),
      artwork_url: undefined,
      danceability: omit.ratings ? 0 : rating(random),
      energy: omit.energy ? 0 : energy,
      social_acceptance: omit.ratings ? 0 : rating(random),
      root_folder: omit.crate || !crates.length ? undefined : crates[index % crates.length],
    });
  }
  return songs;
}

/** The artist for one track: by crate (default), across the alphabet, or one name. */
function artistOf(
  index: number,
  crates: readonly string[],
  spread: NonNullable<SyntheticLibraryOptions["artistSpread"]>,
): string {
  if (spread === "single") return "One Artist";
  if (spread === "alphabet") return ALPHABET_ARTISTS[index % ALPHABET_ARTISTS.length];
  return crates.length ? `Artist ${crates[index % crates.length]}` : "Artist";
}

/** A pool size clamped into `[0, length]`, so a fixture never asks for more than the pool. */
function clampCount(value: number, length: number): number {
  return Math.max(0, Math.min(length, Math.floor(value)));
}

/** A 0–5 rating with one decimal; 0 stays possible, so unrated tracks occur. */
function rating(random: () => number): number {
  return Math.round(random() * 50) / 10;
}

function pick<T>(values: readonly T[], random: () => number): T {
  return values[Math.floor(random() * values.length)];
}

/** Mulberry32: a small deterministic generator, seeded per library. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
