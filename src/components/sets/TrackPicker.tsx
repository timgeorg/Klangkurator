import { useMemo, useState } from "react";

import { CoverArt } from "@/components/brand";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Block, Song } from "@/lib/storage";
import { formatBpm } from "@/lib/trackFormat";
import { TrackTitle } from "@/components/dj/TrackTitle";

import { EntityTile } from "./CoverMosaic";
import { plural } from "./setModel";

/** Rendering every track of a large library would stall the popover; typing narrows it. */
const SONG_LIMIT = 50;

interface TrackPickerProps {
  /** Tracks that can be added (already-added ones left out by the caller). */
  songs: Song[];
  /** Tracks and blocks already in the running order, so a search for one can say so. */
  alreadyAdded?: Song[];
  alreadyAddedBlocks?: Block[];
  /** Blocks that can be added; omit for tracks only. */
  blocks?: Block[];
  onPickSong: (song: Song) => void;
  onPickBlock?: (block: Block) => void;
  /** Stay open to add several in a row (running order) or close after one pick. */
  closeOnPick?: boolean;
  placeholder: string;
  /** The trigger button. */
  children: React.ReactNode;
  align?: "start" | "center" | "end";
}

/**
 * Search the library and add a track (or a block) to a running order.
 * Matches title, artist and album; blocks match by name.
 */
export function TrackPicker({
  songs,
  alreadyAdded = [],
  alreadyAddedBlocks = [],
  blocks = [],
  onPickSong,
  onPickBlock,
  closeOnPick = false,
  placeholder,
  children,
  align = "end",
}: TrackPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const matchedBlocks = useMemo(() => (q ? blocks.filter((b) => b.name.toLowerCase().includes(q)) : blocks), [blocks, q]);
  const matchedSongs = useMemo(
    () => (q ? songs.filter((s) => `${s.title} ${s.artist} ${s.album ?? ""}`.toLowerCase().includes(q)) : songs),
    [songs, q],
  );
  const shownSongs = matchedSongs.slice(0, SONG_LIMIT);
  const addedMatch = q
    ? (alreadyAdded.find((s) => `${s.title} ${s.artist}`.toLowerCase().includes(q))?.title ??
      alreadyAddedBlocks.find((b) => b.name.toLowerCase().includes(q))?.name)
    : undefined;

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery("");
  };

  const after = () => {
    if (closeOnPick) onOpenChange(false);
  };

  return (
    <Popover modal open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} aria-label={placeholder} className="w-[min(26rem,calc(100vw-2rem))] p-0">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder={placeholder} />
          <CommandList className="max-h-[min(22rem,50vh)]">
            <CommandEmpty>
              {!q
                ? "Everything is already in the running order."
                : addedMatch
                  ? `“${addedMatch}” is already in the running order.`
                  : `Nothing in the library matches “${query.trim()}”.`}
            </CommandEmpty>

            {onPickBlock && matchedBlocks.length > 0 && (
              <CommandGroup heading="Blocks">
                {matchedBlocks.map((block) => (
                  <CommandItem
                    key={block.id}
                    value={`block:${block.id}`}
                    onSelect={() => {
                      onPickBlock(block);
                      after();
                    }}
                    className="gap-3"
                  >
                    <EntityTile color={block.color} shape="half" className="h-8 w-8 rounded-[3px]" />
                    <span className="min-w-0 flex-1 truncate font-medium">{block.name}</span>
                    <span className="k-num shrink-0 text-[11px] text-muted-foreground">{plural(block.songs.length, "track")}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {shownSongs.length > 0 && (
              <CommandGroup heading={onPickBlock ? "Tracks" : undefined}>
                {shownSongs.map((song) => (
                  <CommandItem
                    key={song.id}
                    value={song.id}
                    onSelect={() => {
                      onPickSong(song);
                      after();
                    }}
                    className="gap-3"
                  >
                    <CoverArt src={song.artwork_url} className="h-8 w-8 rounded-[3px]" />
                    <span className="min-w-0 flex-1">
                      <TrackTitle title={song.title} className="block font-medium" />
                      <span className="block truncate text-xs text-muted-foreground">{song.artist}</span>
                    </span>
                    <span className="k-num shrink-0 text-[11px] text-muted-foreground">
                      {formatBpm(song.bpm)}
                      {song.musical_key ? ` · ${song.musical_key}` : ""}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {matchedSongs.length > SONG_LIMIT && (
              <p className="border-t border-border px-3 py-2.5 text-xs text-muted-foreground">
                Showing {SONG_LIMIT} of {matchedSongs.length} tracks. Type to narrow the list.
              </p>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
