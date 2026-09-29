import React, { useRef, useState } from 'react';
import { Play, Volume2, ArrowUpDown, Image } from 'lucide-react';
import { ColumnFilter } from '@/components/ui/column-filter';
import { UseColumnConfigReturn, COLUMN_DEFINITIONS } from '@/hooks/useColumnConfig';
import { cn } from '@/lib/utils';

interface FilterState {
  title: string;
  artist: string;
  album: string;
  rootFolder: string[];
  genre: string[];
  subgenres: string[];
  bpm: { min?: number; max?: number };
  key: string[];
  energy: { min?: number; max?: number };
  danceability: { min?: number; max?: number };
  social: { min?: number; max?: number };
  duration: { min?: number; max?: number };
  tags: string[];
}

interface FilterOptions {
  mainGenres: Array<{ label: string; value: string; color?: string }>;
  subgenres: Array<{ label: string; value: string; color?: string }>;
  keys: Array<{ label: string; value: string; color?: string }>;
  tags: Array<{ label: string; value: string; color?: string }>;
  rootFolders: Array<{ label: string; value: string }>;
}

interface SongTableHeaderProps {
  columnConfig: UseColumnConfigReturn;
  filters: FilterState;
  filterOptions: FilterOptions;
  onFilterChange: (key: string, value: any) => void;
}

// Filter configuration for each column
const FILTER_CONFIG: Record<string, { type: 'text' | 'range' | 'multiselect'; optionsKey?: keyof FilterOptions; min?: number; max?: number; placeholder?: string }> = {
  title: { type: 'text', placeholder: 'Filter titles...' },
  artist: { type: 'text', placeholder: 'Filter artists...' },
  album: { type: 'text', placeholder: 'Filter albums...' },
  rootFolder: { type: 'multiselect', optionsKey: 'rootFolders' },
  bpm: { type: 'range', min: 60, max: 200 },
  key: { type: 'multiselect', optionsKey: 'keys' },
  genre: { type: 'multiselect', optionsKey: 'mainGenres' },
  subgenres: { type: 'multiselect', optionsKey: 'subgenres' },
  energy: { type: 'range', min: 0, max: 5 },
  danceability: { type: 'range', min: 0, max: 5 },
  social: { type: 'range', min: 0, max: 5 },
  duration: { type: 'range', min: 0, max: 600 },
  tags: { type: 'multiselect', optionsKey: 'tags' },
};

// Column filter key mapping
const FILTER_KEY_MAP: Record<string, keyof FilterState> = {
  title: 'title',
  artist: 'artist',
  album: 'album',
  rootFolder: 'rootFolder',
  bpm: 'bpm',
  key: 'key',
  genre: 'genre',
  subgenres: 'subgenres',
  energy: 'energy',
  danceability: 'danceability',
  social: 'social',
  duration: 'duration',
  tags: 'tags',
};

// Drop indicator: which column is hovered and on which half
interface DropIndicator {
  columnId: string;
  side: 'left' | 'right';
}

export function SongTableHeader({
  columnConfig,
  filters,
  filterOptions,
  onFilterChange,
}: SongTableHeaderProps) {
  const { visibleColumns, gridTemplate, startResize, columnOrder, moveColumn } = columnConfig;

  // PF-15: insert-before drag & drop reordering
  const dragColumnRef = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);

  const handleResizeStart = (columnId: string, e: React.MouseEvent) => {
    e.preventDefault();
    startResize(columnId, e.clientX);
  };

  const clearDragState = () => {
    dragColumnRef.current = null;
    setDraggingId(null);
    setDropIndicator(null);
  };

  const getDropSide = (e: React.DragEvent<HTMLDivElement>): 'left' | 'right' => {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientX < rect.left + rect.width / 2 ? 'left' : 'right';
  };

  const handleDragStart = (columnId: string) => (e: React.DragEvent<HTMLDivElement>) => {
    dragColumnRef.current = columnId;
    setDraggingId(columnId);
    e.dataTransfer.effectAllowed = 'move';
    // setData is required for Firefox to start the drag at all
    e.dataTransfer.setData('text/plain', columnId);
  };

  const handleDragOver = (columnId: string) => (e: React.DragEvent<HTMLDivElement>) => {
    const fromId = dragColumnRef.current;
    if (!fromId || fromId === columnId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const side = getDropSide(e);
    setDropIndicator(prev =>
      prev && prev.columnId === columnId && prev.side === side ? prev : { columnId, side }
    );
  };

  const handleDrop = (columnId: string) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const fromId = dragColumnRef.current;
    const side = getDropSide(e);
    clearDragState();
    if (!fromId || fromId === columnId) return;

    // Indexes are computed against columnOrder (what moveColumn splices),
    // not visibleColumns: hidden columns would shift the positions otherwise.
    const fromIndex = columnOrder.indexOf(fromId);
    const hoverIndex = columnOrder.indexOf(columnId);
    if (fromIndex === -1 || hoverIndex === -1) return;

    // Insert-before semantics: left half → land before hovered, right half → after.
    const desiredIndex = side === 'left' ? hoverIndex : hoverIndex + 1;
    // moveColumn splices OUT first: moving right (fromIndex < desiredIndex)
    // shifts the insertion slot left by one, so compensate.
    const toIndex = fromIndex < desiredIndex ? desiredIndex - 1 : desiredIndex;
    if (toIndex === fromIndex) return;

    moveColumn(fromIndex, toIndex);
  };

  const renderColumnHeader = (columnId: string) => {
    const def = COLUMN_DEFINITIONS[columnId];
    const filterConfig = FILTER_CONFIG[columnId];
    const filterKey = FILTER_KEY_MAP[columnId];
    
    // Special icons for certain columns
    if (columnId === 'play') {
      return (
        <div className="flex items-center justify-center relative group">
          <Play className="w-3 h-3" />
          <ResizeHandle onMouseDown={(e) => handleResizeStart(columnId, e)} />
        </div>
      );
    }
    
    if (columnId === 'cover') {
      return (
        <div className="flex items-center gap-1 relative group">
          <Image className="w-3 h-3" />
          Cover
          <ResizeHandle onMouseDown={(e) => handleResizeStart(columnId, e)} />
        </div>
      );
    }
    
    if (columnId === 'preview') {
      return (
        <div className="flex items-center gap-1 relative group">
          <Volume2 className="w-3 h-3" />
          Preview
          <ResizeHandle onMouseDown={(e) => handleResizeStart(columnId, e)} />
        </div>
      );
    }
    
    // Standard column with optional filter
    return (
      <div className="flex items-center gap-1 relative group">
        {def?.label || columnId}
        {def?.sortable && <ArrowUpDown className="w-3 h-3" />}
        
        {filterConfig && filterKey && (
          <ColumnFilter
            title={def?.label || columnId}
            type={filterConfig.type}
            value={filters[filterKey]}
            onChange={(value) => onFilterChange(filterKey, value)}
            placeholder={filterConfig.placeholder}
            min={filterConfig.min}
            max={filterConfig.max}
            options={filterConfig.optionsKey ? filterOptions[filterConfig.optionsKey] : undefined}
          />
        )}
        
        <ResizeHandle onMouseDown={(e) => handleResizeStart(columnId, e)} />
      </div>
    );
  };

  return (
    <div className="sticky top-0 z-10 bg-table-header border-b border-table-border">
      <div 
        className="grid gap-2 px-3 py-2 text-xs font-medium text-muted-foreground"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {visibleColumns.map((columnId) => {
          const isPlayColumn = columnId === 'play';
          return (
            <div
              key={columnId}
              draggable={!isPlayColumn}
              onDragStart={isPlayColumn ? undefined : handleDragStart(columnId)}
              onDragEnd={isPlayColumn ? undefined : clearDragState}
              onDragOver={isPlayColumn ? undefined : handleDragOver(columnId)}
              onDrop={isPlayColumn ? undefined : handleDrop(columnId)}
              // display:grid keeps the inner content stretched to the full
              // cell (same geometry as when it was the grid child itself),
              // so the absolutely-positioned ResizeHandle stays full-height.
              className={cn(
                'grid min-w-0',
                !isPlayColumn && 'cursor-grab',
                draggingId === columnId && 'cursor-grabbing',
                dropIndicator?.columnId === columnId && dropIndicator.side === 'left' && 'border-l-2 border-orange-500',
                dropIndicator?.columnId === columnId && dropIndicator.side === 'right' && 'border-r-2 border-orange-500'
              )}
            >
              {renderColumnHeader(columnId)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Resize handle component
function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      className="absolute -right-1 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-border"
      onMouseDown={onMouseDown}
      title="Drag to resize column"
    />
  );
}
