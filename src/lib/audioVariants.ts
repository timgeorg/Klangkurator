/**
 * Display rules for a track's audio files (issue #65, 18_AUDIO_VARIANTS).
 *
 * Pure functions only, so the rules are testable without a DOM: what the Files
 * section lists, what the row badge counts, which file playback will use, and
 * when a tempo pair is an octave apart.
 */

import type { AudioVariant, Song } from "./storage";

/** A file as the Files section lists it, primary first. */
export interface FileRow {
  id: string;
  file_path: string;
  format: string;
  duration?: number;
  size_bytes?: number;
  bitrate?: number;
  sample_rate?: number;
  bit_depth?: number;
  /** The row's one primary; it cannot be detached directly. */
  primary: boolean;
  /** The file is not on this machine (marked, never dropped). */
  missing: boolean;
}

/** The file's name without its folder, for the compact "which file played" line. */
export function fileName(path: string): string {
  const parts = (path || "").replace(/\\/g, "/").split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : path;
}

/**
 * Every file of a track, primary first, then the variants in stored order.
 *
 * @param song The track, or null while the view has nothing selected.
 * @returns The primary and each variant, ready to render.
 */
export function filesOf(song: Song | null | undefined): FileRow[] {
  if (!song) return [];
  const primary: FileRow = {
    id: `primary:${song.id}`,
    file_path: song.file_path,
    format: extensionOf(song.file_path),
    duration: song.duration,
    primary: true,
    missing: Boolean(song.primary_missing),
  };
  const variants = (song.audio_variants ?? []).map((variant: AudioVariant) => ({
    id: variant.id,
    file_path: variant.file_path,
    format: variant.format || extensionOf(variant.file_path),
    duration: variant.duration,
    size_bytes: variant.size_bytes,
    bitrate: variant.bitrate,
    sample_rate: variant.sample_rate,
    bit_depth: variant.bit_depth,
    primary: false,
    missing: Boolean(variant.missing),
  }));
  return [primary, ...variants];
}

/** The suffix without the dot, lowercased — the fallback when no fact was stored. */
export function extensionOf(path: string): string {
  const name = fileName(path || "");
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/**
 * How many extra files the track carries — the number the row badge shows.
 *
 * @param song The track.
 * @returns The variant count; 0 when the row shows no badge at all.
 */
export function variantCount(song: Song | null | undefined): number {
  return song?.audio_variants?.length ?? 0;
}

/**
 * Which file playback will use, and whether that is the primary.
 *
 * The primary plays unless its file is gone; then the first variant that is
 * present takes over. This mirrors the backend's choice so the UI can name the
 * file without waiting for a failed request (18_AUDIO_VARIANTS: "the UI says
 * which file it played").
 *
 * @param song The track about to play.
 * @returns The chosen file, or null when the track has nothing playable.
 */
export function playableFile(song: Song | null | undefined): { file_path: string; source: "primary" | "variant"; missing: boolean } | null {
  if (!song) return null;
  if (!song.primary_missing) {
    return { file_path: song.file_path, source: "primary", missing: false };
  }
  const fallback = (song.audio_variants ?? []).find((variant) => !variant.missing);
  if (fallback) {
    return { file_path: fallback.file_path, source: "variant", missing: false };
  }
  return song.file_path ? { file_path: song.file_path, source: "primary", missing: true } : null;
}

/** Bytes as a short human size: 9.9 MB, 36 MB, 812 KB. */
export function formatSize(bytes: number | undefined | null): string {
  if (!bytes || bytes <= 0) return "–";
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) {
    const mb = bytes / 1_000_000;
    return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
  }
  return `${Math.round(bytes / 1000)} KB`;
}

/** The short format facts of one file: "WAV · 3:25 · 36 MB · 24-bit 44.1 kHz". */
export function fileFacts(row: FileRow): string {
  const parts: string[] = [];
  if (row.format) parts.push(row.format.toUpperCase());
  if (row.duration) parts.push(clock(row.duration));
  if (row.size_bytes) parts.push(formatSize(row.size_bytes));
  if (row.bit_depth) parts.push(`${row.bit_depth}-bit`);
  if (row.sample_rate) parts.push(`${(row.sample_rate / 1000).toFixed(1).replace(/\.0$/, "")} kHz`);
  if (row.bitrate) parts.push(`${row.bitrate} kbps`);
  return parts.join(" · ");
}

/** Seconds as m:ss. */
export function clock(seconds: number): string {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Whether two tempos are the same reading one metrical level apart.
 *
 * The fault the ticket measured: one file read 132.0, the other 66.3.
 *
 * @param primary The track's BPM.
 * @param variant A variant's own reading.
 * @returns True when doubling or halving one lands within 3 % of the other.
 */
export function octaveApart(primary: number | null | undefined, variant: number | null | undefined): boolean {
  if (!primary || !variant) return false;
  return [2, 0.5].some((factor) => Math.abs(primary * factor - variant) <= 0.03 * variant);
}
