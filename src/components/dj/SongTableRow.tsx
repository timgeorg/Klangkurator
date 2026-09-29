import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Waveform } from '@/components/ui/waveform';
import { TagSelector } from '@/components/ui/tag-selector';
import { Play, Pencil, Music2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Song, Tag } from '@/lib/storage';
import { usePlayer } from '@/lib/PlayerContext';
import { getMainGenreColor } from '@/lib/genreData';
import { UseColumnConfigReturn } from '@/hooks/useColumnConfig';

interface SongTableRowProps {
  song: Song;
  index: number;
  songTags: Tag[];
  columnConfig: UseColumnConfigReturn;
  editingNotes?: string;
  onSongClick: (song: Song) => void;
  onPlaySong: (song: Song) => void;
  onEditSong: (song: Song, e: React.MouseEvent) => void;
  onTagsChange: (songId: string, tags: Tag[]) => void;
  onTagCreated: () => void;
  onNotesEdit: (songId: string, notes: string) => void;
  onNotesBlur: (songId: string) => void;
  onNotesKeyDown: (e: React.KeyboardEvent, songId: string) => void;
  getCurrentNotes: (song: Song) => string;
}

// Utility functions
// PF-12 (revised): duration renders as mm:ss — minutes WITHOUT leading zeroes
// (e.g. "5:37", "12:04"); seconds zero-padded to 2 digits; "--:--" for missing/0.
// Round the TOTAL first so float durations never produce a "0:60" second.
export const formatDuration = (seconds?: number) => {
  if (!seconds) return '--:--';
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const getBpmColor = (bpm?: number) => {
  if (!bpm) return 'text-muted-foreground';
  if (bpm < 100) return 'text-bpm-slow bg-bpm-slow/20';
  if (bpm < 130) return 'text-bpm-medium bg-bpm-medium/20';
  return 'text-bpm-fast bg-bpm-fast/20';
};

// Extract root folder from file path
const getRootFolder = (filePath: string): string => {
  if (!filePath) return '';
  const parts = filePath.replace(/\\/g, '/').split('/');
  if (parts.length >= 2) {
    const nonEmptyParts = parts.filter(p => p && !p.includes(':'));
    return nonEmptyParts[0] || '';
  }
  return '';
};

export function SongTableRow({
  song,
  index,
  songTags,
  columnConfig,
  editingNotes,
  onSongClick,
  onPlaySong,
  onEditSong,
  onTagsChange,
  onTagCreated,
  onNotesEdit,
  onNotesBlur,
  onNotesKeyDown,
  getCurrentNotes,
}: SongTableRowProps) {
  const { visibleColumns, gridTemplate, columnVisibility } = columnConfig;
  // Row highlight: this track is loaded AND actually audible (paused ≠ playing)
  const player = usePlayer();
  const isPlayingRow = player.current?.id === song.id && player.isPlaying;

  const renderCell = (columnId: string) => {
    switch (columnId) {
      case 'play':
        return (
          <div className="flex items-center justify-center gap-1">
            <Button size="sm" variant="ghost" className="w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => { e.stopPropagation(); onPlaySong(song); }}
              title="Play song"
            >
              <Play className="w-3 h-3" />
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              className="w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-primary"
              onClick={(e) => onEditSong(song, e)}
              title="Edit song"
            >
              <Pencil className="w-3 h-3" />
            </Button>
          </div>
        );
        
      case 'cover':
        return (
          <div className="flex items-center">
            {song.artwork_url ? (
              <img
                src={song.artwork_url}
                alt=""
                className="w-8 h-8 rounded object-cover bg-muted"
                loading="lazy"
              />
            ) : (
              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                <Music2 className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
          </div>
        );
        
      case 'preview':
        return (
          <div className="flex items-center">
            <Waveform className="w-16 h-6" variant="compact" peaks={song.waveform_peaks} />
          </div>
        );
        
      case 'title':
        return (
          <div 
            className="flex items-center font-medium text-foreground truncate hover:text-primary cursor-pointer transition-colors"
            onClick={() => onSongClick(song)}
            title="Click to view track details"
          >
            {song.title}
          </div>
        );
        
      case 'artist':
        return (
          <div className="flex items-center text-foreground truncate">
            {song.artist}
          </div>
        );
        
      case 'album':
        return (
          <div className="flex items-center text-muted-foreground truncate">
            {song.album || '-'}
          </div>
        );
        
      case 'rootFolder':
        const folder = getRootFolder(song.file_path);
        return (
          <div className="flex items-center text-muted-foreground truncate" title={song.file_path}>
            {folder || '-'}
          </div>
        );
        
      case 'bpm':
        return (
          <div className="flex items-center">
            {song.bpm ? (
              <Badge variant="secondary" className={cn("text-xs px-1 py-0 h-5", getBpmColor(song.bpm))}>
                {song.bpm}
              </Badge>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </div>
        );
        
      case 'key':
        return (
          <div className="flex items-center">
            {song.musical_key ? (
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs px-1 py-0 h-5 border-key-major",
                  song.musical_key.includes('minor') ? "border-key-minor text-key-minor" : "text-key-major"
                )}
              >
                {song.musical_key.replace(' major', '').replace(' minor', 'm')}
              </Badge>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </div>
        );
        
      case 'genre':
        return <GenreCell song={song} />;
        
      case 'subgenres':
        return <SubgenresCell song={song} />;
        
      case 'energy':
        return <RatingCell value={song.energy} colorClass="bg-energy-high" />;
        
      case 'danceability':
        return <RatingCell value={song.danceability} colorClass="bg-accent" />;
        
      case 'social':
        return <RatingCell value={song.social_acceptance} colorClass="bg-secondary" />;
        
      case 'duration':
        return (
          <div className="flex items-center text-muted-foreground font-mono">
            {formatDuration(song.duration)}
          </div>
        );
        
      case 'tags':
        return (
          <div className="flex items-center min-w-0">
            <TagSelector
              songId={song.id}
              selectedTags={songTags}
              onTagsChange={(tags) => onTagsChange(song.id, tags)}
              onTagCreated={onTagCreated}
              size="sm"
            />
          </div>
        );
        
      case 'lyrics':
        return (
          <div className="flex items-center min-w-0">
            {song.lyrics ? (
              <div 
                className="text-xs text-muted-foreground truncate cursor-pointer hover:text-foreground"
                title={song.lyrics.substring(0, 200) + (song.lyrics.length > 200 ? '...' : '')}
              >
                {song.lyrics.substring(0, 50)}{song.lyrics.length > 50 ? '...' : ''}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground/50">No lyrics</span>
            )}
          </div>
        );
        
      case 'notes':
        // max-w caps the cell so the trailing 1fr track keeps contributing its
        // configured max-content (≤ notes maxWidth), not the raw note length —
        // required now that the table wrapper is w-max (horizontal scroll).
        return (
          <div className="flex items-center min-w-0 max-w-[500px]">
            {editingNotes !== undefined ? (
              <textarea
                value={editingNotes}
                onChange={(e) => onNotesEdit(song.id, e.target.value)}
                onBlur={() => onNotesBlur(song.id)}
                onKeyDown={(e) => onNotesKeyDown(e, song.id)}
                className="w-full h-6 text-xs bg-input border border-border rounded px-1 py-0 text-foreground resize-none overflow-hidden"
                autoFocus
                placeholder="Add notes..."
              />
            ) : (
              <div 
                className="w-full h-6 flex items-center text-xs text-muted-foreground cursor-text hover:bg-table-row-hover rounded px-1 truncate"
                onClick={() => onNotesEdit(song.id, getCurrentNotes(song))}
                title={getCurrentNotes(song) || 'Click to add notes'}
              >
                {getCurrentNotes(song) || 'Click to add notes...'}
              </div>
            )}
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div 
      className={cn(
        "grid gap-2 px-3 py-2 text-xs border-b border-table-border hover:bg-table-row-hover transition-colors cursor-pointer group",
        index % 2 === 0 ? "bg-table-row" : "bg-background",
        isPlayingRow && "bg-orange-950/20"
      )}
      style={{ gridTemplateColumns: gridTemplate }}
    >
      {visibleColumns.map((columnId) => (
        <React.Fragment key={columnId}>
          {renderCell(columnId)}
        </React.Fragment>
      ))}
    </div>
  );
}

// Sub-components for complex cells
function GenreCell({ song }: { song: Song }) {
  const mainGenre = song.mainGenre;
  const color = mainGenre ? getMainGenreColor(mainGenre) : '#6366f1';
  
  if (!mainGenre) {
    const legacyGenre = song.genres?.[0] || song.genre;
    if (!legacyGenre) {
      return <span className="text-muted-foreground">-</span>;
    }
    return (
      <div className="flex items-center gap-1 min-w-0 flex-wrap">
        <Badge
          variant="secondary"
          className="text-[10px] px-1 py-0 h-4 flex-shrink-0"
          style={{ 
            backgroundColor: `${getMainGenreColor(legacyGenre)}20`, 
            borderColor: getMainGenreColor(legacyGenre),
            color: getMainGenreColor(legacyGenre)
          }}
        >
          {legacyGenre}
        </Badge>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-1 min-w-0 flex-wrap">
      <Badge
        variant="secondary"
        className="text-[10px] px-1 py-0 h-4 flex-shrink-0"
        style={{ 
          backgroundColor: `${color}20`, 
          borderColor: color,
          color: color
        }}
      >
        {mainGenre}
      </Badge>
    </div>
  );
}

function SubgenresCell({ song }: { song: Song }) {
  const subgenres = song.subgenres || [];
  const mainGenre = song.mainGenre;
  const color = mainGenre ? getMainGenreColor(mainGenre) : '#6366f1';
  
  if (subgenres.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }
  
  return (
    <div className="flex items-center gap-1 min-w-0 flex-wrap">
      {subgenres.slice(0, 3).map(sub => (
        <Badge
          key={sub}
          variant="outline"
          className="text-[10px] px-1 py-0 h-4 flex-shrink-0"
          style={{ 
            borderColor: `${color}60`,
            color: color
          }}
        >
          {sub}
        </Badge>
      ))}
      {subgenres.length > 3 && (
        <span className="text-[10px] text-muted-foreground">
          +{subgenres.length - 3}
        </span>
      )}
    </div>
  );
}

function RatingCell({ value, colorClass }: { value: number; colorClass: string }) {
  return (
    <div className="flex items-center">
      <div className="flex gap-[2px]">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className={cn(
              "w-2 h-2 rounded-full",
              i < value ? colorClass : "bg-muted"
            )}
          />
        ))}
      </div>
    </div>
  );
}
