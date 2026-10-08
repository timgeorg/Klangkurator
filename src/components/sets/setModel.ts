import type { AltTransition, Block, SetItem, Song } from "@/lib/storage";

/**
 * Reading sets and blocks against the library: resolve references, flatten a
 * set into its tracks, total the running time. Shared by the Sets page, the
 * cards and both editors.
 */

export type SongIndex = Map<string, Song>;
export type BlockIndex = Map<string, Block>;

export function indexById<T extends { id: string }>(list: T[]): Map<string, T> {
  return new Map(list.map((entry) => [entry.id, entry]));
}

export function byPosition<T extends { position: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.position - b.position);
}

/**
 * The id a set item points at. The backend stores ref_id only; data written
 * by older versions of the app may carry song_id or block_id instead.
 */
export function itemRef(item: Pick<SetItem, "ref_id" | "song_id" | "block_id">): string {
  return item.ref_id || item.song_id || item.block_id || "";
}

/** A block's tracks in order. Tracks that left the library are skipped. */
export function blockTracks(block: Block, songs: SongIndex): Song[] {
  return byPosition(block.songs)
    .map((entry) => songs.get(entry.song_id))
    .filter((song): song is Song => !!song);
}

export type ResolvedItem =
  | { kind: "song"; item: SetItem; song: Song }
  | { kind: "block"; item: SetItem; block: Block; tracks: Song[] }
  /** The track or block was deleted; the set still holds its slot. */
  | { kind: "missing"; item: SetItem };

export function resolveItem(item: SetItem, songs: SongIndex, blocks: BlockIndex): ResolvedItem {
  const ref = itemRef(item);
  if (item.type === "block") {
    const block = blocks.get(ref);
    return block ? { kind: "block", item, block, tracks: blockTracks(block, songs) } : { kind: "missing", item };
  }
  const song = songs.get(ref);
  return song ? { kind: "song", item, song } : { kind: "missing", item };
}

/** Every track a set plays, blocks expanded in place. */
export function tracksOf(items: ResolvedItem[]): Song[] {
  return items.flatMap((entry) => (entry.kind === "song" ? [entry.song] : entry.kind === "block" ? entry.tracks : []));
}

export function totalSeconds(tracks: Song[]): number {
  return tracks.reduce((sum, song) => sum + (song.duration ?? 0), 0);
}

/**
 * Alternatives as the backend stores them, { ref_id, label }. Older builds
 * wrote { to_song_id, notes }; both read the same.
 */
export function readAlternatives(alternatives: unknown): AltTransition[] {
  if (!Array.isArray(alternatives)) return [];
  return alternatives.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const alt = raw as { ref_id?: unknown; label?: unknown; to_song_id?: unknown; notes?: unknown };
    const ref = typeof alt.ref_id === "string" ? alt.ref_id : typeof alt.to_song_id === "string" ? alt.to_song_id : "";
    if (!ref) return [];
    const label = typeof alt.label === "string" ? alt.label : typeof alt.notes === "string" ? alt.notes : undefined;
    return [{ ref_id: ref, ...(label ? { label } : {}) }];
  });
}

/** "1 track", "14 tracks". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
