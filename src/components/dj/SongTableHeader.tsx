import React from 'react';
import { Play, Volume2, ArrowUpDown } from 'lucide-react';
import { ColumnFilter } from '@/components/ui/column-filter';
import { UseColumnConfigReturn, COLUMN_DEFINITIONS } from '@/hooks/useColumnConfig';

interface FilterState {
  title: string;
  artist: string;
  album: string;
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

export function SongTableHeader({
  columnConfig,
  filters,
  filterOptions,
  onFilterChange,
}: SongTableHeaderProps) {
  const { visibleColumns, gridTemplate, startResize } = columnConfig;

  const handleResizeStart = (columnId: string, e: React.MouseEvent) => {
    e.preventDefault();
    startResize(columnId, e.clientX);
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
        {visibleColumns.map((columnId) => (
          <React.Fragment key={columnId}>
            {renderColumnHeader(columnId)}
          </React.Fragment>
        ))}
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
