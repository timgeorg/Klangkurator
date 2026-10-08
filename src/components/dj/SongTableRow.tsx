import React, { memo } from "react";
import { Link } from "react-router-dom";
import { Pause, Pencil, Play } from "lucide-react";

import { CoverArt } from "@/components/brand";
import { ColorChip } from "@/components/ui/color-chip";
import { TagSelector } from "@/components/ui/tag-selector";
import { Waveform } from "@/components/ui/waveform";
import { UseColumnConfigReturn } from "@/hooks/useColumnConfig";
import { getMainGenreColor } from "@/lib/genreData";
import { Song, Tag } from "@/lib/storage";
import { crateOf, formatBpm, formatDuration, isMinorKey, keyName, splitTitle } from "@/lib/trackFormat";
import { cn } from "@/lib/utils";

import { NUMERIC_COLUMNS } from "./libraryTable";

interface SongTableRowProps {
  song: Song;
  index: number;
  songTags: Tag[];
  allTags: Tag[];
  visibleColumns: string[];
  gridTemplate: string;
  editingNotes?: string;
  /** The loaded track (playing or paused): carries the orange cut. */
  isCurrent: boolean;
  isPlaying: boolean;
  onPlaySong: (song: Song) => void;
  onEditSong: (song: Song) => void;
  onTagsChange: (songId: string, tags: Tag[]) => void;
  onTagCreated: () => void;
  onNotesEdit: (songId: string, notes: string) => void;
  onNotesBlur: (songId: string) => void;
  onNotesKeyDown: (e: React.KeyboardEvent, songId: string) => void;
}

/** The other notes, shown as a hint while the mixing note (the editable one) is empty. */
const otherNote = (song: Song) =>
  song.drum_notes ? `Drums: ${song.drum_notes}` : song.element_notes ? `Elements: ${song.element_notes}` : "";

function SongTableRowImpl({
  song,
  index,
  songTags,
  allTags,
  visibleColumns,
  gridTemplate,
  editingNotes,
  isCurrent,
  isPlaying,
  onPlaySong,
  onEditSong,
  onTagsChange,
  onTagCreated,
  onNotesEdit,
  onNotesBlur,
  onNotesKeyDown,
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
        return <span className="truncate text-foreground/85">{song.artist}</span>;

      case "album":
        return <span className="truncate text-muted-foreground">{song.album || "–"}</span>;

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
          <span className={cn("k-num text-xs", song.bpm ? "text-foreground/85" : "text-muted-foreground")}>
            {formatBpm(song.bpm)}
          </span>
        );

      case "key":
        return song.musical_key ? (
          <span
            className={cn("k-num text-xs", isMinorKey(song.musical_key) ? "text-info" : "text-foreground")}
            title={keyName(song.musical_key)}
          >
            {song.musical_key.replace(" major", "").replace(" minor", "m")}
          </span>
        ) : (
          <span className="k-num text-xs text-muted-foreground">–</span>
        );

      case "genre": {
        const genre = song.mainGenre || song.genres?.[0] || song.genre;
        return genre ? <ColorChip color={getMainGenreColor(genre)} label={genre} /> : <Dash />;
      }

      case "subgenres": {
        const subs = song.subgenres || [];
        if (subs.length === 0) return <Dash />;
        return (
          <span className="truncate text-muted-foreground" title={subs.join(", ")}>
            {subs.slice(0, 3).join(" · ")}
            {subs.length > 3 && <span className="k-num text-[11px]"> +{subs.length - 3}</span>}
          </span>
        );
      }

      case "energy":
        return <RatingMeter value={song.energy} label="Energy" />;

      case "danceability":
        return <RatingMeter value={song.danceability} label="Danceability" />;

      case "social":
        return <RatingMeter value={song.social_acceptance} label="Social acceptance" />;

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
        return song.lyrics ? (
          <span
            className="truncate text-xs text-muted-foreground"
            title={song.lyrics.substring(0, 200) + (song.lyrics.length > 200 ? "…" : "")}
          >
            {song.lyrics.substring(0, 50)}
            {song.lyrics.length > 50 ? "…" : ""}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/60">No lyrics</span>
        );

      case "notes":
        // max-w caps the cell so a trailing 1fr track keeps its configured
        // max-content, not the raw note length (the table wrapper is w-max).
        return editingNotes !== undefined ? (
          <textarea
            value={editingNotes}
            onChange={(e) => onNotesEdit(song.id, e.target.value)}
            onBlur={() => onNotesBlur(song.id)}
            onKeyDown={(e) => onNotesKeyDown(e, song.id)}
            aria-label={`Notes for ${song.title}`}
            className="h-7 w-full max-w-[500px] resize-none overflow-hidden rounded-sm border border-ring bg-background px-2 py-1 text-xs leading-tight text-foreground outline-none ring-1 ring-ring"
            autoFocus
            placeholder="Add a note…"
          />
        ) : (
          <button
            type="button"
            onClick={() => onNotesEdit(song.id, song.mixing_notes ?? "")}
            title={song.mixing_notes || (otherNote(song) ? `${otherNote(song)} (click to add a mixing note)` : "Add a mixing note")}
            className={cn(
              "flex h-7 w-full max-w-[500px] items-center truncate rounded-sm px-2 text-left text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              song.mixing_notes ? "text-foreground/80" : "text-muted-foreground/70",
              !song.mixing_notes && otherNote(song) && "italic",
            )}
          >
            <span className="truncate">{song.mixing_notes || otherNote(song) || "Add a note…"}</span>
          </button>
        );

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

function Dash() {
  return <span className="text-muted-foreground">–</span>;
}

/** 0–5 rating as five short bars; unrated (0) reads as five empty bars. */
function RatingMeter({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(5, value || 0));
  return (
    <span role="img" aria-label={`${label} ${v} of 5`} className="flex items-end gap-[3px]" title={`${label} ${v}/5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={cn("w-[3px] rounded-[1px]", i < v ? "bg-foreground/80" : "bg-foreground/15")}
          style={{ height: 6 + i * 2 }}
        />
      ))}
    </span>
  );
}
