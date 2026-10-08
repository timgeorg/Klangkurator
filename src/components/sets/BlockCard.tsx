import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Block, Song } from "@/lib/storage";
import { formatDuration, splitTitle } from "@/lib/trackFormat";

import { CoverMosaic } from "./CoverMosaic";
import { plural, totalSeconds } from "./setModel";

interface BlockCardProps {
  block: Block;
  /** The block's tracks, in order, resolved against the library. */
  tracks: Song[];
  /** How many sets use this block. */
  usedIn: number;
  onOpen: () => void;
  onDelete: () => void;
}

/**
 * One block on the Sets page: a strip of its covers, name, the order of its
 * tracks and its length. Lives in a container with container-type: inline-size.
 */
export function BlockCard({ block, tracks, usedIn, onOpen, onDelete }: BlockCardProps) {
  const headingId = `block-${block.id}`;
  const chain = tracks.map((song) => splitTitle(song.title).main).join("  →  ");

  return (
    <article
      aria-labelledby={headingId}
      className="grid gap-x-6 gap-y-3 py-4 [@container_(min-width:36rem)]:grid-cols-[12.5rem_minmax(0,1fr)] [@container_(min-width:52rem)]:grid-cols-[12.5rem_minmax(0,1fr)_auto] [@container_(min-width:52rem)]:items-center"
    >
      <CoverMosaic tracks={tracks} color={block.color} layout="strip" />

      <div className="min-w-0">
        <h3 id={headingId} className="text-[15px] font-semibold leading-snug tracking-[-0.01em]">
          <button
            type="button"
            onClick={onOpen}
            className="rounded-sm text-left underline-offset-[0.2em] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {block.name}
          </button>
        </h3>
        {block.description && <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{block.description}</p>}
        {chain && (
          <p className="mt-0.5 truncate text-[13px] text-foreground/75" title={chain}>
            {chain}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 [@container_(min-width:36rem)]:col-start-2 [@container_(min-width:52rem)]:col-start-3 [@container_(min-width:52rem)]:justify-end">
        <p className="k-num whitespace-nowrap text-xs text-muted-foreground">
          {plural(tracks.length, "track")} · {formatDuration(totalSeconds(tracks))}
          {usedIn > 0 && <> · in {plural(usedIn, "set")}</>}
        </p>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={onOpen}>
            <Pencil />
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} aria-label={`Delete ${block.name}`} title="Delete block">
            <Trash2 />
          </Button>
        </div>
      </div>
    </article>
  );
}
