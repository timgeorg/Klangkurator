import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getGenreConfig, getMainGenreColor } from "@/lib/genreData";
import { cn } from "@/lib/utils";

interface MainGenreSelectorProps {
  selectedGenre: string | undefined;
  onGenreChange: (genre: string | undefined) => void;
  size?: "sm" | "md";
  showClear?: boolean;
}

/** Choose a track's main genre; the genre's colour shows as a dot. Can be changed or cleared directly. */
export function MainGenreSelector({ selectedGenre, onGenreChange, size = "sm", showClear = true }: MainGenreSelectorProps) {
  const genres = getGenreConfig();
  // A legacy genre name from file tags may not be in the configured list; keep it selectable.
  const options =
    selectedGenre && !genres.some((g) => g.name === selectedGenre)
      ? [{ name: selectedGenre, color: getMainGenreColor(selectedGenre), subgenres: [] }, ...genres]
      : genres;

  return (
    <div className="flex items-center gap-1">
      <Select value={selectedGenre ?? ""} onValueChange={(value) => onGenreChange(value || undefined)}>
        <SelectTrigger aria-label="Main genre" className={cn(size === "sm" && "h-7 text-xs")}>
          <SelectValue placeholder="Choose a genre" />
        </SelectTrigger>
        <SelectContent>
          {options.map((genre) => (
            <SelectItem key={genre.name} value={genre.name}>
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full ring-1 ring-inset ring-foreground/10"
                  style={{ backgroundColor: genre.color }}
                />
                {genre.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedGenre && showClear && (
        <Button variant="ghost" size="icon-sm" onClick={() => onGenreChange(undefined)} aria-label="Clear the main genre" title="Clear">
          <X />
        </Button>
      )}
    </div>
  );
}
