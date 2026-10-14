import { storage, type SongPatch } from "./storage";

export interface SongWriter {
  /** Queues a change to a track; it is sent after every change queued before it. */
  write: (songId: string, patch: SongPatch) => void;
  /** Resolves once every queued change has been sent. */
  idle: () => Promise<void>;
}

/**
 * Saves inline edits one request at a time, in the order they were made.
 * Changes to a track made while a save is running are merged and sent next,
 * so a quick run of edits (arrow keys on a rating) ends in one more request,
 * and an older value can never land after a newer one.
 */
export function createSongWriter(onError: (songId: string, error: unknown) => void): SongWriter {
  const pending = new Map<string, SongPatch>();
  let running: Promise<void> | null = null;

  const drain = async () => {
    while (pending.size > 0) {
      const [songId, patch] = pending.entries().next().value as [string, SongPatch];
      pending.delete(songId);
      try {
        await storage.updateSong(songId, patch);
      } catch (error) {
        onError(songId, error);
      }
    }
    // The same synchronous step as the empty check: no write slips in between.
    running = null;
  };

  return {
    write(songId, patch) {
      pending.set(songId, { ...pending.get(songId), ...patch });
      // Started in a microtask, so `running` is set before the drain can end.
      running ??= Promise.resolve().then(drain);
    },
    idle: () => running ?? Promise.resolve(),
  };
}
