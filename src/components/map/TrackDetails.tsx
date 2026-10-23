// Track map (issue #8) — the selected track's details (plan phase 2, compact
// in the dialog; phase 3 adds the map rail's full variant). Everything here is
// DOM, not canvas, which is what makes the map's selection keyboard-readable
// (REQ-33-AX): cover, title, artist, BPM, key, genre, ratings and tags; the
// nearest tracks under the current weights, each with its similarity as a whole
// percentage; the transitions in and out; and the actions Play, Properties,
// Song page, Show its relationships and — in the dialog, since phase 7 — Open
// in map.
import { Link } from "react-router-dom";
import { Map as MapIcon, Pause, Pencil, Play, Share2 } from "lucide-react";

import { CoverArt } from "@/components/brand";
import { RelationLine } from "@/components/detail/RelationLine";
import { Button } from "@/components/ui/button";
import { ColorChip } from "@/components/ui/color-chip";
import { getMainGenreColor } from "@/lib/genreData";
import { relationshipPhrase } from "@/lib/relationshipStyle";
import type { Song, Tag } from "@/lib/storage";
import { formatBpm, keyName, trackGenre } from "@/lib/trackFormat";
import type { TransitionEdge } from "@/lib/trackMap/transitions";
import { cn } from "@/lib/utils";

/** One of the selected track's relationship partners, as the details list it. */
export interface PartnerRow {
  id: string;
  song: Song;
  type: string;
  direction: "source" | "target";
  notes?: string;
}

/** One of the selected track's nearest tracks, with its composite similarity. */
export interface NearestRow {
  song: Song;
  /** The pair's similarity, 0–1; shown as a whole percentage. */
  s: number;
}

interface TrackDetailsProps {
  song: Song;
  /** compact: the dialog's narrower column. full: the map rail (phase 3). */
  variant?: "compact" | "full";
  /** The selected track's tags, for the tag chips. */
  tags?: Tag[];
  /** The relationship partners; shown when given (the dialog) — no nearest tracks there. */
  partners?: PartnerRow[];
  /** The nearest tracks; shown when given (the map rail). */
  nearest?: NearestRow[];
  /** The transition facts; the details split them into in and out for the song. */
  transitions?: TransitionEdge[];
  /** Resolves the other end of a transition to its track, for the list. */
  songById?: Map<string, Song>;
  /** The song is the one that is playing, so Play pauses and resumes. */
  isPlaying?: boolean;
  /** Play, or pause and resume when already playing: a run of one. */
  onPlay?: (song: Song) => void;
  /** Opens the Edit dialog for the song. */
  onProperties?: (song: Song) => void;
  /** Song page: navigates to `/song/:id`; given this, it may also close a host dialog. */
  onSongPage?: (song: Song) => void;
  /** Show its relationships: re-centres (dialog) or cores the map (phase 4b). */
  onShowRelationships?: (song: Song) => void;
  /**
   * Open in map: continues into the full map with the core as in TM-H1
   * (phase 7, TM-E3). No argument: the target is the dialog's own song, not
   * whichever track the details are showing.
   */
  onOpenInMap?: () => void;
  /** A list entry selects that track. */
  onSelect?: (id: string) => void;
  className?: string;
}

/** A 0–5 rating with one decimal, "Unrated" when 0. */
const formatRating = (value?: number): string => (value ? String(Number(value.toFixed(1))) : "Unrated");

/** A whole percentage for a similarity (0.888 → "89%"). */
const formatSimilarity = (s: number): string => `${Math.round(s * 100)}%`;

/**
 * The selected track's details beside the map, compact in the dialog and full
 * in the map rail. The compact variant is the dialog's lean column: cover,
 * title, artist, the partner list, the transitions and the actions. The full
 * variant (the map rail, phase 3) adds BPM, key, genre, ratings and tags, and
 * takes the nearest tracks. Each list appears only when its data is given, and
 * each entry selects that track. Actions: Play (a run of one), Properties
 * (given an Edit handler), Song page, Show its relationships and Open in map
 * (the dialog's way onto the full map, phase 7, TM-E3).
 */
export function TrackDetails({
  song,
  variant = "compact",
  tags = [],
  partners,
  nearest,
  transitions,
  songById,
  isPlaying = false,
  onPlay,
  onProperties,
  onSongPage,
  onShowRelationships,
  onOpenInMap,
  onSelect,
  className,
}: TrackDetailsProps) {
  const genre = trackGenre(song);
  const full = variant === "full";
  const coverSize = full ? "h-24 w-24" : "h-14 w-14";

  const outgoing = (transitions ?? []).filter((edge) => edge.source === song.id);
  const incoming = (transitions ?? []).filter((edge) => edge.target === song.id);
  const otherSong = (id: string): Song | undefined => songById?.get(id);
  const selectable = (id: string) => (onSelect ? { onClick: () => onSelect(id) } : {});

  const rowClass =
    "flex w-full min-w-0 items-center gap-3 rounded-md p-1 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className={cn("space-y-5", className)}>
      <div className="flex items-start gap-3">
        <CoverArt src={song.artwork_url} current={isPlaying} className={cn("rounded-lg", coverSize)} />
        <div className="min-w-0 flex-1">
          <h3 className={cn("truncate font-semibold", full ? "text-[15px]" : "text-[13px]")}>{song.title}</h3>
          <p className="truncate text-[13px] text-muted-foreground">{song.artist}</p>
          {full && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="k-num">
                <span className="k-label mr-1.5 text-muted-foreground">BPM</span>
                {formatBpm(song.bpm)}
              </span>
              <span className="k-num">
                <span className="k-label mr-1.5 text-muted-foreground">KEY</span>
                {song.musical_key || "–"}
                {song.musical_key && keyName(song.musical_key) !== song.musical_key && (
                  <span className="ml-1 font-sans text-muted-foreground">{keyName(song.musical_key)}</span>
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      {full && (
        <>
          <div className="space-y-2">
            {genre && (
              <div className="flex flex-wrap items-center gap-1.5">
                <ColorChip size="md" color={getMainGenreColor(genre)} label={genre} />
                {song.subgenres?.map((subgenre) => (
                  <ColorChip key={subgenre} size="md" color={getMainGenreColor(genre)} label={subgenre} />
                ))}
              </div>
            )}
            {tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {tags.map((tag) => (
                  <ColorChip key={tag.id} color={tag.color} label={tag.name} />
                ))}
              </div>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            {(
              [
                ["Energy", song.energy],
                ["People", song.people ?? 0],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="k-label text-muted-foreground">{label}</dt>
                <dd className="k-num mt-1.5 text-[13px]">{formatRating(value)}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      {Boolean(onPlay || onProperties || onShowRelationships || onSongPage || onOpenInMap) && (
        <div className="flex flex-wrap gap-2">
          {onPlay && (
            <Button size="sm" onClick={() => onPlay(song)}>
              {isPlaying ? <Pause /> : <Play />}
              {isPlaying ? "Pause" : "Play"}
            </Button>
          )}
          {onProperties && (
            <Button variant="outline" size="sm" onClick={() => onProperties(song)}>
              <Pencil />
              Properties
            </Button>
          )}
          {onSongPage ? (
            <Button variant="outline" size="sm" onClick={() => onSongPage(song)}>
              Song page
            </Button>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/song/${song.id}`}>Song page</Link>
            </Button>
          )}
          {onShowRelationships && (
            <Button variant="outline" size="sm" onClick={() => onShowRelationships(song)}>
              <Share2 />
              Show its relationships
            </Button>
          )}
          {onOpenInMap && (
            <Button variant="outline" size="sm" onClick={onOpenInMap}>
              <MapIcon />
              Open in map
            </Button>
          )}
        </div>
      )}

      {partners && partners.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-[13px] font-semibold">Relationship partners</h4>
          <ul className="divide-y divide-border/70 border-y border-border/70">
            {partners.map((partner) => (
              <li key={partner.id}>
                <button type="button" {...selectable(partner.song.id)} aria-label={`Select ${partner.song.title}`} className={rowClass}>
                  <CoverArt src={partner.song.artwork_url} className="h-8 w-8 rounded-[3px]" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <RelationLine type={partner.type} />
                      {relationshipPhrase(partner.type, partner.direction)}
                    </span>
                    <span className="block truncate text-[13px] font-medium">{partner.song.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {partner.song.artist}
                      {partner.notes ? ` · ${partner.notes}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {nearest && nearest.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-[13px] font-semibold">Nearest tracks</h4>
          <ul className="divide-y divide-border/70 border-y border-border/70">
            {nearest.map((entry) => (
              <li key={entry.song.id}>
                <button type="button" {...selectable(entry.song.id)} aria-label={`Select ${entry.song.title}`} className={rowClass}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{entry.song.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{entry.song.artist}</span>
                  </span>
                  <span className="k-num shrink-0 text-[13px] text-muted-foreground">{formatSimilarity(entry.s)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(outgoing.length > 0 || incoming.length > 0) && (
        <section className="space-y-2">
          <h4 className="text-[13px] font-semibold">Transitions</h4>
          <ul className="divide-y divide-border/70 border-y border-border/70">
            {[...outgoing, ...incoming].map((edge) => {
              const out = edge.source === song.id;
              const otherId = out ? edge.target : edge.source;
              const other = otherSong(otherId);
              const sources = edge.sources.map((source) => source.name ?? source.kind).join(", ");
              const notes = edge.sources.flatMap((source) => source.notes);
              return (
                <li key={`${edge.source}\u0000${edge.target}`}>
                  <button
                    type="button"
                    {...selectable(otherId)}
                    aria-label={`Select ${other?.title ?? "the other track"}`}
                    className={cn(rowClass, "flex-col items-start gap-1")}
                  >
                    <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                      <RelationLine type="transition" />
                      {out ? "Transitions into" : "Transitioned from"}
                    </span>
                    <span className="block w-full truncate text-[13px] font-medium">{other?.title ?? otherId}</span>
                    {other && <span className="block w-full truncate text-xs text-muted-foreground">{other.artist}</span>}
                    {sources && <span className="block w-full truncate text-xs text-muted-foreground">{sources}</span>}
                    {notes.map((note) => (
                      <span key={note} className="block w-full text-xs text-foreground/80">
                        {note}
                      </span>
                    ))}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
