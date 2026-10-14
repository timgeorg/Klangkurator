import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Song } from "@/lib/storage";

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

const DOCK_KEY = "klangkurator.player.dock.v1";

function loadDock(): PlayerDock {
  try {
    return localStorage.getItem(DOCK_KEY) === "bar" ? "bar" : "panel";
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

  const playRun = useCallback((tracks: Song[], index: number) => {
    if (index < 0 || index >= tracks.length) return;
    setQueue({ tracks, index });
    setIsPlaying(true);
  }, []);

  const play = useCallback((song: Song) => playRun([song], 0), [playRun]);

  // No wraparound: at either end of the run this does nothing.
  const step = useCallback(
    (delta: 1 | -1) => {
      if (queue) playRun(queue.tracks, queue.index + delta);
    },
    [queue, playRun],
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
    try {
      localStorage.setItem(DOCK_KEY, next);
    } catch {
      /* ignore */
    }
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
