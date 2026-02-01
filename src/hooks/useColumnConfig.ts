import { useState, useMemo, useCallback } from 'react';

// Column definition type
export interface ColumnDef {
  id: string;
  label: string;
  minWidth: number;
  maxWidth: number;
  defaultWidth: number;
  resizable: boolean;
  filterable: boolean;
  sortable: boolean;
  filterType?: 'text' | 'range' | 'multiselect';
}

// All available columns with their configuration
export const COLUMN_DEFINITIONS: Record<string, ColumnDef> = {
  play: { id: 'play', label: 'Play/Edit', minWidth: 40, maxWidth: 100, defaultWidth: 40, resizable: true, filterable: false, sortable: false },
  preview: { id: 'preview', label: 'Preview', minWidth: 60, maxWidth: 200, defaultWidth: 80, resizable: true, filterable: false, sortable: false },
  title: { id: 'title', label: 'Title', minWidth: 100, maxWidth: 400, defaultWidth: 200, resizable: true, filterable: true, sortable: true, filterType: 'text' },
  artist: { id: 'artist', label: 'Artist', minWidth: 80, maxWidth: 300, defaultWidth: 150, resizable: true, filterable: true, sortable: true, filterType: 'text' },
  album: { id: 'album', label: 'Album', minWidth: 80, maxWidth: 300, defaultWidth: 150, resizable: true, filterable: true, sortable: true, filterType: 'text' },
  bpm: { id: 'bpm', label: 'BPM', minWidth: 60, maxWidth: 120, defaultWidth: 80, resizable: true, filterable: true, sortable: true, filterType: 'range' },
  key: { id: 'key', label: 'Key', minWidth: 50, maxWidth: 100, defaultWidth: 50, resizable: true, filterable: true, sortable: true, filterType: 'multiselect' },
  genre: { id: 'genre', label: 'Main Genre', minWidth: 80, maxWidth: 200, defaultWidth: 100, resizable: true, filterable: true, sortable: false, filterType: 'multiselect' },
  subgenres: { id: 'subgenres', label: 'Subgenres', minWidth: 100, maxWidth: 300, defaultWidth: 160, resizable: true, filterable: true, sortable: false, filterType: 'multiselect' },
  energy: { id: 'energy', label: 'Energy', minWidth: 60, maxWidth: 120, defaultWidth: 80, resizable: true, filterable: true, sortable: true, filterType: 'range' },
  danceability: { id: 'danceability', label: 'Danceability', minWidth: 60, maxWidth: 120, defaultWidth: 60, resizable: true, filterable: true, sortable: true, filterType: 'range' },
  social: { id: 'social', label: 'Social', minWidth: 60, maxWidth: 120, defaultWidth: 60, resizable: true, filterable: true, sortable: true, filterType: 'range' },
  duration: { id: 'duration', label: 'Duration', minWidth: 60, maxWidth: 120, defaultWidth: 80, resizable: true, filterable: true, sortable: true, filterType: 'range' },
  tags: { id: 'tags', label: 'Tags', minWidth: 100, maxWidth: 480, defaultWidth: 160, resizable: true, filterable: true, sortable: false, filterType: 'multiselect' },
  lyrics: { id: 'lyrics', label: 'Lyrics', minWidth: 80, maxWidth: 300, defaultWidth: 120, resizable: true, filterable: false, sortable: false },
  notes: { id: 'notes', label: 'Notes', minWidth: 100, maxWidth: 500, defaultWidth: 200, resizable: true, filterable: false, sortable: false },
};

// Default column order
const DEFAULT_COLUMN_ORDER = [
  'play', 'preview', 'title', 'artist', 'album', 'bpm', 'key', 
  'genre', 'subgenres', 'energy', 'danceability', 'social', 
  'duration', 'tags', 'lyrics', 'notes'
];

// Default visibility (all visible)
const DEFAULT_VISIBILITY: Record<string, boolean> = Object.fromEntries(
  DEFAULT_COLUMN_ORDER.map(id => [id, true])
);

// Default widths
const DEFAULT_WIDTHS: Record<string, number> = Object.fromEntries(
  Object.entries(COLUMN_DEFINITIONS).map(([id, def]) => [id, def.defaultWidth])
);

export interface ColumnConfig {
  order: string[];
  visibility: Record<string, boolean>;
  widths: Record<string, number>;
}

export function useColumnConfig() {
  const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_COLUMN_ORDER);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(DEFAULT_VISIBILITY);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(DEFAULT_WIDTHS);
  const [userResized, setUserResized] = useState<Record<string, boolean>>({});

  // Get visible columns in order
  const visibleColumns = useMemo(() => {
    return columnOrder.filter(id => columnVisibility[id]);
  }, [columnOrder, columnVisibility]);

  // Build CSS grid template
  const gridTemplate = useMemo(() => {
    return visibleColumns
      .map((id, index) => {
        // Last column gets 1fr to fill remaining space
        if (index === visibleColumns.length - 1 && id === 'notes') {
          return '1fr';
        }
        return `${columnWidths[id]}px`;
      })
      .join(' ');
  }, [visibleColumns, columnWidths]);

  // Toggle column visibility
  const toggleVisibility = useCallback((columnId: string) => {
    setColumnVisibility(prev => ({
      ...prev,
      [columnId]: !prev[columnId]
    }));
  }, []);

  // Set column visibility directly
  const setVisibility = useCallback((columnId: string, visible: boolean) => {
    setColumnVisibility(prev => ({
      ...prev,
      [columnId]: visible
    }));
  }, []);

  // Reorder columns
  const reorderColumns = useCallback((newOrder: string[]) => {
    setColumnOrder(newOrder);
  }, []);

  // Move a column to a new position
  const moveColumn = useCallback((fromIndex: number, toIndex: number) => {
    setColumnOrder(prev => {
      const newOrder = [...prev];
      const [removed] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, removed);
      return newOrder;
    });
  }, []);

  // Resize a column
  const resizeColumn = useCallback((columnId: string, width: number) => {
    const def = COLUMN_DEFINITIONS[columnId];
    const clampedWidth = Math.max(def.minWidth, Math.min(def.maxWidth, width));
    setColumnWidths(prev => ({
      ...prev,
      [columnId]: clampedWidth
    }));
    setUserResized(prev => ({ ...prev, [columnId]: true }));
  }, []);

  // Auto-resize column (respects user resize flag)
  const autoResizeColumn = useCallback((columnId: string, width: number) => {
    if (userResized[columnId]) return;
    const def = COLUMN_DEFINITIONS[columnId];
    const clampedWidth = Math.max(def.minWidth, Math.min(def.maxWidth, width));
    setColumnWidths(prev => ({
      ...prev,
      [columnId]: clampedWidth
    }));
  }, [userResized]);

  // Start column resize (returns mouse handlers)
  const startResize = useCallback((columnId: string, startX: number, onResize?: () => void) => {
    const startWidth = columnWidths[columnId];
    const def = COLUMN_DEFINITIONS[columnId];

    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - startX;
      const newWidth = Math.max(def.minWidth, Math.min(def.maxWidth, startWidth + delta));
      setColumnWidths(prev => ({ ...prev, [columnId]: newWidth }));
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setUserResized(prev => ({ ...prev, [columnId]: true }));
      onResize?.();
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [columnWidths]);

  // Get column definition
  const getColumnDef = useCallback((columnId: string): ColumnDef | undefined => {
    return COLUMN_DEFINITIONS[columnId];
  }, []);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setColumnOrder(DEFAULT_COLUMN_ORDER);
    setColumnVisibility(DEFAULT_VISIBILITY);
    setColumnWidths(DEFAULT_WIDTHS);
    setUserResized({});
  }, []);

  return {
    // State
    columnOrder,
    columnVisibility,
    columnWidths,
    visibleColumns,
    gridTemplate,
    
    // Actions
    toggleVisibility,
    setVisibility,
    reorderColumns,
    moveColumn,
    resizeColumn,
    autoResizeColumn,
    startResize,
    getColumnDef,
    resetToDefaults,
    
    // Constants
    allColumns: DEFAULT_COLUMN_ORDER,
    definitions: COLUMN_DEFINITIONS,
  };
}

export type UseColumnConfigReturn = ReturnType<typeof useColumnConfig>;
