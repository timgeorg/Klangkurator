import { Pencil, Trash2 } from "lucide-react";

import { Shape } from "@/components/brand";
import { Button } from "@/components/ui/button";
import type { DJSet } from "@/lib/storage";
import { formatDuration, formatTotal, splitTitle } from "@/lib/trackFormat";
import { cn } from "@/lib/utils";

import { CoverMosaic } from "./CoverMosaic";
import { plural, totalSeconds, tracksOf, type ResolvedItem } from "./setModel";

const PREVIEW_ROWS = 6;

interface SetCardProps {
  set: DJSet;
  /** The set's items, in order, resolved against the library. */
  items: ResolvedItem[];
  onOpen: () => void;
  onDelete: () => void;
}

/**
 * One set on the Sets page, laid out like a contents page: the mosaic, the
 * name in the serif, its totals, and the start of the running order.
 * Lives in a container with container-type: inline-size.
 */
export function SetCard({ set, items, onOpen, onDelete }: SetCardProps) {
  const tracks = tracksOf(items);
  const seconds = totalSeconds(tracks);
  const target = (set.target_duration_min ?? 0) * 60;
  const headingId = `set-${set.id}`;

  return (
    <article
      aria-labelledby={headingId}
      className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-5 gap-y-6 py-7 [@container_(min-width:34rem)]:grid-cols-[9rem_minmax(0,1fr)] [@container_(min-width:34rem)]:gap-x-8 [@container_(min-width:56rem)]:grid-cols-[10rem_minmax(0,0.8fr)_minmax(0,1.2fr)]"
    >
      <CoverMosaic tracks={tracks} color={set.color} layout="grid" className="w-full" />

      <div className="flex min-w-0 flex-col">
        <h3 id={headingId} className="k-headline">
          <button
            type="button"
            onClick={onOpen}
            className="rounded-sm text-left underline-offset-[0.18em] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {set.name}
          </button>
        </h3>
        {set.description && (
          <p className="mt-2 line-clamp-3 max-w-[52ch] text-sm leading-relaxed text-muted-foreground">{set.description}</p>
        )}
        <p className="k-num mt-3 text-xs text-muted-foreground">
          {plural(tracks.length, "track")} · {formatTotal(seconds)}
          {target > 0 && <> of {formatTotal(target)}</>}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-5">
          <Button variant="outline" size="sm" onClick={onOpen}>
            <Pencil />
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} aria-label={`Delete ${set.name}`} title="Delete set">
            <Trash2 />
          </Button>
        </div>
      </div>

      <RunningOrderPreview
        items={items}
        className="col-span-2 [@container_(min-width:56rem)]:col-span-1"
      />
    </article>
  );
}

function RunningOrderPreview({ items, className }: { items: ResolvedItem[]; className?: string }) {
  if (items.length === 0) {
    return <p className={cn("self-center text-[13px] text-muted-foreground", className)}>The running order is empty.</p>;
  }
  const shown = items.slice(0, PREVIEW_ROWS);
  const rest = items.length - shown.length;

  return (
    <div className={className}>
      <ol aria-label="Running order" className="border-t border-border">
        {shown.map((entry, index) => (
          <li
            key={entry.item.id}
            className="grid h-10 grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/70 text-[13px]"
          >
            <span className="k-num text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
            <EntryTitle entry={entry} />
            <span className="k-num text-xs text-muted-foreground">
              {entry.kind === "song"
                ? formatDuration(entry.song.duration)
                : entry.kind === "block"
                  ? formatDuration(totalSeconds(entry.tracks))
                  : "--:--"}
            </span>
          </li>
        ))}
      </ol>
      {rest > 0 && <p className="k-num mt-2.5 text-xs text-muted-foreground">+ {plural(rest, "more item")}</p>}
    </div>
  );
}

function EntryTitle({ entry }: { entry: ResolvedItem }) {
  if (entry.kind === "song") {
    return (
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="truncate font-medium">{splitTitle(entry.song.title).main}</span>
        <span className="hidden min-w-0 shrink-[2] truncate text-muted-foreground sm:inline">{entry.song.artist}</span>
      </span>
    );
  }
  if (entry.kind === "block") {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <Shape kind="half" className="w-3" style={{ color: entry.block.color }} />
        <span className="truncate font-medium">{entry.block.name}</span>
        <span className="shrink-0 text-muted-foreground">{plural(entry.tracks.length, "track")}</span>
      </span>
    );
  }
  return (
    <span className="truncate italic text-muted-foreground">
      {entry.item.type === "block" ? "Deleted block" : "Track no longer in the library"}
    </span>
  );
}
