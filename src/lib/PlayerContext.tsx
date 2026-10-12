import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Song } from "@/lib/storage";

/**
 * Single-track player state. The provider holds {current, isPlaying, dock};
 * <NowPlaying/> (rendered by DJLayout) owns the <audio> element and reports
 * play/pause back via setPlaying() so rows can mark the playing track.
 * No queue: play() replaces the current track, stop() clears it.
 *
 * dock: "panel" shows the now-playing panel on wide screens (>= 1280px);
 * "bar" keeps the compact bar at every width. Narrow screens always use the bar.
 */
export type PlayerDock = "panel" | "bar";

interface PlayerContextValue {
  current: Song | null;
  isPlaying: boolean;
  dock: PlayerDock;
  play: (song: Song) => void;
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
  const [current, setCurrent] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [dock, setDockState] = useState<PlayerDock>(loadDock);

  const play = useCallback((song: Song) => {
    setCurrent(song);
    setIsPlaying(true);
  }, []);

  const stop = useCallback(() => {
    setCurrent(null);
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
    () => ({ current, isPlaying, dock, play, stop, toggle, setPlaying: setIsPlaying, setDock }),
    [current, isPlaying, dock, play, stop, toggle, setDock],
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
