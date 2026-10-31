import type { Song } from "@/lib/storage";

/**
 * Display rules for track data, shared by the library table, the detail page,
 * the player and set views.
 */

// PF-12 (revised): m:ss, minutes unpadded ("5:37", "12:04"), "--:--" when missing or 0.
// Round the TOTAL first so float durations never produce a "0:60".
export function formatDuration(seconds?: number | null): string {
  if (!seconds) return "--:--";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Long totals for blocks and sets: "1h 12m" or "38m". */
export function formatTotal(seconds: number): string {
  if (!seconds) return "0m";
  const minutes = Math.round(seconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m.toString().padStart(2, "0")}m` : `${m}m`;
}

/** BPM to one decimal at most: 143.6, 136. */
export function formatBpm(bpm?: number | null): string {
  return bpm ? String(Math.round(bpm * 10) / 10) : "–";
}

/** The BPM range a typed value may take, as in the edit dialog. */
export const BPM_RANGE = { min: 40, max: 250 } as const;

/**
 * A typed BPM: "127.5" or "127,5" -> 127.5 (one decimal at most), "" -> null
 * (clear it), anything that isn't a number in BPM_RANGE -> undefined.
 */
export function parseBpm(text: string): number | null | undefined {
  const t = text.trim().replace(",", ".");
  if (!t) return null;
  if (!/^\d+(\.\d+)?$/.test(t)) return undefined;
  const bpm = Math.round(Number(t) * 10) / 10;
  return bpm >= BPM_RANGE.min && bpm <= BPM_RANGE.max ? bpm : undefined;
}

// The analyser's notation ("Am", "F#"), so an edited key filters and searches
// like an analysed one; keyName() gives the full name beside it.
export const MUSICAL_KEYS = [
  "C", "Cm", "C#", "C#m", "D", "Dm", "D#", "D#m", "E", "Em", "F", "Fm",
  "F#", "F#m", "G", "Gm", "G#", "G#m", "A", "Am", "A#", "A#m", "B", "Bm",
];

/** The genre a track shows: its main genre, else the first genre read from the file's tags. */
export function trackGenre(song: Pick<Song, "mainGenre" | "genres" | "genre">): string | undefined {
  return song.mainGenre || song.genres?.[0] || song.genre || undefined;
}

/**
 * Whether a key string names a minor key. Handles the notations in real data:
 * short ("Am", "F#m"), long ("A minor"), Camelot ("8A" minor, "8B" major).
 */
export function isMinorKey(key?: string | null): boolean {
  if (!key) return false;
  const k = key.trim();
  if (/minor|moll/i.test(k)) return true;
  if (/major|dur/i.test(k)) return false;
  if (/^\d{1,2}\s*A$/i.test(k)) return true;
  if (/^\d{1,2}\s*B$/i.test(k)) return false;
  return /^[A-G][#b♯♭]?\s*m(in)?$/.test(k);
}

/** "Am" -> "A minor", "C#" -> "C♯ major"; unknown formats pass through. */
export function keyName(key?: string | null): string {
  if (!key) return "";
  const k = key.trim();
  const m = /^([A-G])([#b♯♭]?)\s*(m|min|minor|maj|major)?$/i.exec(k);
  if (!m) return k;
  const accidental = m[2] === "#" ? "♯" : m[2] === "b" ? "♭" : m[2];
  const mode = m[3] && /^m(in(or)?)?$/i.test(m[3]) ? "minor" : "major";
  return `${m[1].toUpperCase()}${accidental} ${mode}`;
}

/**
 * The crate key of a track: the crate id it stores (issue #11).
 *
 * The key is an id, never a name, so two crates called "House" in two music
 * locations stay apart. A row the registry does not know falls back to its
 * file's parent folder, which keeps an unresolved row visible instead of
 * dropping it out of every bucket.
 *
 * @param song - The song, or the two fields that answer the question.
 * @returns The crate id, or the file's parent folder name, or "".
 */
export function crateOf(song: Pick<Song, "crate_id" | "file_path">): string {
  if (song.crate_id) return song.crate_id;
  const parts = (song.file_path || "").replace(/\\/g, "/").split("/").filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : "";
}

/**
 * Split a title into its name and a trailing version: "(Extended Mix)",
 * "[CAT001]". The version is set quieter in lists; nothing is removed.
 */
export function splitTitle(title: string): { main: string; version: string } {
  const m = /^(.*?\S)\s*((?:[([][^()[\]]*[)\]]\s*)+)$/.exec(title);
  if (!m || !m[1]) return { main: title, version: "" };
  return { main: m[1], version: m[2].trim() };
}
