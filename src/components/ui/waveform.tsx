import { memo, useId, useMemo } from "react";

import { cn } from "@/lib/utils";

interface WaveformProps {
  className?: string;
  /** compact: table cells; full: detail page and player. */
  variant?: "compact" | "full";
  /** Real peak envelope (PF-13, 0..1). Without it a flat line is drawn, never invented bars. */
  peaks?: number[] | null;
  /** 0..1, paints the played part in the signal colour (player scrubber). */
  progress?: number;
  /** The whole waveform in the signal colour (the current track in a list). */
  active?: boolean;
}

const BAR = 2;
const GAP = 1;

/**
 * Static SVG waveform: one path, scales to its box (no per-bar DOM),
 * mirrored around the centre line like the moodboard's player.
 */
function WaveformImpl({ className, variant = "compact", peaks, progress, active = false }: WaveformProps) {
  const bars = variant === "compact" ? 48 : 160;
  const width = bars * (BAR + GAP) - GAP;

  const path = useMemo(() => {
    if (!peaks || peaks.length === 0) return null;
    const values = downsampleMax(peaks, bars);
    let d = "";
    values.forEach((v, i) => {
      const h = Math.max(6, Math.min(100, v * 100));
      const x = i * (BAR + GAP);
      const y = (100 - h) / 2;
      d += `M${x} ${y.toFixed(1)}h${BAR}v${h.toFixed(1)}h-${BAR}z`;
    });
    return d;
  }, [peaks, bars]);

  const clipId = `wf-${useId().replace(/:/g, "")}`;
  const played = progress !== undefined ? Math.max(0, Math.min(1, progress)) : undefined;

  return (
    <svg
      viewBox={`0 0 ${width} 100`}
      preserveAspectRatio="none"
      aria-hidden
      className={cn("block", variant === "compact" ? "h-6 w-16" : "h-16 w-full", className)}
    >
      {path ? (
        <>
          <path d={path} className={active ? "fill-waveform-played" : "fill-waveform"} />
          {played !== undefined && (
            <>
              <clipPath id={clipId}>
                <rect x="0" y="0" width={width * played} height="100" />
              </clipPath>
              <path d={path} className="fill-waveform-played" clipPath={`url(#${clipId})`} />
            </>
          )}
        </>
      ) : (
        <rect x="0" y="49" width={width} height="2" className="fill-waveform" />
      )}
    </svg>
  );
}

export const Waveform = memo(WaveformImpl);

/** Reduce `peaks` to exactly `target` values, keeping each group's maximum (deterministic). */
function downsampleMax(peaks: number[], target: number): number[] {
  if (peaks.length <= target) return peaks;
  const group = peaks.length / target;
  return Array.from({ length: target }, (_, i) => {
    const start = Math.floor(i * group);
    const end = Math.max(start + 1, Math.floor((i + 1) * group));
    let max = 0;
    for (let j = start; j < end; j++) max = Math.max(max, peaks[j] ?? 0);
    return max;
  });
}
