import React from 'react';
import { cn } from '@/lib/utils';

interface WaveformProps {
  className?: string;
  variant?: 'compact' | 'full';
  animate?: boolean;
}

export function Waveform({ className, variant = 'compact', animate = false }: WaveformProps) {
  // Generate random waveform data for visualization
  const bars = variant === 'compact' ? 32 : 64;
  const waveformData = Array.from({ length: bars }, () => Math.random() * 100);
  
  return (
    <div className={cn(
      "flex items-end gap-[1px] bg-waveform-background rounded-sm overflow-hidden",
      variant === 'compact' ? "w-16 h-8" : "w-32 h-12",
      className
    )}>
      {waveformData.map((height, index) => (
        <div
          key={index}
          className={cn(
            "bg-gradient-to-t from-waveform-primary to-waveform-secondary transition-all duration-75",
            animate && "animate-pulse",
            variant === 'compact' ? "w-[2px] min-h-[2px]" : "w-[3px] min-h-[3px]"
          )}
          style={{
            height: `${Math.max(height, variant === 'compact' ? 8 : 12)}%`,
            animationDelay: animate ? `${index * 20}ms` : undefined,
          }}
        />
      ))}
    </div>
  );
}