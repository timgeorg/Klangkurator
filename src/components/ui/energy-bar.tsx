import React from 'react';
import { cn } from '@/lib/utils';

interface EnergyBarProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  vertical?: boolean;
}

const sizes = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

const verticalSizes = {
  sm: 'w-1 h-16',
  md: 'w-2 h-20',
  lg: 'w-3 h-24',
};

export function EnergyBar({ 
  value, 
  max = 5, 
  size = 'md', 
  showValue = false,
  vertical = false 
}: EnergyBarProps) {
  const percentage = Math.min((value / max) * 100, 100);
  
  const getEnergyColor = (percent: number) => {
    if (percent <= 30) return 'bg-energy-low';
    if (percent <= 70) return 'bg-energy-medium';
    return 'bg-energy-high';
  };

  return (
    <div className={cn(
      "flex items-center gap-2",
      vertical && "flex-col-reverse"
    )}>
      <div className={cn(
        "bg-muted rounded-full overflow-hidden",
        vertical ? verticalSizes[size] : cn("w-16", sizes[size])
      )}>
        <div
          className={cn(
            "transition-all duration-500 ease-out rounded-full",
            getEnergyColor(percentage),
            vertical ? "w-full transition-height" : "h-full transition-width"
          )}
          style={
            vertical 
              ? { height: `${percentage}%` }
              : { width: `${percentage}%` }
          }
        />
      </div>
      {showValue && (
        <span className="text-xs font-medium text-muted-foreground min-w-[1.5rem]">
          {value}/{max}
        </span>
      )}
    </div>
  );
}