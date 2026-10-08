import { useState } from "react";
import { Plus } from "lucide-react";

import { ColorChip } from "@/components/ui/color-chip";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addSubgenre, getMainGenreColor, getSubgenresForMainGenre } from "@/lib/genreData";
import { cn } from "@/lib/utils";

interface SubgenreSelectorProps {
  mainGenre: string | undefined;
  selectedSubgenres: string[];
  onSubgenresChange: (subgenres: string[]) => void;
  size?: "sm" | "md";
}

/**
 * Subgenres of the chosen main genre as chips in its colour. New names are
 * added to the song and to the genre's list (SEL-2).
 */
export function SubgenreSelector({ mainGenre, selectedSubgenres, onSubgenresChange, size = "sm" }: SubgenreSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  if (!mainGenre) {
    return <p className="text-xs text-muted-foreground">Choose a main genre first.</p>;
  }

  const available = getSubgenresForMainGenre(mainGenre);
  const color = getMainGenreColor(mainGenre);

  const add = (subgenre: string) => {
    if (!selectedSubgenres.includes(subgenre)) onSubgenresChange([...selectedSubgenres, subgenre]);
    setSearchValue("");
  };

  const remove = (subgenre: string) => onSubgenresChange(selectedSubgenres.filter((s) => s !== subgenre));

  const createAndAdd = () => {
    const name = searchValue.trim();
    if (name && !available.some((s) => s.toLowerCase() === name.toLowerCase())) {
      addSubgenre(mainGenre, name);
      add(name);
      setIsOpen(false);
    }
  };

  const filtered = available.filter(
    (sub) => !selectedSubgenres.includes(sub) && sub.toLowerCase().includes(searchValue.toLowerCase()),
  );
  const canCreate = searchValue.trim() && !available.some((s) => s.toLowerCase() === searchValue.trim().toLowerCase());

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {selectedSubgenres.map((subgenre) => (
        <ColorChip key={subgenre} size={size} color={color} label={subgenre} onRemove={() => remove(subgenre)} />
      ))}

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Add a subgenre"
            title="Add a subgenre"
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1 rounded-chip border border-dashed border-input text-muted-foreground transition-colors hover:border-foreground/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              size === "sm" ? "h-5 px-1.5 text-[11px]" : "h-6 px-2 text-xs",
            )}
          >
            <Plus className="h-3 w-3" />
            {selectedSubgenres.length === 0 && <span>Add</span>}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder={`${mainGenre} subgenres`} value={searchValue} onValueChange={setSearchValue} />
            <CommandList>
              <CommandEmpty>
                {canCreate ? (
                  <button
                    type="button"
                    onClick={createAndAdd}
                    className="mx-auto flex items-center gap-2 rounded-sm px-2 py-1 text-[13px] text-foreground hover:bg-accent"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create “{searchValue.trim()}”
                  </button>
                ) : (
                  "No subgenre matches."
                )}
              </CommandEmpty>

              {canCreate && filtered.length > 0 && (
                <CommandGroup heading="New">
                  <CommandItem onSelect={createAndAdd}>
                    <Plus className="mr-2 h-3.5 w-3.5" />
                    Create “{searchValue.trim()}”
                  </CommandItem>
                </CommandGroup>
              )}

              {filtered.length > 0 && (
                <CommandGroup heading={mainGenre}>
                  {filtered.map((subgenre) => (
                    <CommandItem key={subgenre} value={subgenre} onSelect={() => add(subgenre)}>
                      <span aria-hidden className="mr-2 h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
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
