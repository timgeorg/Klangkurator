import { CoverArt, Shape } from "@/components/brand";
import type { Song } from "@/lib/storage";
import { cn } from "@/lib/utils";

interface CoverMosaicProps {
  tracks: Song[];
  /** The set's or block's colour. */
  color: string;
  /** grid: two by two, for sets. strip: one row of up to five 40px tiles, for blocks. */
  layout: "grid" | "strip";
  className?: string;
}

/**
 * A set or block laid out like a page of the moodboard: one flat tile in the
 * entity's colour carrying a paper shape (a whole disc for a set, a half disc
 * for a block), then black-and-white covers of its first tracks.
 * Decorative; the name beside it carries the meaning.
 */
export function CoverMosaic({ tracks, color, layout, className }: CoverMosaicProps) {
  if (layout === "strip") {
    // Only real covers: a two-track block shows two, not two empty slots.
    return (
      <div aria-hidden className={cn("flex w-max shrink-0 overflow-hidden rounded-md", className)}>
        <EntityTile color={color} shape="half" className="h-10 w-10" />
        {distinct(tracks)
          .slice(0, 4)
          .map((song) => (
            <CoverArt key={song.id} src={song.artwork_url} className="h-10 w-10" iconClassName="h-1/3 w-1/3" />
          ))}
      </div>
    );
  }

  const covers = distinct(tracks).slice(0, 3);
  return (
    <div aria-hidden className={cn("grid aspect-square shrink-0 grid-cols-2 overflow-hidden rounded-md bg-sunken", className)}>
      <EntityTile color={color} shape="circle" className="aspect-square" />
      {[0, 1, 2].map((i) =>
        covers[i] ? (
          <CoverArt key={covers[i].id} src={covers[i].artwork_url} className="aspect-square w-full" iconClassName="h-1/4 w-1/4" />
        ) : (
          <span key={`empty-${i}`} className="aspect-square bg-sunken" />
        ),
      )}
    </div>
  );
}

function distinct(tracks: Song[]): Song[] {
  const seen = new Set<string>();
  return tracks.filter((song) => (seen.has(song.id) ? false : (seen.add(song.id), true)));
}

/**
 * The flat colour tile of a set (whole disc) or block (half disc). Used on
 * its own wherever a block or set needs a small mark: pickers, editor rows.
 */
export function EntityTile({ color, shape, className }: { color: string; shape: "circle" | "half"; className?: string }) {
  return (
    <span aria-hidden className={cn("relative block shrink-0 overflow-hidden", className)} style={{ backgroundColor: color }}>
      {shape === "circle" ? (
        <Shape kind="circle" className="absolute -bottom-[28%] -right-[28%] w-full opacity-95" style={{ color: "var(--k-paper-200)" }} />
      ) : (
        <Shape kind="half" className="absolute -bottom-px left-[12%] w-[76%] opacity-95" style={{ color: "var(--k-paper-200)" }} />
      )}
    </span>
  );
}
