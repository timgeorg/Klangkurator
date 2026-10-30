import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Pause, PanelBottom, PanelRight, Play, SkipBack, SkipForward, Square, Volume1, Volume2, VolumeX } from "lucide-react";

import { CoverArt } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Waveform } from "@/components/ui/waveform";
import { toast } from "@/hooks/use-toast";
import { WIDE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { isMapRoute } from "@/lib/mapRoute";
import { usePlayer } from "@/lib/PlayerContext";
import { readSetting, saveSettings } from "@/lib/settings";
import type { Song } from "@/lib/storage";
import { splitTitle } from "@/lib/trackFormat";
import { cn } from "@/lib/utils";

// m:ss, minutes unpadded (PF-12 revised), same as the duration column
const formatTime = (seconds: number) => {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

// Volume persists across sessions (player-level setting, not per-track)
/** The saved volume, from `settings.json` alone as of issue #51. */
function loadVolume(): number {
  const stored = readSetting<number | undefined>("volume", undefined);
  if (typeof stored === "number" && Number.isFinite(stored) && stored >= 0 && stored <= 1) return stored;
  return 1;
}

const formatBpm = (bpm?: number | null) => (bpm ? String(Math.round(bpm * 10) / 10) : "–");

/**
 * The preview player (PF-16). It plays the current track of the run Play was
 * pressed in; previous / next step through that run and show only when it has
 * more than one track, and the next track starts when one ends (PF-80). A
 * panel on the right on wide screens (the moodboard's now-playing column), a
 * bar at the bottom otherwise or when docked. On the map it is always the
 * bottom bar, with its dock buttons hidden, derived from the route and never
 * from the saved dock preference (TM-M8). The <audio> element stays first in
 * the DOM so switching layouts never interrupts playback.
 */
export function NowPlaying() {
  const { current, queue, isPlaying, dock, next, previous, stop, toggle, setPlaying, setDock } = usePlayer();
  const isWide = useMediaQuery(WIDE_QUERY);
  const { pathname } = useLocation();
  const onMap = isMapRoute(pathname);
  const mode = !onMap && dock === "panel" && isWide ? "panel" : "bar";
  const hasPrevious = !!queue && queue.index > 0;
  const hasNext = !!queue && queue.index < queue.tracks.length - 1;
  const run: RunControls | undefined =
    queue && queue.tracks.length > 1 ? { hasPrevious, hasNext, onPrevious: previous, onNext: next } : undefined;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const seekingRef = useRef(false);
  // True between src assignment and playback start: the media load algorithm fires
  // a spurious 'pause' when src is replaced. Ignore it so track switching doesn't
  // flip the player to paused while the pending play() is still resolving.
  const loadingRef = useRef(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState<number>(loadVolume);
  const [muted, setMuted] = useState(false);

  // Load + play whenever a track starts. Keyed on the queue, not the song:
  // next onto the same song (a set can hold it twice) must restart it too.
  useEffect(() => {
    const audio = audioRef.current;
    const song = queue?.tracks[queue.index];
    if (!audio || !song) return;
    audio.src = `/api/audio/${song.id}`;
    loadingRef.current = true;
    setDuration(song.duration ?? 0);
    setCurrentTime(0);
    audio.play().catch((err) => {
      // Rapid src changes abort pending play() calls; real failures surface via the 'error' event.
      // Auto-advance plays without a click: if the browser blocks that, show the player as paused.
      if (err?.name === "NotAllowedError") setPlaying(false);
    });
  }, [queue, setPlaying]);

  // Keep the element in sync with the context play state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // Apply volume/mute to the element; persist across sessions.
  // Runs on every render while mounted (not dep-keyed): the <audio> element
  // remounts whenever `current` changes (player null <-> rendered), and a fresh
  // element resets volume to 1. Reapplying here restores the saved level
  // before playback starts, so track switches never blare.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = muted;
  });

  // Persist the level only when it actually changes: the effect above runs on
  // every render, and writing settings there would send a request per frame.
  useEffect(() => {
    saveSettings({ volume });
  }, [volume]);

  if (!current) return null;

  const seekTo = (t: number) => {
    setCurrentTime(t);
    if (audioRef.current) audioRef.current.currentTime = t;
  };

  const changeVolume = (v: number) => {
    setVolume(v);
    if (v > 0) setMuted(false);
  };

  const shared: ViewProps = {
    song: current,
    isPlaying,
    run,
    currentTime,
    duration,
    volume,
    muted,
    onToggle: toggle,
    onStop: stop,
    onSeek: seekTo,
    seekingRef,
    onVolume: changeVolume,
    onMute: () => setMuted((m) => !m),
  };

  return (
    <aside
      aria-label="Now playing"
      data-mode={mode}
      className={cn(
        "k-shell-player z-30 bg-card text-card-foreground",
        mode === "panel" ? "border-l border-border" : "border-t border-border",
      )}
    >
      <audio
        ref={audioRef}
        preload="metadata"
        onPlay={() => {
          loadingRef.current = false;
          setPlaying(true);
        }}
        onPause={() => {
          if (!loadingRef.current) setPlaying(false);
        }}
        onEnded={hasNext ? next : stop}
        onTimeUpdate={() => {
          // ~4Hz; suppressed while the user is dragging the scrubber
          if (!seekingRef.current) {
            setCurrentTime(audioRef.current?.currentTime ?? 0);
          }
        }}
        onLoadedMetadata={() => {
          const d = audioRef.current?.duration ?? 0;
          setDuration(isFinite(d) && d > 0 ? d : (current.duration ?? 0));
        }}
        onError={() => {
          // One missing file skips on, the way the run was going, instead of ending it
          const back = queue?.dir === -1;
          const skip = back ? hasPrevious : hasNext;
          toast({
            title: "Playback failed",
            description: `“${current.title}”: the file may be missing.${skip ? ` Playing the ${back ? "previous" : "next"} track.` : ""}`,
            variant: "destructive",
          });
          if (!skip) stop();
          else if (back) previous();
          else next();
        }}
      />
      <span className="sr-only" aria-live="polite">
        {current.artist ? `${current.title}, ${current.artist}` : current.title}
      </span>
      {mode === "panel" ? (
        <PanelView {...shared} onDock={() => setDock("bar")} />
      ) : (
        <BarView {...shared} onUndock={isWide && !onMap ? () => setDock("panel") : undefined} />
      )}
    </aside>
  );
}

/** Previous / next: only while a run of more than one track plays. */
interface RunControls {
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

interface ViewProps {
  song: Song;
  isPlaying: boolean;
  run?: RunControls;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  onToggle: () => void;
  onStop: () => void;
  onSeek: (t: number) => void;
  seekingRef: React.MutableRefObject<boolean>;
  onVolume: (v: number) => void;
  onMute: () => void;
}

function PanelView(props: ViewProps & { onDock: () => void }) {
  const { song, isPlaying, run, currentTime, duration, onToggle, onStop, onDock } = props;
  const genre = song.mainGenre || song.genre;
  const titleParts = splitTitle(song.title);
  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div aria-hidden className="k-grain-layer" />
      <div className="relative flex items-center justify-end gap-1 px-3 pt-3">
        <Button variant="ghost" size="icon-sm" onClick={onDock} aria-label="Dock player to the bottom" title="Dock to the bottom">
          <PanelBottom />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onStop} aria-label="Stop playback" title="Stop">
          <Square />
        </Button>
      </div>
      <div className="relative min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        <Link
          to={`/song/${song.id}`}
          className="mt-1 block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Open ${song.title}`}
        >
          <CoverArt src={song.artwork_url} current className="aspect-square w-full rounded-lg" eager />
        </Link>

        <div className="mt-5">
          <h2 className="line-clamp-3 font-serif text-[1.4375rem] leading-[1.16] tracking-[-0.01em] [text-wrap:balance]">
            {titleParts.main}
          </h2>
          {titleParts.version && (
            <p className="mt-0.5 truncate font-serif text-[15px] text-muted-foreground">{titleParts.version}</p>
          )}
          <p className="mt-1 truncate text-[15px] text-foreground/80">{song.artist}</p>
          {(genre || song.year) && (
            <p className="mt-1 truncate text-[13px] text-muted-foreground">
              {[genre, song.year].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        <Scrubber {...props} className="mt-5 h-14" bars="full" />
        <div className="k-num mt-1.5 flex justify-between text-[11px] text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        <Transport isPlaying={isPlaying} onToggle={onToggle} run={run} size="lg" className="mt-4 justify-center" />
        <VolumeControl {...props} className="mt-3" />

        <dl className="mt-6 grid grid-cols-2 border-t border-border pt-4">
          <div>
            <dt className="k-label text-muted-foreground">BPM</dt>
            <dd className="k-num mt-2 text-lg">{formatBpm(song.bpm)}</dd>
          </div>
          <div>
            <dt className="k-label text-muted-foreground">Key</dt>
            <dd className="k-num mt-2 text-lg">{song.musical_key || "–"}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function BarView(props: ViewProps & { onUndock?: () => void }) {
  const { song, isPlaying, run, currentTime, duration, onToggle, onStop, onUndock } = props;
  return (
    <div className="flex h-full items-center gap-3 px-3 md:gap-4 md:px-4">
      <Link
        to={`/song/${song.id}`}
        className="flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Open ${song.title}`}
      >
        <CoverArt src={song.artwork_url} current className="h-10 w-10 shrink-0 rounded-sm" />
        <span className="hidden w-40 min-w-0 flex-col sm:flex lg:w-56">
          <span className="truncate text-[13px] font-medium leading-tight">{song.title}</span>
          <span className="truncate text-xs text-muted-foreground">{song.artist}</span>
        </span>
      </Link>
      <Transport isPlaying={isPlaying} onToggle={onToggle} run={run} />
      <span className="k-num hidden w-10 text-right text-[11px] text-muted-foreground sm:block">{formatTime(currentTime)}</span>
      {/* The title gives way before the scrubber does: the bar is narrower when the sidebar is open */}
      <Scrubber {...props} className="h-8 min-w-14 flex-1 sm:min-w-20" bars="full" />
      <span className="k-num hidden w-10 text-[11px] text-muted-foreground sm:block">{formatTime(duration)}</span>
      {/* From 768px to 1279px only the mute button: the slider's width goes to the scrubber */}
      <VolumeControl {...props} className="hidden shrink-0 md:flex xl:w-28" sliderClassName="hidden xl:flex" />
      {onUndock && (
        <Button variant="ghost" size="icon-sm" className="shrink-0" onClick={onUndock} aria-label="Show the player panel" title="Show the panel">
          <PanelRight />
        </Button>
      )}
      <Button variant="ghost" size="icon-sm" className="shrink-0" onClick={onStop} aria-label="Stop playback" title="Stop">
        <Square />
      </Button>
    </div>
  );
}

function Transport({
  isPlaying,
  onToggle,
  run,
  size = "md",
  className,
}: {
  isPlaying: boolean;
  onToggle: () => void;
  run?: RunControls;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <div className={cn("flex shrink-0 items-center", size === "lg" ? "gap-3" : "gap-1", className)}>
      {run && (
        <SkipButton label="Previous track" available={run.hasPrevious} onClick={run.onPrevious}>
          <SkipBack />
        </SkipButton>
      )}
      <PlayToggle isPlaying={isPlaying} onToggle={onToggle} size={size} />
      {run && (
        <SkipButton label="Next track" available={run.hasNext} onClick={run.onNext}>
          <SkipForward />
        </SkipButton>
      )}
    </div>
  );
}

// aria-disabled rather than disabled: a keyboard user who steps to the end of
// the run keeps focus on the button. A press there is a no-op in the player.
function SkipButton({
  label,
  available,
  onClick,
  children,
}: {
  label: string;
  available: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-disabled={!available || undefined}
      className="focus-visible:ring-offset-card [&_svg]:fill-current aria-disabled:pointer-events-none [&[aria-disabled=true]_svg]:opacity-45 [@media(pointer:coarse)]:min-w-11"
    >
      {children}
    </Button>
  );
}

function PlayToggle({ isPlaying, onToggle, size = "md" }: { isPlaying: boolean; onToggle: () => void; size?: "md" | "lg" }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isPlaying ? "Pause" : "Play"}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-foreground/70 text-foreground transition-[background-color,color,border-color] duration-fast hover:border-foreground hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
        size === "lg" ? "h-14 w-14 [&_svg]:size-5" : "h-9 w-9 [&_svg]:size-4",
      )}
    >
      {isPlaying ? <Pause fill="currentColor" strokeWidth={0} /> : <Play fill="currentColor" strokeWidth={0} className="translate-x-[1px]" />}
    </button>
  );
}

function Scrubber({
  song,
  currentTime,
  duration,
  onSeek,
  seekingRef,
  className,
  bars,
}: ViewProps & { className?: string; bars: "compact" | "full" }) {
  const progress = duration > 0 ? currentTime / duration : 0;
  return (
    <div className={cn("relative rounded-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-card", className)}>
      <Waveform variant={bars} peaks={song.waveform_peaks} progress={progress} className="h-full w-full" />
      <input
        type="range"
        aria-label="Seek"
        aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
        min={0}
        max={duration || 0}
        step={0.1}
        value={Math.min(currentTime, duration || 0)}
        onChange={(e) => onSeek(parseFloat(e.target.value))}
        onPointerDown={() => (seekingRef.current = true)}
        onPointerUp={() => (seekingRef.current = false)}
        onPointerCancel={() => (seekingRef.current = false)}
      />
    </div>
  );
}

function VolumeControl({
  volume,
  muted,
  onVolume,
  onMute,
  className,
  sliderClassName,
}: ViewProps & { className?: string; sliderClassName?: string }) {
  const silent = muted || volume === 0;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onMute}
        aria-label={muted ? "Unmute" : "Mute"}
        title={muted ? "Unmute" : "Mute"}
      >
        {silent ? <VolumeX /> : volume < 0.5 ? <Volume1 /> : <Volume2 />}
      </Button>
      <Slider
        aria-label="Volume"
        min={0}
        max={1}
        step={0.01}
        value={[muted ? 0 : volume]}
        onValueChange={([v]) => onVolume(v)}
        className={cn("min-w-0 flex-1", sliderClassName)}
      />
    </div>
  );
}
