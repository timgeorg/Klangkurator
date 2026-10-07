import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

import { ColorChip } from "@/components/ui/color-chip";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { colorForName } from "@/lib/palette";
import { storage, Tag } from "@/lib/storage";
import { cn } from "@/lib/utils";

interface TagSelectorProps {
  songId: string;
  selectedTags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
  onTagCreated?: () => void;
  /** All tags, when the parent already has them (avoids one request per row). */
  allTags?: Tag[];
  size?: "sm" | "md";
  className?: string;
}

/**
 * Inline tag editing: the song's tags as chips with remove buttons, plus an
 * add button that searches existing tags or creates a new one. The add button
 * shows on row hover and whenever it has keyboard focus.
 */
export function TagSelector({
  songId,
  selectedTags,
  onTagsChange,
  onTagCreated,
  allTags: providedTags,
  size = "sm",
  className,
}: TagSelectorProps) {
  const [ownTags, setOwnTags] = useState<Tag[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const allTags = providedTags ?? ownTags;

  useEffect(() => {
    if (providedTags || !isOpen) return;
    storage.getTags().then(setOwnTags);
  }, [providedTags, isOpen]);

  const createTag = async (name: string): Promise<Tag | null> => {
    const trimmedName = name.trim();
    if (!trimmedName) return null;
    const existing = allTags.find((tag) => tag.name.toLowerCase() === trimmedName.toLowerCase());
    if (existing) return existing;
    const newTag = await storage.addTag({ name: trimmedName, color: colorForName(trimmedName) });
    if (!providedTags) setOwnTags((prev) => [...prev, newTag]);
    onTagCreated?.();
    return newTag;
  };

  const addTag = async (tag: Tag) => {
    if (!selectedTags.find((t) => t.id === tag.id)) {
      onTagsChange([...selectedTags, tag]);
      await storage.addSongTag(songId, tag.id);
    }
    setSearchValue("");
  };

  const removeTag = async (tagId: string) => {
    onTagsChange(selectedTags.filter((t) => t.id !== tagId));
    await storage.removeSongTag(songId, tagId);
  };

  const handleCreateAndAdd = async () => {
    const tag = await createTag(searchValue);
    if (tag) {
      await addTag(tag);
      setIsOpen(false);
    }
  };

  const availableTags = allTags.filter((tag) => !selectedTags.find((s) => s.id === tag.id));
  const filteredTags = searchValue
    ? availableTags.filter((tag) => tag.name.toLowerCase().includes(searchValue.toLowerCase()))
    : availableTags;
  const canCreateNew =
    searchValue.trim() && !allTags.find((tag) => tag.name.toLowerCase() === searchValue.trim().toLowerCase());

  return (
    <div className={cn("flex min-w-0 items-center gap-1", className)}>
      <div className="flex min-w-0 flex-nowrap items-center gap-1">
        {selectedTags.map((tag) => (
          <ColorChip key={tag.id} color={tag.color} label={tag.name} size={size} onRemove={() => removeTag(tag.id)} />
        ))}
      </div>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Add tag"
            title="Add tag"
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-input text-muted-foreground opacity-0 transition-[opacity,color,border-color] duration-fast hover:border-foreground/50 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/row:opacity-100 data-[state=open]:opacity-100",
              size === "sm" ? "h-5 w-5" : "h-6 w-6",
              selectedTags.length === 0 && "group-hover/row:opacity-100",
            )}
          >
            <Plus className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder="Find or create a tag" value={searchValue} onValueChange={setSearchValue} />
            <CommandList>
              <CommandEmpty>
                {canCreateNew ? (
                  <button
                    type="button"
                    onClick={handleCreateAndAdd}
                    className="mx-auto flex items-center gap-2 rounded-sm px-2 py-1 text-[13px] text-foreground hover:bg-accent"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create “{searchValue.trim()}”
                  </button>
                ) : (
                  "No tags yet. Type a name to create one."
                )}
              </CommandEmpty>

              {canCreateNew && filteredTags.length > 0 && (
                <CommandGroup heading="New">
                  <CommandItem onSelect={handleCreateAndAdd}>
                    <Plus className="mr-2 h-3.5 w-3.5" />
                    Create “{searchValue.trim()}”
                  </CommandItem>
                </CommandGroup>
              )}

              {filteredTags.length > 0 && (
                <CommandGroup heading="Tags">
                  {filteredTags.map((tag) => (
                    <CommandItem key={tag.id} value={tag.name} onSelect={() => addTag(tag)}>
                      <span
                        aria-hidden
                        className="mr-2 h-2 w-2 rounded-full ring-1 ring-inset ring-foreground/10"
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
