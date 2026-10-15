// Track map (issue #8) — a seeded generator of fake tracks (plan phase 1b):
// the shapes the contract's large libraries need, so a test can put 500 or
// 5,000 tracks through the similarity without touching the real library. The
// same seed always gives the same tracks, so the perf test is repeatable.
import type { TrackMapSong } from "./types";

/** The fields a generated track carries, with a stable `id`. */
export type SyntheticSong = TrackMapSong;

export interface SyntheticLibraryOptions {
  /** How many tracks to generate; defaults to 500. */
  count?: number;
  /** The generator's seed; defaults to 1. */
  seed?: number;
  /** A prefix for the ids, so two libraries never collide. */
  idPrefix?: string;
}

// The keys the analyser writes, in short notation; the generator also writes
// long and Camelot ones, so the parser meets every notation in a big library.
const KEYS = [
  "Am", "C", "F#m", "A", "Gm", "D#", "Bbm", "F", "Cm", "E", "Em", "G",
  "Dm", "Bb", "C#m", "A minor", "C# major", "8A", "12B", "3A",
];
const GENRES = ["Techno", "House", "Trance", "Ambient", "Breaks", "Electro", "Dub"];
const SUBGENRES = ["Peak Time", "Deep", "Melodic", "Hard", "Acid", "Progressive", "Downtempo"];
const CARRIER_WORDS = ["Drift", "Pulse", "Static", "Halo", "Vapor", "Grain", "Signal", "Ember"];
const CRATES = ["Crate A", "Crate B", "Crate C", "Crate D", "Crate E", "Crate F"];

/**
 * A seeded, deterministic library of fake tracks.
 *
 * Every track carries the fields the features read (`bpm`, a key in one of
 * the three notations, genre, subgenre, ratings, year, duration and a
 * `root_folder`). `seed` fixes every value, so two calls with the same
 * options give the same tracks.
 *
 * @param options - The count, the seed and the id prefix.
 */
export function syntheticLibrary(options: SyntheticLibraryOptions = {}): SyntheticSong[] {
  const count = options.count ?? 500;
  const prefix = options.idPrefix ?? "syn";
  const random = mulberry32(options.seed ?? 1);
  const songs: SyntheticSong[] = [];

  for (let index = 0; index < count; index += 1) {
    const bpm = 80 + Math.floor(random() * 100) + Math.round(random() * 10) / 10;
    songs.push({
      id: `${prefix}-${String(index + 1).padStart(5, "0")}`,
      title: `${pick(CARRIER_WORDS, random)} ${index + 1}`,
      artist: `Artist ${pick(CRATES, random)}`,
      bpm,
      musical_key: pick(KEYS, random),
      duration: 180 + Math.floor(random() * 300),
      mainGenre: pick(GENRES, random),
      genres: [],
      subgenres: random() < 0.8 ? [pick(SUBGENRES, random)] : [],
      year: 1995 + Math.floor(random() * 30),
      artwork_url: undefined,
      danceability: rating(random),
      energy: rating(random),
      social_acceptance: rating(random),
      root_folder: pick(CRATES, random),
    });
  }
  return songs;
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
