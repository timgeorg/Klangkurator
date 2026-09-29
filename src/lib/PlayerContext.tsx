import React, { createContext, useContext, useMemo, useState } from "react";
import type { Song } from "@/lib/storage";
import { PlayerBar } from "@/components/dj/PlayerBar";

/**
 * Single-track player state. The provider holds {current, isPlaying} and renders
 * <PlayerBar/> as its last child — PlayerBar owns the <audio> element and reports
 * play/pause back via setPlaying() so rows can highlight the playing track.
 * No queue: play() replaces the current track, stop() clears it.
 */
interface PlayerContextValue {
  current: Song | null;
  isPlaying: boolean;
  play: (song: Song) => void;
  stop: () => void;
  toggle: () => void;
  setPlaying: (playing: boolean) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const play = (song: Song) => {
    setCurrent(song);
    setIsPlaying(true);
  };

  const stop = () => {
    setCurrent(null);
    setIsPlaying(false);
  };

  const toggle = () => setIsPlaying((playing) => !playing);

  const value = useMemo(
    () => ({ current, isPlaying, play, stop, toggle, setPlaying: setIsPlaying }),
    [current, isPlaying]
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <PlayerBar />
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }
  return ctx;
}