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
 * The crate a track belongs to: the backend's root_folder (the subfolder of the
 * library root). Falls back to the file's parent folder for older records.
 */
export function crateOf(song: Pick<Song, "root_folder" | "file_path">): string {
  if (song.root_folder) return song.root_folder;
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
