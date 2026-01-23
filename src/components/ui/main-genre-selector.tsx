import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getGenreConfig, getMainGenreColor } from '@/lib/genreData';
import { X } from 'lucide-react';

interface MainGenreSelectorProps {
  selectedGenre: string | undefined;
  onGenreChange: (genre: string | undefined) => void;
  size?: 'sm' | 'md';
  showClear?: boolean;
}

export function MainGenreSelector({ 
  selectedGenre, 
  onGenreChange, 
  size = 'sm',
  showClear = true 
}: MainGenreSelectorProps) {
  const genreConfig = getGenreConfig();

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onGenreChange(undefined);
  };

  if (selectedGenre) {
    const color = getMainGenreColor(selectedGenre);
    return (
      <div className="flex items-center gap-1">
        <Badge
          variant="secondary"
          className="px-2 py-0.5 flex items-center gap-1"
          style={{ 
            backgroundColor: `${color}20`, 
            borderColor: color,
            color: color
          }}
        >
          <span>{selectedGenre}</span>
          {showClear && (
            <X 
              className="w-3 h-3 cursor-pointer hover:opacity-70"
              onClick={handleClear}
            />
          )}
        </Badge>
      </div>
    );
  }

  return (
    <Select value={selectedGenre || ''} onValueChange={(value) => onGenreChange(value || undefined)}>
      <SelectTrigger className={size === 'sm' ? 'h-7 text-xs' : 'h-9'}>
        <SelectValue placeholder="Select main genre" />
      </SelectTrigger>
      <SelectContent>
        {genreConfig.map((genre) => (
          <SelectItem key={genre.name} value={genre.name}>
            <div className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: genre.color }}
              />
              {genre.name}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
