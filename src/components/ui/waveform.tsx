import React from 'react';
import { cn } from '@/lib/utils';

interface WaveformProps {
  className?: string;
  variant?: 'compact' | 'full';
  animate?: boolean;
}

export function Waveform({ className, variant = 'compact' }: WaveformProps) {
  return (
    <div className={cn(
      "flex items-center justify-center bg-waveform-background rounded-sm overflow-hidden",
      variant === 'compact' ? "w-20 h-8" : "w-40 h-12",
      className
    )}>
      <svg 
        viewBox="0 0 100 32" 
        className="w-full h-full opacity-80"
        fill="none"
      >
        <path
          d="M2 16h2v-4h2v8h2v-12h2v16h2v-6h2v10h2v-14h2v18h2v-8h2v12h2v-16h2v20h2v-10h2v14h2v-18h2v22h2v-12h2v16h2v-20h2v24h2v-14h2v18h2v-22h2v26h2v-16h2v20h2v-24h2v28h2v-18h2v22h2v-26h2v30h2v-20h2v24h2v-28h2v32h2v-22h2v26h2v-30h2v32h2v-24h2v28h2v-32h2v32h2v-26h2v30h2v-32h2v32h2v-28h2v30h2v-32h2v32h2v-30h2v32h2v-32h2v32h2v-30h2v32h2v-32h2v32"
          stroke="url(#waveformGradient)"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="waveformGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--waveform-secondary))" />
            <stop offset="100%" stopColor="hsl(var(--waveform-primary))" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}