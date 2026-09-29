import React from 'react';
import { cn } from '@/lib/utils';

interface WaveformProps {
  className?: string;
  variant?: 'compact' | 'full';
  animate?: boolean;
  /** Real peak envelope (PF-13, 0..1) — legacy pseudo-random pattern when absent. */
  peaks?: number[];
}

export function Waveform({ className, variant = 'compact', peaks }: WaveformProps) {
  // Create a more realistic waveform pattern
  const bars = variant === 'compact' ? 80 : 160;
  const waveformData = peaks
    ? // Real envelope: downsample to `bars` (average pairs, deterministic)
      downsamplePeaks(peaks, bars)
    : Array.from({ length: bars }, (_, i) => {
    // Create more realistic waveform with varying amplitudes
    const baseHeight = Math.sin(i * 0.1) * 0.3 + 0.7;
    const noise = (Math.random() - 0.5) * 0.4;
    const envelope = Math.sin((i / bars) * Math.PI) * 0.8 + 0.2;
    return Math.max(0.05, Math.min(1, baseHeight + noise) * envelope);
  });
  
  return (
    <div className={cn(
      "flex items-end gap-px bg-waveform-background rounded-sm overflow-hidden",
      variant === 'compact' ? "w-20 h-8" : "w-40 h-12",
      className
    )}>
      {waveformData.map((height, index) => (
        <div
          key={index}
          className="bg-waveform-primary opacity-80"
          style={{
            width: '1px',
            height: `${height * 100}%`,
            minHeight: '1px',
          }}
        />
      ))}
    </div>
  );
}

/** Average `peaks` down to exactly `target` values (no randomness). */
function downsamplePeaks(peaks: number[], target: number): number[] {
  if (peaks.length <= target) return peaks;
  const groupSize = peaks.length / target;
  return Array.from({ length: target }, (_, i) => {
    const start = Math.floor(i * groupSize);
    const end = Math.floor((i + 1) * groupSize);
    let sum = 0;
    for (let j = start; j < end; j++) sum += peaks[j] ?? 0;
    return sum / Math.max(1, end - start);
  });
}