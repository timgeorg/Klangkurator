// Track map (issue #35) — the node hover popover. A DOM element, not canvas
// paint: it stays on-brand (the design system's own tokens and type), it is
// readable by assistive tech, and it can carry chips and colours that canvas
// text cannot. It appears instantly — Tim asked for "instant tooltip" — and it
// is not wired on touch devices (the page decides, from `useIsMobile`).
import { CoverArt } from "@/components/brand";
import { ColorChip } from "@/components/ui/color-chip";
import type { Song, Tag } from "@/lib/storage";
import { formatBpm, formatDuration, keyName } from "@/lib/trackFormat";

/** How far the popover stands off the node, in pixels. */
const OFFSET_PX = 14;
/** Its width; long titles wrap rather than widen the popover. */
const WIDTH_PX = 240;

interface TrackHoverPopoverProps {
  song: Song;
  tags: Tag[];
  /** The node's screen point, in the page's own coordinates. */
  x: number;
  y: number;
  /** The bounds the popover must stay inside (the canvas container). */
  bounds: { width: number; height: number };
}

/**
 * The full artist, title, BPM, tags and duration — everything the trimmed
 * canvas label cannot show. Positioned beside the node and flipped near an edge,
 * so it never runs off the canvas.
 */
export function TrackHoverPopover({ song, tags, x, y, bounds }: TrackHoverPopoverProps) {
  const flipX = x + OFFSET_PX + WIDTH_PX > bounds.width;
  const flipY = y + OFFSET_PX + 120 > bounds.height;
  const left = flipX ? x - OFFSET_PX - WIDTH_PX : x + OFFSET_PX;
  const top = flipY ? undefined : y + OFFSET_PX;
  const bottom = flipY ? bounds.height - y + OFFSET_PX : undefined;

  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-20 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-2"
      style={{ left, top, bottom, width: WIDTH_PX }}
    >
      <div className="flex gap-3">
        <CoverArt src={song.artwork_url} className="h-10 w-10 rounded-chip" />
        <div className="min-w-0">
          {/* The full title and artist, wrapped and never trimmed. */}
          <p className="text-[13px] font-semibold leading-snug">{song.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{song.artist}</p>
        </div>
      </div>

      <dl className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <div className="flex items-center gap-1">
          <dt className="sr-only">BPM</dt>
          <dd className="k-num text-muted-foreground">{formatBpm(song.bpm) || "–"}</dd>
        </div>
        <div className="flex items-center gap-1">
          <dt className="sr-only">Key</dt>
          <dd className="text-muted-foreground">{song.musical_key ? keyName(song.musical_key) : "–"}</dd>
        </div>
        <div className="flex items-center gap-1">
          <dt className="sr-only">Duration</dt>
          <dd className="k-num text-muted-foreground">{formatDuration(song.duration) || "–"}</dd>
        </div>
      </dl>

      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map((tag) => (
            <ColorChip key={tag.id} color={tag.color} label={tag.name} size="sm" />
          ))}
        </div>
      )}
    </div>
  );
}
