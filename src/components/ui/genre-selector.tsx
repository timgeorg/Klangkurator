import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GenreSelectorProps {
  selectedGenres: string[];
  onGenresChange: (genres: string[]) => void;
  size?: 'sm' | 'md';
}

const PREDEFINED_GENRES = [
  'House', 'Tech House', 'Deep House', 'Progressive House',
  'Techno', 'Melodic Techno', 'Hard Techno',
  'Trance', 'Progressive Trance', 'Uplifting Trance', 'Speed House',
  'EDM', 'Future Bass', 'Dubstep', 'Drum & Bass',
  'Disco', 'Nu-Disco', 'Funk',
  'Hip Hop', 'R&B', 'Pop', 'Rock', 'Indie',
  'Ambient', 'Downtempo', 'Breaks', 'Electro',
  'Other'
];

const GENRE_COLORS: { [key: string]: string } = {
  'House': '#22c55e',
  'Tech House': '#16a34a',
  'Deep House': '#15803d',
  'Progressive House': '#14532d',
  'Techno': '#8b5cf6',
  'Melodic Techno': '#a78bfa',
  'Hard Techno': '#7c3aed',
  'Trance': '#3b82f6',
  'Progressive Trance': '#60a5fa',
  'Uplifting Trance': '#2563eb',
  'Speed House': '#06b6d4',
  'EDM': '#f97316',
  'Future Bass': '#fb923c',
  'Dubstep': '#ec4899',
  'Drum & Bass': '#d946ef',
  'Disco': '#eab308',
  'Nu-Disco': '#facc15',
  'Funk': '#fbbf24',
  'Hip Hop': '#ef4444',
  'R&B': '#f43f5e',
  'Pop': '#f472b6',
  'Rock': '#64748b',
  'Indie': '#94a3b8',
  'Ambient': '#06b6d4',
  'Downtempo': '#0891b2',
  'Breaks': '#84cc16',
  'Electro': '#a855f7',
  'Other': '#6b7280'
};

const getGenreColor = (genre: string): string => {
  // Check predefined colors first
  if (GENRE_COLORS[genre]) {
    return GENRE_COLORS[genre];
  }
  // Check custom genres from localStorage
  const customGenres = localStorage.getItem('dj_database_custom_genres');
  if (customGenres) {
    const parsed = JSON.parse(customGenres) as { name: string; color: string }[];
    const custom = parsed.find(g => g.name === genre);
    if (custom) return custom.color;
  }
  return '#6366f1';
};

// Get all genres including custom ones
const getAllGenres = (): string[] => {
  const customGenres = localStorage.getItem('dj_database_custom_genres');
  if (customGenres) {
    const parsed = JSON.parse(customGenres) as { name: string; color: string }[];
    const customNames = parsed.map(g => g.name).filter(n => !PREDEFINED_GENRES.includes(n));
    return [...PREDEFINED_GENRES, ...customNames];
  }
  return PREDEFINED_GENRES;
};

export function GenreSelector({ selectedGenres, onGenresChange, size = 'sm' }: GenreSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [customGenres, setCustomGenres] = useState<string[]>([]);

  // Load all genres including custom ones
  const allGenres = [...getAllGenres(), ...customGenres.filter(g => !getAllGenres().includes(g))];

  const addGenre = (genre: string) => {
    if (!selectedGenres.includes(genre)) {
      onGenresChange([...selectedGenres, genre]);
    }
    setSearchValue('');
  };

  const removeGenre = (genre: string) => {
    onGenresChange(selectedGenres.filter(g => g !== genre));
  };

  const handleCreateAndAdd = () => {
    const trimmedName = searchValue.trim();
    if (trimmedName && !allGenres.some(g => g.toLowerCase() === trimmedName.toLowerCase())) {
      setCustomGenres(prev => [...prev, trimmedName]);
      addGenre(trimmedName);
      setIsOpen(false);
    }
  };

  const availableGenres = allGenres.filter(genre => !selectedGenres.includes(genre));

  const filteredGenres = searchValue 
    ? availableGenres.filter(genre => 
        genre.toLowerCase().includes(searchValue.toLowerCase())
      )
    : availableGenres;

  const canCreateNew = searchValue.trim() && 
    !allGenres.some(genre => genre.toLowerCase() === searchValue.trim().toLowerCase());

  return (
    <div className="flex items-center gap-1 min-w-0 flex-wrap">
      {/* Selected Genres */}
      <div className="flex items-center gap-1 min-w-0 flex-wrap">
        {selectedGenres.map((genre) => (
          <Badge
            key={genre}
            variant="secondary"
            className={cn(
              "text-xs flex items-center gap-1 flex-shrink-0",
              selectedGenres.length >= 2 
                ? "px-2 py-1 h-5 text-xs" 
                : size === 'sm' ? "px-1 py-0 h-4 text-[10px]" : "px-2 py-1 h-5"
            )}
            style={{ 
              backgroundColor: `${getGenreColor(genre)}20`, 
              borderColor: getGenreColor(genre),
              color: getGenreColor(genre)
            }}
          >
            <span>{genre}</span>
            <X 
              className={cn(
                "cursor-pointer hover:opacity-70",
                selectedGenres.length >= 2 ? "w-3 h-3" : "w-2 h-2"
              )} 
              onClick={(e) => {
                e.stopPropagation();
                removeGenre(genre);
              }}
            />
          </Badge>
        ))}
      </div>

      {/* Add Genre Button */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "transition-opacity",
              size === 'sm' ? "w-4 h-4 p-0" : "w-5 h-5 p-0"
            )}
          >
            <Plus className="w-3 h-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search or create genres..."
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>
                {canCreateNew && (
                  <div className="p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={handleCreateAndAdd}
                    >
                      <Plus className="w-3 h-3 mr-2" />
                      Create "{searchValue.trim()}"
                    </Button>
                  </div>
                )}
              </CommandEmpty>
              
              {canCreateNew && filteredGenres.length > 0 && (
                <CommandGroup heading="Create New">
                  <CommandItem onSelect={handleCreateAndAdd}>
                    <Plus className="w-3 h-3 mr-2" />
                    Create "{searchValue.trim()}"
                  </CommandItem>
                </CommandGroup>
              )}
              
              {filteredGenres.length > 0 && (
                <CommandGroup heading="Genres">
                  {filteredGenres.map((genre) => (
                    <CommandItem
                      key={genre}
                      value={genre}
                      onSelect={() => addGenre(genre)}
                    >
                      <div 
                        className="w-2 h-2 rounded-full mr-2" 
                        style={{ backgroundColor: getGenreColor(genre) }}
                      />
                      {genre}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export { PREDEFINED_GENRES, getGenreColor };
