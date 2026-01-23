import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSubgenresForMainGenre, getMainGenreColor, addSubgenre } from '@/lib/genreData';

interface SubgenreSelectorProps {
  mainGenre: string | undefined;
  selectedSubgenres: string[];
  onSubgenresChange: (subgenres: string[]) => void;
  size?: 'sm' | 'md';
}

export function SubgenreSelector({ 
  mainGenre, 
  selectedSubgenres, 
  onSubgenresChange, 
  size = 'sm' 
}: SubgenreSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  // Get available subgenres for the main genre
  const availableSubgenres = mainGenre ? getSubgenresForMainGenre(mainGenre) : [];
  const color = mainGenre ? getMainGenreColor(mainGenre) : '#6366f1';

  const addSubgenreToSong = (subgenre: string) => {
    if (!selectedSubgenres.includes(subgenre)) {
      onSubgenresChange([...selectedSubgenres, subgenre]);
    }
    setSearchValue('');
  };

  const removeSubgenre = (subgenre: string) => {
    onSubgenresChange(selectedSubgenres.filter(s => s !== subgenre));
  };

  const handleCreateAndAdd = () => {
    const trimmedName = searchValue.trim();
    if (trimmedName && mainGenre && !availableSubgenres.some(s => s.toLowerCase() === trimmedName.toLowerCase())) {
      // Add to genre config
      addSubgenre(mainGenre, trimmedName);
      addSubgenreToSong(trimmedName);
      setIsOpen(false);
    }
  };

  const filteredSubgenres = availableSubgenres.filter(sub => 
    !selectedSubgenres.includes(sub) &&
    sub.toLowerCase().includes(searchValue.toLowerCase())
  );

  const canCreateNew = searchValue.trim() && 
    !availableSubgenres.some(sub => sub.toLowerCase() === searchValue.trim().toLowerCase());

  if (!mainGenre) {
    return (
      <span className="text-muted-foreground text-xs italic">Select main genre first</span>
    );
  }

  return (
    <div className="flex items-center gap-1 min-w-0 flex-wrap">
      {/* Selected Subgenres */}
      {selectedSubgenres.map((subgenre) => (
        <Badge
          key={subgenre}
          variant="outline"
          className={cn(
            "flex items-center gap-1 flex-shrink-0",
            size === 'sm' ? "px-1.5 py-0 h-5 text-[10px]" : "px-2 py-0.5 h-6 text-xs"
          )}
          style={{ 
            borderColor: `${color}60`,
            color: color
          }}
        >
          <span>{subgenre}</span>
          <X 
            className="w-2.5 h-2.5 cursor-pointer hover:opacity-70"
            onClick={(e) => {
              e.stopPropagation();
              removeSubgenre(subgenre);
            }}
          />
        </Badge>
      ))}

      {/* Add Subgenre Button */}
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
              placeholder={`Search ${mainGenre} subgenres...`}
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
                {!canCreateNew && <span className="text-sm text-muted-foreground p-2">No subgenres found</span>}
              </CommandEmpty>
              
              {canCreateNew && filteredSubgenres.length > 0 && (
                <CommandGroup heading="Create New">
                  <CommandItem onSelect={handleCreateAndAdd}>
                    <Plus className="w-3 h-3 mr-2" />
                    Create "{searchValue.trim()}"
                  </CommandItem>
                </CommandGroup>
              )}
              
              {filteredSubgenres.length > 0 && (
                <CommandGroup heading={`${mainGenre} Subgenres`}>
                  {filteredSubgenres.map((subgenre) => (
                    <CommandItem
                      key={subgenre}
                      value={subgenre}
                      onSelect={() => addSubgenreToSong(subgenre)}
                    >
                      <div 
                        className="w-2 h-2 rounded-full mr-2" 
                        style={{ backgroundColor: `${color}80` }}
                      />
                      {subgenre}
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
