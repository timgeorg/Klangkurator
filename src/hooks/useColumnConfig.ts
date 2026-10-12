import { useState, useMemo, useCallback, useEffect, useRef } from 'react';

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
  play: { id: 'play', label: '#', minWidth: 52, maxWidth: 100, defaultWidth: 52, resizable: true, filterable: false, sortable: false },
  cover: { id: 'cover', label: 'Cover', minWidth: 40, maxWidth: 80, defaultWidth: 40, resizable: true, filterable: false, sortable: false },
  preview: { id: 'preview', label: 'Waveform', minWidth: 64, maxWidth: 240, defaultWidth: 72, resizable: true, filterable: false, sortable: false },
  title: { id: 'title', label: 'Title', minWidth: 120, maxWidth: 480, defaultWidth: 216, resizable: true, filterable: true, sortable: true, filterType: 'text' },
  artist: { id: 'artist', label: 'Artist', minWidth: 80, maxWidth: 300, defaultWidth: 112, resizable: true, filterable: true, sortable: true, filterType: 'text' },
  album: { id: 'album', label: 'Album', minWidth: 80, maxWidth: 300, defaultWidth: 120, resizable: true, filterable: true, sortable: true, filterType: 'text' },
  rootFolder: { id: 'rootFolder', label: 'Crate', minWidth: 80, maxWidth: 260, defaultWidth: 140, resizable: true, filterable: true, sortable: true, filterType: 'multiselect' },
  bpm: { id: 'bpm', label: 'BPM', minWidth: 60, maxWidth: 120, defaultWidth: 60, resizable: true, filterable: true, sortable: true, filterType: 'range' },
  key: { id: 'key', label: 'Key', minWidth: 56, maxWidth: 100, defaultWidth: 56, resizable: true, filterable: true, sortable: true, filterType: 'multiselect' },
  genre: { id: 'genre', label: 'Genre', minWidth: 80, maxWidth: 220, defaultWidth: 96, resizable: true, filterable: true, sortable: false, filterType: 'multiselect' },
  subgenres: { id: 'subgenres', label: 'Subgenres', minWidth: 100, maxWidth: 300, defaultWidth: 140, resizable: true, filterable: true, sortable: false, filterType: 'multiselect' },
  energy: { id: 'energy', label: 'Energy', minWidth: 72, maxWidth: 120, defaultWidth: 76, resizable: true, filterable: true, sortable: true, filterType: 'range' },
  danceability: { id: 'danceability', label: 'Dance', minWidth: 72, maxWidth: 120, defaultWidth: 76, resizable: true, filterable: true, sortable: true, filterType: 'range' },
  social: { id: 'social', label: 'Social', minWidth: 72, maxWidth: 120, defaultWidth: 76, resizable: true, filterable: true, sortable: true, filterType: 'range' },
  duration: { id: 'duration', label: 'Time', minWidth: 64, maxWidth: 120, defaultWidth: 64, resizable: true, filterable: true, sortable: true, filterType: 'range' },
  tags: { id: 'tags', label: 'Tags', minWidth: 100, maxWidth: 480, defaultWidth: 140, resizable: true, filterable: true, sortable: false, filterType: 'multiselect' },
  lyrics: { id: 'lyrics', label: 'Lyrics', minWidth: 80, maxWidth: 300, defaultWidth: 100, resizable: true, filterable: false, sortable: false },
  notes: { id: 'notes', label: 'Notes', minWidth: 100, maxWidth: 500, defaultWidth: 200, resizable: true, filterable: false, sortable: false },
};

// Default column order: what a DJ scans first (title, artist, genre, BPM, key)
// leads; saved layouts keep their own order. The default widths of the first
// nine columns (through Time) add up to fit the 872px main area at 1440px
// with the player panel docked.
const DEFAULT_COLUMN_ORDER = [
  'play', 'cover', 'title', 'artist', 'genre', 'bpm', 'key', 'preview', 'duration',
  'subgenres', 'energy', 'danceability', 'social', 'album', 'rootFolder',
  'tags', 'lyrics', 'notes'
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
  /** Columns the user resized by hand; auto-sizing (Tags) leaves them alone. */
  sized?: string[];
}

// PF-15: the whole column config persists as one JSON blob under a single key
const COLUMN_CONFIG_STORAGE_KEY = 'klangkurator.columnConfig.v1';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isValidColumnOrder = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(id => typeof id === 'string' && Object.prototype.hasOwnProperty.call(COLUMN_DEFINITIONS, id));

// Returns the persisted blob only when complete and valid; null → fall back to defaults
const loadPersistedColumnConfig = (): ColumnConfig | null => {
  try {
    const raw = localStorage.getItem(COLUMN_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) return null;

    const { order, visibility, widths, sized } = parsed;
    if (!isValidColumnOrder(order) || !isPlainObject(visibility) || !isPlainObject(widths)) {
      return null;
    }
    // Migration: persisted orders from before PF-14 have no 'cover' column.
    // Insert after 'play' (or first) so existing users don't lose it.
    const migratedOrder = order.includes('cover')
      ? order
      : (() => {
          const idx = order.indexOf('play');
          const next = [...order];
          next.splice(idx >= 0 ? idx + 1 : 0, 0, 'cover');
          return next;
        })();
    const vis = visibility as Record<string, boolean>;
    const wid = widths as Record<string, number>;
    return {
      order: migratedOrder,
      visibility: { ...vis, cover: vis.cover ?? true },
      widths: { ...wid, cover: wid.cover ?? 48 },
      sized: Array.isArray(sized) ? sized.filter((id): id is string => typeof id === 'string') : [],
    };
  } catch {
    return null;
  }
};

export function useColumnConfig() {
  const [columnOrder, setColumnOrder] = useState<string[]>(
    () => loadPersistedColumnConfig()?.order ?? DEFAULT_COLUMN_ORDER
  );
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(
    () => loadPersistedColumnConfig()?.visibility ?? DEFAULT_VISIBILITY
  );
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(
    () => loadPersistedColumnConfig()?.widths ?? DEFAULT_WIDTHS
  );
  // Persisted with the layout, so a hand-sized Tags column survives a reload
  // instead of being auto-sized again.
  const [userResized, setUserResized] = useState<Record<string, boolean>>(
    () => Object.fromEntries((loadPersistedColumnConfig()?.sized ?? []).map(id => [id, true]))
  );

  // Persistence bookkeeping: last written blob (dedupe) + skip flag for resets
  const lastSavedBlob = useRef<string | null>(null);
  const skipNextSave = useRef(false);

  // Persist order/visibility/widths to localStorage whenever they change
  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const blob = JSON.stringify({
      order: columnOrder,
      visibility: columnVisibility,
      widths: columnWidths,
      sized: Object.keys(userResized).filter(id => userResized[id]),
    });
    if (blob === lastSavedBlob.current) return;
    try {
      localStorage.setItem(COLUMN_CONFIG_STORAGE_KEY, blob);
      lastSavedBlob.current = blob;
    } catch {
      // Quota/serialization errors: keep in-memory state, skip persistence
    }
  }, [columnOrder, columnVisibility, columnWidths, userResized]);

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

  // Reset to defaults (also drops the persisted blob)
  const resetToDefaults = useCallback(() => {
    // Fresh copies so state refs change → the save effect runs once and
    // consumes skipNextSave, keeping the storage key removed.
    setColumnOrder([...DEFAULT_COLUMN_ORDER]);
    setColumnVisibility({ ...DEFAULT_VISIBILITY });
    setColumnWidths({ ...DEFAULT_WIDTHS });
    setUserResized({});
    skipNextSave.current = true;
    try {
      localStorage.removeItem(COLUMN_CONFIG_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
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
