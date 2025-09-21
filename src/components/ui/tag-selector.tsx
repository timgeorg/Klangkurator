import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { storage, Tag } from '@/lib/storage';
import { Plus, X, Tags, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagSelectorProps {
  songId: string;
  selectedTags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
  size?: 'sm' | 'md';
}

const TAG_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef',
  '#ec4899', '#f43f5e'
];

export function TagSelector({ songId, selectedTags, onTagsChange, size = 'sm' }: TagSelectorProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = () => {
    const tags = storage.getTags();
    setAllTags(tags);
  };

  const createTag = (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return null;

    // Check if tag already exists
    const existingTag = allTags.find(tag => 
      tag.name.toLowerCase() === trimmedName.toLowerCase()
    );
    
    if (existingTag) {
      return existingTag;
    }

    // Create new tag with random color
    const randomColor = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
    const newTag = storage.addTag({
      name: trimmedName,
      color: randomColor
    });
    
    setAllTags(prev => [...prev, newTag]);
    return newTag;
  };

  const addTag = (tag: Tag) => {
    if (!selectedTags.find(t => t.id === tag.id)) {
      const newSelectedTags = [...selectedTags, tag];
      onTagsChange(newSelectedTags);
      storage.addSongTag(songId, tag.id);
    }
    setSearchValue('');
  };

  const removeTag = (tagId: string) => {
    const newSelectedTags = selectedTags.filter(t => t.id !== tagId);
    onTagsChange(newSelectedTags);
    storage.removeSongTag(songId, tagId);
  };

  const handleCreateAndAdd = () => {
    const tag = createTag(searchValue);
    if (tag) {
      addTag(tag);
      setIsOpen(false);
    }
  };

  const availableTags = allTags.filter(tag => 
    !selectedTags.find(selected => selected.id === tag.id)
  );

  const filteredTags = searchValue 
    ? availableTags.filter(tag => 
        tag.name.toLowerCase().includes(searchValue.toLowerCase())
      )
    : availableTags;

  const canCreateNew = searchValue.trim() && 
    !allTags.find(tag => tag.name.toLowerCase() === searchValue.trim().toLowerCase());

  return (
    <div className="flex items-center gap-1 min-w-0">
      {/* Selected Tags */}
      <div className="flex flex-wrap gap-1 min-w-0">
        {selectedTags.map((tag) => (
          <Badge
            key={tag.id}
            variant="secondary"
            className={cn(
              "text-xs flex items-center gap-1",
              // Increase size when multiple tags and remove max-width for better visibility
              selectedTags.length >= 2 
                ? "px-2 py-1 h-5 text-xs" 
                : size === 'sm' ? "px-1 py-0 h-4 text-[10px] max-w-20 truncate" : "px-2 py-1 h-5 max-w-20 truncate"
            )}
            style={{ 
              backgroundColor: `${tag.color}20`, 
              borderColor: tag.color,
              color: tag.color 
            }}
          >
            <span className={cn(selectedTags.length >= 2 ? "" : "truncate")}>{tag.name}</span>
            <X 
              className={cn(
                "cursor-pointer hover:opacity-70",
                selectedTags.length >= 2 ? "w-3 h-3" : "w-2 h-2"
              )} 
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag.id);
              }}
            />
          </Badge>
        ))}
      </div>

      {/* Add Tag Button */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "opacity-0 group-hover:opacity-100 transition-opacity",
              size === 'sm' ? "w-4 h-4 p-0" : "w-5 h-5 p-0"
            )}
          >
            <Plus className="w-3 h-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search or create tags..."
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
              
              {canCreateNew && filteredTags.length > 0 && (
                <CommandGroup heading="Create New">
                  <CommandItem onSelect={handleCreateAndAdd}>
                    <Plus className="w-3 h-3 mr-2" />
                    Create "{searchValue.trim()}"
                  </CommandItem>
                </CommandGroup>
              )}
              
              {filteredTags.length > 0 && (
                <CommandGroup heading="Existing Tags">
                  {filteredTags.map((tag) => (
                    <CommandItem
                      key={tag.id}
                      value={tag.name}
                      onSelect={() => addTag(tag)}
                    >
                      <div 
                        className="w-2 h-2 rounded-full mr-2" 
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
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