import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RatingProps {
  value: number;
  onChange?: (value: number) => void;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  readonly?: boolean;
  variant?: 'default' | 'energy' | 'danceability' | 'social';
}

const variantColors = {
  default: 'text-primary',
  energy: 'text-energy-high',
  danceability: 'text-accent',
  social: 'text-secondary',
};

const sizes = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export function Rating({ 
  value, 
  onChange, 
  max = 5, 
  size = 'md', 
  readonly = false,
  variant = 'default' 
}: RatingProps) {
  const handleClick = (rating: number) => {
    if (!readonly && onChange) {
      onChange(rating);
    }
  };

  return (
    <div className="flex gap-1">
      {Array.from({ length: max }, (_, i) => i + 1).map((rating) => (
        <button
          key={rating}
          onClick={() => handleClick(rating)}
          disabled={readonly}
          className={cn(
            "transition-all duration-200",
            !readonly && "hover:scale-110",
            readonly && "cursor-default"
          )}
        >
          <Star
            className={cn(
              sizes[size],
              rating <= value 
                ? cn("fill-current", variantColors[variant])
                : "text-muted-foreground",
              "transition-colors duration-200"
            )}
          />
        </button>
      ))}
    </div>
  );
}