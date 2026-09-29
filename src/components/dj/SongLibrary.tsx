import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { storage, Song, Tag } from '@/lib/storage';
import { FileLoader } from '@/lib/fileLoader';
import { toast } from '@/hooks/use-toast';
import { usePlayer } from '@/lib/PlayerContext';
import { useColumnConfig } from '@/hooks/useColumnConfig';
import { SongTableHeader } from './SongTableHeader';
import { SongTableRow } from './SongTableRow';
import { EditSongDialog } from './EditSongDialog';
import { ColumnSettingsDialog } from './ColumnSettingsDialog';
import { Search, Plus, Music2, FolderOpen, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Filter state type
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

const INITIAL_FILTERS: FilterState = {
  title: '',
  artist: '',
  album: '',
  rootFolder: [],
  genre: [],
  subgenres: [],
  bpm: {},
  key: [],
  energy: {},
  danceability: {},
  social: {},
  duration: {},
  tags: []
};

// Utility to extract root folder from file path
const getRootFolder = (filePath: string): string => {
  if (!filePath) return '';
  // Handle both Windows and Unix paths
  const parts = filePath.replace(/\\/g, '/').split('/');
  // Return the first folder after the drive/root, or the folder containing the file
  if (parts.length >= 2) {
    // Skip empty parts and find meaningful folder
    const nonEmptyParts = parts.filter(p => p && !p.includes(':'));
    return nonEmptyParts[0] || '';
  }
  return '';
};

export function SongLibrary() {
  const navigate = useNavigate();
  const player = usePlayer();

  // Column configuration hook
  const columnConfig = useColumnConfig();
  
  // Core data state
  const [songs, setSongs] = useState<Song[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [songTags, setSongTags] = useState<Record<string, Tag[]>>({});
  
  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  
  // Dialog states
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSongForEdit, setSelectedSongForEdit] = useState<Song | null>(null);
  // True until the first load completes — gates the empty-library redirect
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Horizontal-overflow affordance: true when the table content is wider than
  // the scroll container (right-edge fade is only rendered when set)
  const [tableOverflows, setTableOverflows] = useState(false);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  // Load initial data
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = useCallback(async () => {
    const [loadedSongs, loadedTags] = await Promise.all([
      storage.getSongs(),
      storage.getTags(),
    ]);
    setSongs(loadedSongs);
    setAllTags(loadedTags);

    const tagsMap: Record<string, Tag[]> = {};
    for (const song of loadedSongs) {
      tagsMap[song.id] = await storage.getTagsForSong(song.id);
    }
    setSongTags(tagsMap);
    setInitialLoadDone(true);
  }, []);

  // Empty library → the table is a dead end; route to the import page.
  // Only when the library itself is empty — not when a search/filter
  // simply matches nothing.
  useEffect(() => {
    if (initialLoadDone && songs.length === 0) {
      navigate('/load-files', { replace: true });
    }
  }, [initialLoadDone, songs.length, navigate]);

  // Auto-resize tags column based on content
  useEffect(() => {
    const maxCount = songs.reduce((max, s) => {
      const c = songTags[s.id]?.length || 0;
      return c > max ? c : max;
    }, 0);
    const autoWidth = Math.min(360, 160 + Math.max(0, maxCount - 1) * 70);
    columnConfig.autoResizeColumn('tags', autoWidth);
  }, [songTags, songs]);

  // Handlers
  const handleTagsChange = useCallback(async (songId: string, tags: Tag[]) => {
    setSongTags(prev => ({ ...prev, [songId]: tags }));
    setAllTags(await storage.getTags());
  }, []);

  const handleTagCreated = useCallback(async () => {
    setAllTags(await storage.getTags());
  }, []);

  const handleLoadFiles = async () => {
    try {
      setLoading(true);
      const files = await FileLoader.loadAudioFiles();
      
      if (files.length > 0) {
        toast({
          title: "Files loaded successfully",
          description: `Loaded ${files.length} audio files to your library.`,
        });
        loadAllData();
      }
    } catch (error: any) {
      toast({
        title: "Error loading files",
        description: error.message || "Failed to load audio files",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // PF-17: title click navigates to the song detail page (the relationships
  // dialog moved there); the pencil button still opens the edit dialog.
  const handleSongClick = useCallback((song: Song) => {
    navigate(`/song/${song.id}`);
  }, [navigate]);

  const handleEditSong = useCallback((song: Song, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedSongForEdit(song);
    setEditDialogOpen(true);
  }, []);

  const handleSongSaved = useCallback(() => {
    loadAllData();
  }, [loadAllData]);

  const updateFilter = useCallback((key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // Notes editing handlers
  const handleNotesEdit = useCallback((songId: string, notes: string) => {
    setEditingNotes(prev => ({ ...prev, [songId]: notes }));
  }, []);

  const handleNotesBlur = useCallback(async (songId: string) => {
    const notes = editingNotes[songId];
    if (notes !== undefined) {
      await storage.updateSong(songId, { mixing_notes: notes });
      setSongs(await storage.getSongs());
      setEditingNotes(prev => {
        const updated = { ...prev };
        delete updated[songId];
        return updated;
      });
    }
  }, [editingNotes]);

  const handleNotesKeyDown = useCallback((e: React.KeyboardEvent, songId: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleNotesBlur(songId);
    }
    if (e.key === 'Escape') {
      setEditingNotes(prev => {
        const updated = { ...prev };
        delete updated[songId];
        return updated;
      });
    }
  }, [handleNotesBlur]);

  const getCurrentNotes = useCallback((song: Song) => {
    return song.mixing_notes || song.drum_notes || song.element_notes || '';
  }, []);

  // Memoized filter options
  const filterOptions = useMemo(() => {
    const mainGenresSet = new Set<string>();
    const subgenresSet = new Set<string>();
    const rootFoldersSet = new Set<string>();
    
    songs.forEach(s => {
      if (s.mainGenre) mainGenresSet.add(s.mainGenre);
      if (s.subgenres) s.subgenres.forEach(g => subgenresSet.add(g));
      if (s.genres) s.genres.forEach(g => mainGenresSet.add(g));
      else if (s.genre) mainGenresSet.add(s.genre);
      
      const folder = getRootFolder(s.file_path);
      if (folder) rootFoldersSet.add(folder);
    });
    
    return {
      mainGenres: [...mainGenresSet].map(g => ({ label: g, value: g })),
      subgenres: [...subgenresSet].map(g => ({ label: g, value: g })),
      keys: [...new Set(songs.map(s => s.musical_key).filter(Boolean))].map(k => ({ 
        label: k!, 
        value: k!,
        color: k!.includes('minor') ? 'hsl(var(--key-minor))' : 'hsl(var(--key-major))'
      })),
      tags: allTags.map(tag => ({
        label: tag.name,
        value: tag.id,
        color: tag.color
      })),
      rootFolders: [...rootFoldersSet].sort().map(f => ({ label: f, value: f })),
    };
  }, [songs, allTags]);

  // Filtered songs
  const filteredSongs = useMemo(() => {
    const lowerQuery = searchQuery.toLowerCase();
    
    return songs.filter(song => {
      // Global search
      if (lowerQuery) {
        const matchesSearch = 
          song.title.toLowerCase().includes(lowerQuery) ||
          song.artist.toLowerCase().includes(lowerQuery) ||
          song.mainGenre?.toLowerCase().includes(lowerQuery) ||
          song.subgenres?.some(g => g.toLowerCase().includes(lowerQuery)) ||
          song.genres?.some(g => g.toLowerCase().includes(lowerQuery)) ||
          song.genre?.toLowerCase().includes(lowerQuery) ||
          song.musical_key?.toLowerCase().includes(lowerQuery);
        if (!matchesSearch) return false;
      }

      // Column filters
      if (filters.title && !song.title.toLowerCase().includes(filters.title.toLowerCase())) return false;
      if (filters.artist && !song.artist.toLowerCase().includes(filters.artist.toLowerCase())) return false;
      if (filters.album && !song.album?.toLowerCase().includes(filters.album.toLowerCase())) return false;

      // Root folder filter
      if (filters.rootFolder.length > 0) {
        const songFolder = getRootFolder(song.file_path);
        if (!filters.rootFolder.includes(songFolder)) return false;
      }

      if (filters.genre.length > 0) {
        const songMainGenres = [song.mainGenre, ...(song.genres || []), song.genre].filter(Boolean) as string[];
        if (!songMainGenres.some(g => filters.genre.includes(g))) return false;
      }
      
      if (filters.subgenres.length > 0) {
        if (!(song.subgenres || []).some(g => filters.subgenres.includes(g))) return false;
      }
      
      if (filters.key.length > 0 && (!song.musical_key || !filters.key.includes(song.musical_key))) return false;

      if (filters.bpm.min !== undefined && (!song.bpm || song.bpm < filters.bpm.min)) return false;
      if (filters.bpm.max !== undefined && (!song.bpm || song.bpm > filters.bpm.max)) return false;
      if (filters.energy.min !== undefined && song.energy < filters.energy.min) return false;
      if (filters.energy.max !== undefined && song.energy > filters.energy.max) return false;
      if (filters.danceability.min !== undefined && song.danceability < filters.danceability.min) return false;
      if (filters.danceability.max !== undefined && song.danceability > filters.danceability.max) return false;
      if (filters.social.min !== undefined && song.social_acceptance < filters.social.min) return false;
      if (filters.social.max !== undefined && song.social_acceptance > filters.social.max) return false;
      if (filters.duration.min !== undefined && (!song.duration || song.duration < filters.duration.min)) return false;
      if (filters.duration.max !== undefined && (!song.duration || song.duration > filters.duration.max)) return false;

      if (filters.tags.length > 0) {
        const songTagIds = songTags[song.id]?.map(t => t.id) || [];
        if (!filters.tags.some(tagId => songTagIds.includes(tagId))) return false;
      }

      return true;
    });
  }, [songs, searchQuery, filters, songTags]);

  // Detect horizontal overflow of the table (content wider than container).
  // Re-checks when the row count or the visible-column layout changes, and on
  // window resize; the ResizeObserver also catches container resizes.
  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;

    const check = () => setTableOverflows(el.scrollWidth > el.clientWidth);
    check();
    window.addEventListener('resize', check);

    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => {
      window.removeEventListener('resize', check);
      observer.disconnect();
    };
  }, [filteredSongs.length, columnConfig]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-table-border bg-table-header">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-foreground">Library</h1>
          <span className="text-sm text-muted-foreground">
            {songs.length} tracks
          </span>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search tracks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64 h-8 bg-input border-border text-sm"
            />
          </div>
          
          <Button 
            size="sm"
            variant="outline"
            className="h-8 border-border hover:bg-table-row-hover text-xs"
            onClick={() => setColumnSettingsOpen(true)}
          >
            <Settings2 className="w-3 h-3 mr-1" />
            Columns
          </Button>
          
          <Button 
            onClick={handleLoadFiles}
            disabled={loading}
            size="sm"
            variant="outline"
            className="h-8 border-border hover:bg-table-row-hover text-xs"
          >
            <FolderOpen className="w-3 h-3 mr-1" />
            {loading ? 'Loading...' : 'Load Files'}
          </Button>
          <Button 
            size="sm"
            className="h-8 bg-primary hover:bg-primary/90 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="relative flex-1 min-h-0">
        <div ref={tableScrollRef} className="absolute inset-0 overflow-x-auto overflow-y-auto">
          {filteredSongs.length === 0 ? (
            <EmptyState 
              hasSearch={!!searchQuery} 
              onLoadFiles={handleLoadFiles} 
              loading={loading} 
            />
          ) : (
            <div className="w-max min-w-full">
              <SongTableHeader
                columnConfig={columnConfig}
                filters={filters}
                filterOptions={filterOptions}
                onFilterChange={updateFilter}
              />
              
              <div>
                {filteredSongs.map((song, index) => (
                  <SongTableRow
                    key={song.id}
                    song={song}
                    index={index}
                    songTags={songTags[song.id] || []}
                    columnConfig={columnConfig}
                    editingNotes={editingNotes[song.id]}
                    onSongClick={handleSongClick}
                    onPlaySong={(song) => player.play(song)}
                    onEditSong={handleEditSong}
                    onTagsChange={handleTagsChange}
                    onTagCreated={handleTagCreated}
                    onNotesEdit={handleNotesEdit}
                    onNotesBlur={handleNotesBlur}
                    onNotesKeyDown={handleNotesKeyDown}
                    getCurrentNotes={getCurrentNotes}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right-edge affordance: only when content overflows horizontally.
            Positioned outside the scroll container so it stays viewport-anchored. */}
        {tableOverflows && filteredSongs.length > 0 && (
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background/80 to-transparent" />
        )}
      </div>

      {/* Dialogs */}
      <ColumnSettingsDialog
        open={columnSettingsOpen}
        onOpenChange={setColumnSettingsOpen}
        columnConfig={columnConfig}
      />
      
      <EditSongDialog
        song={selectedSongForEdit}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handleSongSaved}
      />
    </div>
  );
}

// Empty state component
function EmptyState({ 
  hasSearch, 
  onLoadFiles, 
  loading 
}: { 
  hasSearch: boolean; 
  onLoadFiles: () => void; 
  loading: boolean; 
}) {
  return (
    <div className="flex flex-col items-center justify-center h-64 bg-table-row">
      <Music2 className="w-8 h-8 text-muted-foreground mb-3" />
      <h3 className="text-sm font-medium mb-1">No tracks found</h3>
      <p className="text-xs text-muted-foreground text-center mb-3">
        {hasSearch 
          ? "Try adjusting your search terms" 
          : "Load audio files to start building your library"}
      </p>
      {!hasSearch && (
        <Button 
          onClick={onLoadFiles}
          disabled={loading}
          size="sm"
          className="bg-primary hover:bg-primary/90 text-xs"
        >
          <FolderOpen className="w-3 h-3 mr-1" />
          Load Audio Files
        </Button>
      )}
    </div>
  );
}
