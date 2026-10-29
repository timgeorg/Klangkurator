import { memo } from "react";
import { Link } from "react-router-dom";
import { Pause, Pencil, Play } from "lucide-react";

import { CoverArt } from "@/components/brand";
import { TagSelector } from "@/components/ui/tag-selector";
import { Waveform } from "@/components/ui/waveform";
import { Song, Tag } from "@/lib/storage";
import { BPM_RANGE, crateOf, formatBpm, formatDuration, parseBpm, splitTitle } from "@/lib/trackFormat";
import { cn } from "@/lib/utils";

import { GenreCell, KeyCell, LyricsCell, PatchSong, RatingCell, SubgenresCell, TextCell } from "./InlineCells";
import { NUMERIC_COLUMNS } from "./libraryTable";

interface SongTableRowProps {
  song: Song;
  index: number;
  songTags: Tag[];
  allTags: Tag[];
  visibleColumns: string[];
  gridTemplate: string;
  /** The loaded track (playing or paused): carries the orange cut. */
  isCurrent: boolean;
  isPlaying: boolean;
  onPlaySong: (song: Song) => void;
  onEditSong: (song: Song) => void;
  onTagsChange: (songId: string, tags: Tag[]) => void;
  onTagCreated: () => void;
  /** Saves an inline edit at once. */
  onPatch: PatchSong;
  onOpenLyrics: (song: Song) => void;
}

/** The other notes, shown as a hint while the mixing note (the editable one) is empty. */
const otherNote = (song: Song) =>
  song.drum_notes ? `Drums: ${song.drum_notes}` : song.element_notes ? `Elements: ${song.element_notes}` : "";

const requireArtist = (draft: string) =>
  draft.trim() ? { value: draft.trim() } : { error: "A track needs an artist." };

const checkBpm = (draft: string) => {
  const bpm = parseBpm(draft);
  return bpm === undefined
    ? { error: `BPM is a number from ${BPM_RANGE.min} to ${BPM_RANGE.max}, like 127.5.` }
    : { value: bpm === null ? "" : String(bpm) };
};

function SongTableRowImpl({
  song,
  index,
  songTags,
  allTags,
  visibleColumns,
  gridTemplate,
  isCurrent,
  isPlaying,
  onPlaySong,
  onEditSong,
  onTagsChange,
  onTagCreated,
  onPatch,
  onOpenLyrics,
}: SongTableRowProps) {
  const renderCell = (columnId: string) => {
    switch (columnId) {
      case "play":
        return (
          <div className="relative flex h-full w-full items-center justify-center">
            <span
              className={cn(
                "k-num pointer-events-none text-xs transition-opacity duration-fast group-hover/row:opacity-0 group-has-[:focus-visible]/row:opacity-0",
                isCurrent ? "text-signal-text" : "text-muted-foreground",
              )}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="absolute inset-0 flex items-center justify-center gap-0.5 opacity-0 transition-opacity duration-fast group-hover/row:opacity-100 group-has-[:focus-visible]/row:opacity-100">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlaySong(song);
                }}
                aria-label={isCurrent && isPlaying ? `Pause ${song.title}` : `Play ${song.title}`}
                title={isCurrent && isPlaying ? "Pause" : "Play"}
                className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-foreground transition-colors hover:bg-accent hover:text-signal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {isCurrent && isPlaying ? (
                  <Pause className="h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
                ) : (
                  <Play className="h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
                )}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditSong(song);
                }}
                aria-label={`Edit ${song.title}`}
                title="Edit"
                className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );

      case "cover":
        return <CoverArt src={song.artwork_url} current={isCurrent} className="h-8 w-8 rounded-[3px]" />;

      case "preview":
        return <Waveform variant="compact" peaks={song.waveform_peaks} active={isCurrent} className="h-6 w-full" />;

      case "title": {
        const { main, version } = splitTitle(song.title);
        return (
          <Link
            to={`/song/${song.id}`}
            title={song.title}
            className={cn(
              "min-w-0 truncate rounded-sm font-medium transition-colors hover:text-signal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isCurrent ? "text-signal-text" : "text-foreground",
            )}
          >
            {main}
            {version && <span className="font-normal text-muted-foreground"> {version}</span>}
          </Link>
        );
      }

      case "artist":
        return (
          <TextCell
            field="Artist"
            track={song.title}
            value={song.artist}
            title={song.artist}
            parse={requireArtist}
            onCommit={(artist) => onPatch(song.id, { artist })}
          >
            <span className="truncate text-foreground/85">{song.artist}</span>
          </TextCell>
        );

      case "album":
        return (
          <TextCell
            field="Album"
            track={song.title}
            value={song.album ?? ""}
            title={song.album || undefined}
            onCommit={(album) => onPatch(song.id, { album: album || null })}
          >
            <span className="truncate text-muted-foreground">{song.album || "–"}</span>
          </TextCell>
        );

      case "rootFolder": {
        const crate = crateOf(song);
        return (
          <span className="truncate text-muted-foreground" title={song.file_path}>
            {crate || "–"}
          </span>
        );
      }

      case "bpm":
        return (
          <TextCell
            field="BPM"
            track={song.title}
            value={song.bpm ? formatBpm(song.bpm) : ""}
            align="end"
            inputMode="decimal"
            className="k-num text-xs"
            parse={checkBpm}
            onCommit={(bpm) => onPatch(song.id, { bpm: bpm ? Number(bpm) : null })}
          >
            <span className={song.bpm ? "text-foreground/85" : "text-muted-foreground"}>{formatBpm(song.bpm)}</span>
          </TextCell>
        );

      case "key":
        return <KeyCell song={song} onPatch={onPatch} />;

      case "genre":
        return <GenreCell song={song} onPatch={onPatch} />;

      case "subgenres":
        return <SubgenresCell song={song} onPatch={onPatch} />;

      case "energy":
        return (
          <RatingCell field="Energy" track={song.title} value={song.energy} onChange={(energy) => onPatch(song.id, { energy })} />
        );

      case "people":
        return (
          <RatingCell
            field="People"
            track={song.title}
            value={song.people ?? 0}
            onChange={(people) => onPatch(song.id, { people })}
          />
        );

      case "rank":
        return (
          <RatingCell
            stars
            field="Rank"
            track={song.title}
            value={song.rank ?? 0}
            emptyText="Unranked"
            onChange={(rank) => onPatch(song.id, { rank })}
          />
        );

      case "duration":
        return <span className="k-num text-xs text-muted-foreground">{formatDuration(song.duration)}</span>;

      case "tags":
        return (
          <TagSelector
            songId={song.id}
            selectedTags={songTags}
            allTags={allTags}
            onTagsChange={(tags) => onTagsChange(song.id, tags)}
            onTagCreated={onTagCreated}
            size="sm"
          />
        );

      case "lyrics":
        return <LyricsCell song={song} onOpen={onOpenLyrics} />;

      case "notes": {
        // max-w caps the cell so a trailing 1fr track keeps its configured
        // max-content, not the raw note length (the table wrapper is w-max).
        const hint = otherNote(song);
        return (
          <TextCell
            field="Notes"
            track={song.title}
            value={song.mixing_notes ?? ""}
            multiline
            placeholder="Add a note…"
            title={song.mixing_notes || (hint ? `${hint} (click to add a mixing note)` : "Add a mixing note")}
            className="max-w-[500px] text-xs"
            onCommit={(note) => onPatch(song.id, { mixing_notes: note || null })}
          >
            <span
              className={cn(
                "truncate",
                song.mixing_notes ? "text-foreground/80" : "text-muted-foreground/70",
                !song.mixing_notes && hint && "italic",
              )}
            >
              {song.mixing_notes || hint || "Add a note…"}
            </span>
          </TextCell>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div
      role="row"
      data-current={isCurrent || undefined}
      aria-current={isCurrent ? "true" : undefined}
      className={cn(
        "group/row grid h-11 items-center gap-2 border-b border-border/70 px-3 text-[13px] transition-colors duration-fast hover:bg-accent/60",
        isCurrent && "bg-signal-soft hover:bg-signal-soft",
      )}
      style={{ gridTemplateColumns: gridTemplate }}
    >
      {visibleColumns.map((columnId) => (
        <div
          key={columnId}
          role="cell"
          className={cn("flex min-w-0 items-center", NUMERIC_COLUMNS.has(columnId) && "justify-end")}
        >
          {renderCell(columnId)}
        </div>
      ))}
    </div>
  );
}

export const SongTableRow = memo(SongTableRowImpl);
