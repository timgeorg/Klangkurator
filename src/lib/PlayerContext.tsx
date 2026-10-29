import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Song } from "@/lib/storage";
import { readSetting, saveSettings } from "@/lib/settings";

/**
 * Player state. The provider holds the queue (the run Play was pressed in and
 * the position in it), isPlaying and dock; <NowPlaying/> (rendered by DJLayout)
 * owns the <audio> element and reports play/pause back via setPlaying() so rows
 * can mark the playing track.
 *
 * A run is the ordered tracks next()/previous() step through: the library rows
 * as shown, a set's running order or a block (PF-80). It is fixed when Play is
 * pressed and never re-read. play() is a run of one; stop() clears the queue.
 * Every start makes a new queue object, so the same song twice in a row still
 * restarts.
 *
 * dock: "panel" shows the now-playing panel on wide screens (>= 1280px);
 * "bar" keeps the compact bar at every width. Narrow screens always use the bar.
 */
export type PlayerDock = "panel" | "bar";

interface PlayerQueue {
  tracks: Song[];
  index: number;
  /** The way the current track was reached: a track that fails to load is skipped on in this direction. */
  dir: 1 | -1;
}

interface PlayerContextValue {
  current: Song | null;
  queue: PlayerQueue | null;
  isPlaying: boolean;
  dock: PlayerDock;
  play: (song: Song) => void;
  playRun: (tracks: Song[], index: number) => void;
  next: () => void;
  previous: () => void;
  stop: () => void;
  toggle: () => void;
  setPlaying: (playing: boolean) => void;
  setDock: (dock: PlayerDock) => void;
}

/**
 * The saved dock. `settings.json` holds it as of issue #51; the browser value is
 * read only when the file has none, which is the case before the first save.
 */
function loadDock(): PlayerDock {
  const stored = readSetting<string | undefined>("playerDock", undefined);
  if (stored === "bar" || stored === "panel") return stored;
  try {
    return localStorage.getItem("klangkurator.player.dock.v1") === "bar" ? "bar" : "panel";
  } catch {
    return "panel";
  }
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<PlayerQueue | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [dock, setDockState] = useState<PlayerDock>(loadDock);
  const current = queue ? queue.tracks[queue.index] : null;

  const start = useCallback((tracks: Song[], index: number, dir: 1 | -1) => {
    if (index < 0 || index >= tracks.length) return;
    setQueue({ tracks, index, dir });
    setIsPlaying(true);
  }, []);

  const playRun = useCallback((tracks: Song[], index: number) => start(tracks, index, 1), [start]);
  const play = useCallback((song: Song) => start([song], 0, 1), [start]);

  // No wraparound: at either end of the run this does nothing.
  const step = useCallback(
    (dir: 1 | -1) => {
      if (queue) start(queue.tracks, queue.index + dir, dir);
    },
    [queue, start],
  );
  const next = useCallback(() => step(1), [step]);
  const previous = useCallback(() => step(-1), [step]);

  const stop = useCallback(() => {
    setQueue(null);
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(() => setIsPlaying((playing) => !playing), []);

  const setDock = useCallback((next: PlayerDock) => {
    setDockState(next);
    saveSettings({ playerDock: next });
  }, []);

  const value = useMemo(
    () => ({
      current,
      queue,
      isPlaying,
      dock,
      play,
      playRun,
      next,
      previous,
      stop,
      toggle,
      setPlaying: setIsPlaying,
      setDock,
    }),
    [current, queue, isPlaying, dock, play, playRun, next, previous, stop, toggle, setDock],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }
  return ctx;
}
