// Track map (issue #8) — a library song and its tag ids, read as the values
// the similarity composite weighs (plan phase 1b). The normalisation is the
// plan's algorithm contract: numbers are missing when absent, ≤ 0 or not
// finite; ratings are missing when 0; an empty set is missing; keys are read
// from every notation the analyser and the editor write.
import type { SongTag } from "@/lib/storage";
import { isMinorKey, trackGenre } from "@/lib/trackFormat";

import type { CamelotKey, TrackFeatures, TrackMapSong } from "./types";

// ── Keys ──────────────────────────────────────────────────

// Flats folded onto sharps, so the enharmonic pairs share one Camelot code
// (Abm = G#m, Ebm = D#m, Bb = A#, Gb = F#, Db = C#, Ab = G# — the plan's
// Camelot table). Any other spelling is not in the table, so it is missing.
const STEM_ALIAS: Record<string, string> = {
  db: "c#",
  eb: "d#",
  gb: "f#",
  ab: "g#",
  bb: "a#",
};

// Camelot code per canonical note name, from the plan's table: minor (A) and
// major (B) keys each take the twelve numbers.
const MINOR_CODES: Record<string, number> = {
  "g#": 1,
  "d#": 2,
  "a#": 3,
  f: 4,
  c: 5,
  g: 6,
  d: 7,
  a: 8,
  e: 9,
  b: 10,
  "f#": 11,
  "c#": 12,
};
const MAJOR_CODES: Record<string, number> = {
  b: 1,
  "f#": 2,
  "c#": 3,
  "g#": 4,
  "d#": 5,
  "a#": 6,
  f: 7,
  c: 8,
  g: 9,
  d: 10,
  a: 11,
  e: 12,
};

/**
 * The Camelot key a notation names, or undefined when it names none.
 *
 * Reads every notation the analyser and the editor write: short ("Am",
 * "F#m", "Bb"), long ("A minor", "C# major") and Camelot ("8A"),
 * case-insensitively, with `♯`/`♭` and `#`/`b` alike. Enharmonics share a
 * code, so the flats are folded onto sharps before the lookup (Abm = G#m).
 *
 * @param key - The song's `musical_key`, in any of the three notations.
 * @returns The key's Camelot code, or undefined when the notation is unknown.
 */
export function parseCamelot(key?: string | null): CamelotKey | undefined {
  if (!key) return undefined;
  const cleaned = key.trim().toLowerCase().replace(/♯/g, "#").replace(/♭/g, "b");

  const camelot = /^(\d{1,2})\s*([ab])$/.exec(cleaned);
  if (camelot) {
    const n = Number(camelot[1]);
    if (n < 1 || n > 12) return undefined;
    return { n, mode: camelot[2] === "a" ? "A" : "B" };
  }

  const note = /^([a-g])\s*([#b]?)\s*(minor|moll|min|major|maj|m|dur)?$/.exec(cleaned);
  if (!note) return undefined;
  // isMinorKey wants the short form's letter capitalised; this parser is case-insensitive.
  const minor = isMinorKey(cleaned.replace(/^([a-g])/, (letter) => letter.toUpperCase()));
  const stem = STEM_ALIAS[note[1] + note[2]] ?? note[1] + note[2];
  const n = (minor ? MINOR_CODES : MAJOR_CODES)[stem];
  return n === undefined ? undefined : { n, mode: minor ? "A" : "B" };
}

// ── Features ──────────────────────────────────────────────

/** A number that survives the plan's rules: present, finite and above 0. */
function positiveNumber(value?: number | null): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

/** A set field's values, normalised, empties dropped, each value kept once. */
function uniqueValues(
  values: readonly string[] | undefined,
  normalise: (value: string) => string,
): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const raw of values ?? []) {
    const value = normalise(raw);
    if (value && !seen.has(value)) {
      seen.add(value);
      kept.push(value);
    }
  }
  return kept;
}

const lowercase = (value: string): string => value.trim().toLowerCase();
const trimmed = (value: string): string => value.trim();

/**
 * One song's values for the similarity composite.
 *
 * `bpm`, `year` and `duration` are missing when absent, ≤ 0 or not finite;
 * the two ratings are missing when 0 (unrated); an empty `subgenres` or
 * `tagIds` set stays empty and is skipped per pair. Genre and subgenres are
 * lowercased for comparing; `genreLabel` keeps the display case for labels
 * and the user's genre colour.
 *
 * @param song - The stored song.
 * @param tagIds - The song's tag ids, from the `song_tags` join.
 */
export function toFeatures(song: TrackMapSong, tagIds: readonly string[] = []): TrackFeatures {
  const genreLabel = trackGenre(song)?.trim() || undefined;
  return {
    id: song.id,
    bpm: positiveNumber(song.bpm),
    key: parseCamelot(song.musical_key),
    genre: genreLabel?.toLowerCase(),
    genreLabel,
    subgenres: uniqueValues(song.subgenres, lowercase),
    tagIds: uniqueValues(tagIds, trimmed),
    energy: positiveNumber(song.energy),
    people: positiveNumber(song.people ?? 0),
    year: positiveNumber(song.year),
    duration: positiveNumber(song.duration),
  };
}

/**
 * The features of every song, with the tag join applied.
 *
 * @param songs - The library's songs.
 * @param songTags - The `song_tags` rows, joined onto their songs here.
 */
export function buildFeatures(
  songs: readonly TrackMapSong[],
  songTags: readonly SongTag[] = [],
): TrackFeatures[] {
  const tagsBySong = new Map<string, string[]>();
  for (const link of songTags) {
    const tagIds = tagsBySong.get(link.song_id);
    if (tagIds) tagIds.push(link.tag_id);
    else tagsBySong.set(link.song_id, [link.tag_id]);
  }
  return songs.map((song) => toFeatures(song, tagsBySong.get(song.id) ?? []));
}
