import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Pause, Play, Volume1, Volume2, VolumeX, X } from 'lucide-react';
import { usePlayer } from '@/lib/PlayerContext';
import { toast } from '@/hooks/use-toast';

// m:ss — same convention as the duration column (PF-12 revised): minutes unpadded
const formatTime = (seconds: number) => {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// Volume persists across sessions (player-level setting, not per-track)
const VOLUME_KEY = 'klangkurator.player.volume.v1';

function loadVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (raw === null) return 1;
    const v = parseFloat(raw);
    if (isFinite(v) && v >= 0 && v <= 1) return v;
  } catch { /* private mode etc. */ }
  return 1;
}

export function PlayerBar() {
  const { current, isPlaying, stop, toggle, setPlaying } = usePlayer();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const seekingRef = useRef(false);
  // True between src assignment and playback start: the media load algorithm fires
  // a spurious 'pause' when src is replaced — ignore it so track switching doesn't
  // flip the bar to paused while the pending play() is still resolving
  const loadingRef = useRef(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState<number>(loadVolume);
  const [muted, setMuted] = useState(false);

  // Load + play whenever a track is selected
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    audio.src = `/api/audio/${current.id}`;
    loadingRef.current = true;
    setDuration(current.duration ?? 0);
    setCurrentTime(0);
    audio.play().catch(() => {
      // Rapid src changes abort pending play() calls; real failures surface via the 'error' event
    });
  }, [current]);

  // Keep the element in sync with the context play state (bar's play/pause button)
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
  // remounts whenever `current` changes (bar null ↔ rendered), and a fresh
  // element resets volume to 1 — reapplying here restores the saved level
  // before playback starts, so track switches never blare.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = muted;
    try {
      localStorage.setItem(VOLUME_KEY, String(volume));
    } catch { /* ignore */ }
  });

  if (!current) return null;

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    setCurrentTime(t);
    if (audioRef.current) {
      audioRef.current.currentTime = t;
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 h-12 bg-table-header border-t border-table-border flex items-center gap-3 px-4 z-50">
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
        onEnded={stop}
        onTimeUpdate={() => {
          // ~4Hz; suppressed while the user is dragging the seek slider
          if (!seekingRef.current) {
            setCurrentTime(audioRef.current?.currentTime ?? 0);
          }
        }}
        onLoadedMetadata={() => {
          const d = audioRef.current?.duration ?? 0;
          setDuration(isFinite(d) && d > 0 ? d : (current.duration ?? 0));
        }}
        onError={() => {
          toast({
            title: 'Playback failed',
            description: 'File may be missing',
            variant: 'destructive',
          });
          stop();
        }}
      />

      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={toggle}>
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </Button>

      <span className="text-xs text-muted-foreground font-mono w-10 text-right">
        {formatTime(currentTime)}
      </span>

      <input
        type="range"
        className="flex-1 accent-orange-500"
        min={0}
        max={duration}
        step={0.1}
        value={currentTime}
        onChange={handleSeek}
        onPointerDown={() => (seekingRef.current = true)}
        onPointerUp={() => (seekingRef.current = false)}
        onPointerCancel={() => (seekingRef.current = false)}
      />

      <span className="text-xs text-muted-foreground font-mono w-10">
        {formatTime(duration)}
      </span>

      {/* Volume: icon is a mute toggle; slider sets level (0-1) */}
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0"
        onClick={() => setMuted((m) => !m)}
        title={muted ? 'Unmute' : 'Mute'}
      >
        {muted || volume === 0 ? (
          <VolumeX className="w-4 h-4" />
        ) : volume < 0.5 ? (
          <Volume1 className="w-4 h-4" />
        ) : (
          <Volume2 className="w-4 h-4" />
        )}
      </Button>
      <input
        type="range"
        className="w-20 accent-orange-500"
        min={0}
        max={1}
        step={0.01}
        value={muted ? 0 : volume}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          setVolume(v);
          if (v > 0) setMuted(false);
        }}
        title="Volume"
      />

      <div
        className="max-w-xs truncate text-sm text-foreground"
        title={`${current.title} — ${current.artist}`}
      >
        {current.title} — {current.artist}
      </div>

      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={stop} title="Stop">
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}