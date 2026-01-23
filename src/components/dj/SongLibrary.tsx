import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Rating } from '@/components/ui/rating';
import { Waveform } from '@/components/ui/waveform';
import { TagSelector } from '@/components/ui/tag-selector';
import { ColumnFilter } from '@/components/ui/column-filter';
import { SongRelationshipsDialog } from './SongRelationshipsDialog';
import { EditSongDialog } from './EditSongDialog';
import { GenreSelector, getGenreColor } from '@/components/ui/genre-selector';
import { storage, Song, Tag } from '@/lib/storage';
import { FileLoader } from '@/lib/fileLoader';
import { toast } from '@/hooks/use-toast';
import { 
  Search, 
  Plus, 
  Music2, 
  Clock, 
  Hash, 
  Zap, 
  FolderOpen, 
  Star,
  Play,
  Volume2,
  ArrowUpDown,
  Filter,
  Pencil,
  Columns,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface FilterState {
  title: string;
  artist: string;
  album: string;
  genre: string[];
  bpm: { min?: number; max?: number };
  key: string[];
  energy: { min?: number; max?: number };
  danceability: { min?: number; max?: number };
  social: { min?: number; max?: number };
  duration: { min?: number; max?: number };
  tags: string[];
}

export function SongLibrary() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [songTags, setSongTags] = useState<{[songId: string]: Tag[]}>({});
  const [editingNotes, setEditingNotes] = useState<{[songId: string]: string}>({});
  const [columnWidths, setColumnWidths] = useState({
    play: 40,
    preview: 80,
    title: 200,
    artist: 150,
    album: 150,
    bpm: 80,
    key: 50,
    genre: 100,
    energy: 80,
    danceability: 60,
    social: 60,
    duration: 80,
    tags: 160,
    lyrics: 120,
    notes: 200
  });
  const [userResized, setUserResized] = useState<{[key: string]: boolean}>({});

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState({
    play: true,
    preview: true,
    title: true,
    artist: true,
    album: true,
    bpm: true,
    key: true,
    genre: true,
    energy: true,
    danceability: true,
    social: true,
    duration: true,
    tags: true,
    lyrics: true,
    notes: true,
  });

  const columnLabels: Record<string, string> = {
    play: 'Play/Edit',
    preview: 'Preview',
    title: 'Title',
    artist: 'Artist',
    album: 'Album',
    bpm: 'BPM',
    key: 'Key',
    genre: 'Genre',
    energy: 'Energy',
    danceability: 'Danceability',
    social: 'Social',
    duration: 'Duration',
    tags: 'Tags',
    lyrics: 'Lyrics',
    notes: 'Notes',
  };

  const toggleColumnVisibility = (column: keyof typeof columnVisibility) => {
    setColumnVisibility(prev => ({ ...prev, [column]: !prev[column] }));
  };

  // Build dynamic grid template based on visible columns
  const getGridTemplate = useMemo(() => {
    const columns: string[] = [];
    if (columnVisibility.play) columns.push(`${columnWidths.play}px`);
    if (columnVisibility.preview) columns.push(`${columnWidths.preview}px`);
    if (columnVisibility.title) columns.push(`${columnWidths.title}px`);
    if (columnVisibility.artist) columns.push(`${columnWidths.artist}px`);
    if (columnVisibility.album) columns.push(`${columnWidths.album}px`);
    if (columnVisibility.bpm) columns.push(`${columnWidths.bpm}px`);
    if (columnVisibility.key) columns.push(`${columnWidths.key}px`);
    if (columnVisibility.genre) columns.push(`${columnWidths.genre}px`);
    if (columnVisibility.energy) columns.push(`${columnWidths.energy}px`);
    if (columnVisibility.danceability) columns.push(`${columnWidths.danceability}px`);
    if (columnVisibility.social) columns.push(`${columnWidths.social}px`);
    if (columnVisibility.duration) columns.push(`${columnWidths.duration}px`);
    if (columnVisibility.tags) columns.push(`${columnWidths.tags}px`);
    if (columnVisibility.lyrics) columns.push(`${columnWidths.lyrics}px`);
    if (columnVisibility.notes) columns.push('1fr');
    return columns.join(' ');
  }, [columnVisibility, columnWidths]);

  // Relationships dialog state
  const [relationshipsDialogOpen, setRelationshipsDialogOpen] = useState(false);
  const [selectedSongForRelationships, setSelectedSongForRelationships] = useState<Song | null>(null);
  const [songRelationships, setSongRelationships] = useState<{
    asSource: Array<any>;
    asTarget: Array<any>;
  }>({ asSource: [], asTarget: [] });

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSongForEdit, setSelectedSongForEdit] = useState<Song | null>(null);

  // Column filters
  const [filters, setFilters] = useState<FilterState>({
    title: '',
    artist: '',
    album: '',
    genre: [],
    bpm: {},
    key: [],
    energy: {},
    danceability: {},
    social: {},
    duration: {},
    tags: []
  });

  useEffect(() => {
    // Force clear any existing data and reload
    console.log('Initializing sample data...');
    loadSongs();
    loadSongTags();
  }, []);

  const loadSongs = () => {
    console.log('Loading songs from storage...');
    const allSongs = storage.getSongs();
    console.log('Found songs:', allSongs.length);
    setSongs(allSongs);
  };

  const loadSongTags = () => {
    const allSongs = storage.getSongs();
    const tagsMap: {[songId: string]: Tag[]} = {};
    
    allSongs.forEach(song => {
      tagsMap[song.id] = storage.getTagsForSong(song.id);
    });
    
    setSongTags(tagsMap);
  };

  const handleTagsChange = (songId: string, tags: Tag[]) => {
    setSongTags(prev => ({
      ...prev,
      [songId]: tags
    }));
  };

  const handleLoadFiles = async () => {
    try {
      setLoading(true);
      const files = await FileLoader.loadAudioFiles();
      
      if (files.length > 0) {
        toast({
          title: "Files loaded successfully",
          description: `Loaded ${files.length} audio files to your library.`,
        });
        
        console.log('Loaded files:', files);
        loadSongs();
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

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getBpmColor = (bpm?: number) => {
    if (!bpm) return 'text-muted-foreground';
    if (bpm < 100) return 'text-bpm-slow bg-bpm-slow/20';
    if (bpm < 130) return 'text-bpm-medium bg-bpm-medium/20';
    return 'text-bpm-fast bg-bpm-fast/20';
  };

  const handleSongClick = (song: Song) => {
    console.log('Clicked song:', song.title, song.id);
    setSelectedSongForRelationships(song);
    
    // Load relationships for this song
    const allRelationships = storage.getSongRelationships();
    const allSongs = storage.getSongs();
    
    console.log('All relationships in storage:', allRelationships.length);
    console.log('Relationships details:', allRelationships);
    console.log('All songs in storage:', allSongs.length);
    
    const asSource = allRelationships
      .filter(rel => {
        const matches = rel.source_song_id === song.id;
        console.log('Checking as source:', {
          relationshipSourceId: rel.source_song_id,
          currentSongId: song.id,
          matches
        });
        return matches;
      })
      .map(rel => ({
        ...rel,
        targetSong: allSongs.find(s => s.id === rel.target_song_id)!
      }))
      .filter(rel => rel.targetSong);
    
    const asTarget = allRelationships
      .filter(rel => {
        const matches = rel.target_song_id === song.id;
        console.log('Checking as target:', {
          relationshipTargetId: rel.target_song_id,
          currentSongId: song.id,
          matches
        });
        return matches;
      })
      .map(rel => ({
        ...rel,
        sourceSong: allSongs.find(s => s.id === rel.source_song_id)!
      }))
      .filter(rel => rel.sourceSong);
    
    console.log('Relationships as source:', asSource.length);
    console.log('Relationships as target:', asTarget.length);
    
    setSongRelationships({ asSource, asTarget });
    setRelationshipsDialogOpen(true);
  };

  const handleEditSong = (song: Song, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedSongForEdit(song);
    setEditDialogOpen(true);
  };

  const handleSongSaved = (updatedSong: Song) => {
    loadSongs();
    loadSongTags();
  };

  // Get unique values for filter options
  const getFilterOptions = () => {
    // Collect all genres from songs (supporting both genres array and legacy genre string)
    const allGenres = new Set<string>();
    songs.forEach(s => {
      if (s.genres) {
        s.genres.forEach(g => allGenres.add(g));
      } else if (s.genre) {
        allGenres.add(s.genre);
      }
    });
    const genres = [...allGenres].map(g => ({ label: g, value: g }));
    const keys = [...new Set(songs.map(s => s.musical_key).filter(Boolean))].map(k => ({ 
      label: k!, 
      value: k!,
      color: k!.includes('minor') ? 'hsl(var(--key-minor))' : 'hsl(var(--key-major))'
    }));
    const allTags = storage.getTags().map(tag => ({
      label: tag.name,
      value: tag.id,
      color: tag.color
    }));

    return { genres, keys, tags: allTags };
  };

  const filterOptions = getFilterOptions();

  // Apply filters with memoization to prevent infinite loops
  const filteredSongs = useMemo(() => {
    const searchFiltered = songs.filter(song => {
      const lowerQuery = searchQuery.toLowerCase();
      const matchesGenre = song.genres?.some(g => g.toLowerCase().includes(lowerQuery)) ||
                           song.genre?.toLowerCase().includes(lowerQuery);
      return song.title.toLowerCase().includes(lowerQuery) ||
        song.artist.toLowerCase().includes(lowerQuery) ||
        matchesGenre ||
        song.musical_key?.toLowerCase().includes(lowerQuery);
    });

    return searchFiltered.filter(song => {
      // Text filters
      if (filters.title && !song.title.toLowerCase().includes(filters.title.toLowerCase())) return false;
      if (filters.artist && !song.artist.toLowerCase().includes(filters.artist.toLowerCase())) return false;
      if (filters.album && !song.album?.toLowerCase().includes(filters.album.toLowerCase())) return false;

      // Multi-select filters - genre now checks against genres array
      if (filters.genre.length > 0) {
        const songGenres = song.genres || (song.genre ? [song.genre] : []);
        if (!songGenres.some(g => filters.genre.includes(g))) return false;
      }
      if (filters.key.length > 0 && (!song.musical_key || !filters.key.includes(song.musical_key))) return false;

      // Range filters
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

      // Tag filters
      if (filters.tags.length > 0) {
        const songTagIds = songTags[song.id]?.map(t => t.id) || [];
        if (!filters.tags.some(tagId => songTagIds.includes(tagId))) return false;
      }

      return true;
    });
  }, [songs, searchQuery, filters, songTags]);

  // Auto-adjust Tags column width when tags are added, unless user resized manually
  useEffect(() => {
    if (userResized.tags) return;
    const maxCount = filteredSongs.reduce((max, s) => {
      const c = songTags[s.id]?.length || 0;
      return c > max ? c : max;
    }, 0);
    const autoWidth = Math.min(360, 160 + Math.max(0, maxCount - 1) * 70);
    setColumnWidths(prev => ({ ...prev, tags: autoWidth }));
  }, [songTags, filteredSongs, userResized.tags]);

  const updateFilter = useCallback((key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleNotesEdit = (songId: string, notes: string) => {
    setEditingNotes(prev => ({ ...prev, [songId]: notes }));
  };

  const handleNotesBlur = (songId: string) => {
    const notes = editingNotes[songId];
    if (notes !== undefined) {
      storage.updateSong(songId, { mixing_notes: notes });
      loadSongs(); // Refresh the songs list
      setEditingNotes(prev => {
        const updated = { ...prev };
        delete updated[songId];
        return updated;
      });
    }
  };

  const handleNotesKeyDown = (e: React.KeyboardEvent, songId: string) => {
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
  };

  const getCurrentNotes = (song: Song) => {
    return song.mixing_notes || song.drum_notes || song.element_notes || '';
  };

  // Generic column resize function
  const startColumnResize = (columnKey: string, e: React.MouseEvent) => {
    setUserResized(prev => ({ ...prev, [columnKey]: true }));
    const startX = e.clientX;
    const startWidth = columnWidths[columnKey as keyof typeof columnWidths];

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const minWidth = columnKey === 'play' ? 40 : columnKey === 'key' ? 50 : 80;
      const maxWidth = columnKey === 'tags' ? 480 : columnKey === 'title' ? 400 : 300;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + delta));
      setColumnWidths(prev => ({ ...prev, [columnKey]: newWidth }));
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

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
          
          {/* Column Visibility Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                size="sm"
                variant="outline"
                className="h-8 border-border hover:bg-table-row-hover text-xs"
              >
                <Columns className="w-3 h-3 mr-1" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {Object.entries(columnVisibility).map(([key, visible]) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={visible}
                  onCheckedChange={() => toggleColumnVisibility(key as keyof typeof columnVisibility)}
                >
                  {columnLabels[key]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
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
      <div className="flex-1 overflow-auto">
        {filteredSongs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 bg-table-row">
            <Music2 className="w-8 h-8 text-muted-foreground mb-3" />
            <h3 className="text-sm font-medium mb-1">No tracks found</h3>
            <p className="text-xs text-muted-foreground text-center mb-3">
              {searchQuery 
                ? "Try adjusting your search terms" 
                : "Load audio files to start building your library"}
            </p>
            {!searchQuery && (
              <Button 
                onClick={handleLoadFiles}
                disabled={loading}
                size="sm"
                className="bg-primary hover:bg-primary/90 text-xs"
              >
                <FolderOpen className="w-3 h-3 mr-1" />
                Load Audio Files
              </Button>
            )}
          </div>
        ) : (
          <div className="min-w-full">
            {/* Table Header */}
            <div className="sticky top-0 z-10 bg-table-header border-b border-table-border">
              <div className="grid gap-2 px-3 py-2 text-xs font-medium text-muted-foreground" style={{
                gridTemplateColumns: getGridTemplate
              }}>
                {columnVisibility.play && (
                  <div className="flex items-center justify-center relative group">
                    <Play className="w-3 h-3" />
                    <div
                      className="absolute -right-1 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-border"
                      onMouseDown={(e) => startColumnResize('play', e)}
                      title="Drag to resize column"
                    />
                  </div>
                )}
                {columnVisibility.preview && (
                  <div className="flex items-center gap-1 relative group">
                    <Volume2 className="w-3 h-3" />
                    Preview
                    <div
                      className="absolute -right-1 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-border"
                      onMouseDown={(e) => startColumnResize('preview', e)}
                      title="Drag to resize column"
                    />
                  </div>
                )}
                {columnVisibility.title && (
                  <div className="flex items-center gap-1 relative group">
                    Title
                    <ArrowUpDown className="w-3 h-3" />
                    <ColumnFilter
                      title="Title"
                      type="text"
                      value={filters.title}
                      onChange={(value) => updateFilter('title', value)}
                      placeholder="Filter titles..."
                    />
                    <div
                      className="absolute -right-1 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-border"
                      onMouseDown={(e) => startColumnResize('title', e)}
                      title="Drag to resize column"
                    />
                  </div>
                )}
                {columnVisibility.artist && (
                  <div className="flex items-center gap-1 relative group">
                    Artist
                    <ArrowUpDown className="w-3 h-3" />
                    <ColumnFilter
                      title="Artist"
                      type="text"
                      value={filters.artist}
                      onChange={(value) => updateFilter('artist', value)}
                      placeholder="Filter artists..."
                    />
                    <div
                      className="absolute -right-1 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-border"
                      onMouseDown={(e) => startColumnResize('artist', e)}
                      title="Drag to resize column"
                    />
                  </div>
                )}
                {columnVisibility.album && (
                  <div className="flex items-center gap-1 relative group">
                    Album
                    <ArrowUpDown className="w-3 h-3" />
                    <ColumnFilter
                      title="Album"
                      type="text"
                      value={filters.album}
                      onChange={(value) => updateFilter('album', value)}
                      placeholder="Filter albums..."
                    />
                    <div
                      className="absolute -right-1 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-border"
                      onMouseDown={(e) => startColumnResize('album', e)}
                      title="Drag to resize column"
                    />
                  </div>
                )}
                {columnVisibility.bpm && (
                  <div className="flex items-center gap-1 relative group">
                    BPM
                    <ArrowUpDown className="w-3 h-3" />
                    <ColumnFilter
                      title="BPM"
                      type="range"
                      value={filters.bpm}
                      onChange={(value) => updateFilter('bpm', value)}
                      min={60}
                      max={200}
                    />
                    <div
                      className="absolute -right-1 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-border"
                      onMouseDown={(e) => startColumnResize('bpm', e)}
                      title="Drag to resize column"
                    />
                  </div>
                )}
                {columnVisibility.key && (
                  <div className="flex items-center gap-1 relative group">
                    Key
                    <ArrowUpDown className="w-3 h-3" />
                    <ColumnFilter
                      title="Key"
                      type="multiselect"
                      value={filters.key}
                      onChange={(value) => updateFilter('key', value)}
                      options={filterOptions.keys}
                    />
                    <div
                      className="absolute -right-1 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-border"
                      onMouseDown={(e) => startColumnResize('key', e)}
                      title="Drag to resize column"
                    />
                  </div>
                )}
                {columnVisibility.genre && (
                  <div className="flex items-center gap-1 relative group">
                    Genre
                    <ColumnFilter
                      title="Genre"
                      type="multiselect"
                      value={filters.genre}
                      onChange={(value) => updateFilter('genre', value)}
                      options={filterOptions.genres}
                    />
                    <div
                      className="absolute -right-1 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-border"
                      onMouseDown={(e) => startColumnResize('genre', e)}
                      title="Drag to resize column"
                    />
                  </div>
                )}
                {columnVisibility.energy && (
                  <div className="flex items-center gap-1 relative group">
                    Energy
                    <ColumnFilter
                      title="Energy"
                      type="range"
                      value={filters.energy}
                      onChange={(value) => updateFilter('energy', value)}
                      min={0}
                      max={5}
                    />
                    <div
                      className="absolute -right-1 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-border"
                      onMouseDown={(e) => startColumnResize('energy', e)}
                      title="Drag to resize column"
                    />
                  </div>
                )}
                {columnVisibility.danceability && (
                  <div className="flex items-center gap-1 relative group">
                    Dance
                    <ColumnFilter
                      title="Danceability"
                      type="range"
                      value={filters.danceability}
                      onChange={(value) => updateFilter('danceability', value)}
                      min={0}
                      max={5}
                    />
                    <div
                      className="absolute -right-1 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-border"
                      onMouseDown={(e) => startColumnResize('danceability', e)}
                      title="Drag to resize column"
                    />
                  </div>
                )}
                {columnVisibility.social && (
                  <div className="flex items-center gap-1 relative group">
                    Social
                    <ColumnFilter
                      title="Social"
                      type="range"
                      value={filters.social}
                      onChange={(value) => updateFilter('social', value)}
                      min={0}
                      max={5}
                    />
                    <div
                      className="absolute -right-1 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-border"
                      onMouseDown={(e) => startColumnResize('social', e)}
                      title="Drag to resize column"
                    />
                  </div>
                )}
                {columnVisibility.duration && (
                  <div className="flex items-center gap-1 relative group">
                    Duration
                    <ColumnFilter
                      title="Duration"
                      type="range"
                      value={filters.duration}
                      onChange={(value) => updateFilter('duration', value)}
                      min={0}
                      max={600}
                    />
                    <div
                      className="absolute -right-1 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-border"
                      onMouseDown={(e) => startColumnResize('duration', e)}
                      title="Drag to resize column"
                    />
                  </div>
                )}
                {columnVisibility.tags && (
                  <div className="flex items-center gap-1 relative group">
                    Tags
                    <ColumnFilter
                      title="Tags"
                      type="multiselect"
                      value={filters.tags}
                      onChange={(value) => updateFilter('tags', value)}
                      options={filterOptions.tags}
                    />
                    <div
                      className="absolute -right-1 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-border"
                      onMouseDown={(e) => startColumnResize('tags', e)}
                      title="Drag to resize Tags column"
                    />
                  </div>
                )}
                {columnVisibility.lyrics && (
                  <div className="flex items-center gap-1 relative group">
                    Lyrics
                    <div
                      className="absolute -right-1 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-border"
                      onMouseDown={(e) => startColumnResize('lyrics', e)}
                      title="Drag to resize column"
                    />
                  </div>
                )}
                {columnVisibility.notes && (
                  <div className="relative group">Notes
                    <div
                      className="absolute -right-1 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-border"
                      onMouseDown={(e) => startColumnResize('notes', e)}
                      title="Drag to resize column"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Table Body */}
            <div>
              {filteredSongs.map((song, index) => {
                return (
                  <div 
                    key={song.id}
                    className={cn(
                      "grid gap-2 px-3 py-2 text-xs border-b border-table-border hover:bg-table-row-hover transition-colors cursor-pointer group",
                      index % 2 === 0 ? "bg-table-row" : "bg-background"
                    )}
                    style={{
                      gridTemplateColumns: getGridTemplate
                    }}
                  >
                    {/* Play/Edit Buttons */}
                    {columnVisibility.play && (
                      <div className="flex items-center justify-center gap-1">
                        <Button size="sm" variant="ghost" className="w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-3 h-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-primary"
                          onClick={(e) => handleEditSong(song, e)}
                          title="Edit song"
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                    
                    {/* Waveform */}
                    {columnVisibility.preview && (
                      <div className="flex items-center">
                        <Waveform className="w-16 h-6" variant="compact" />
                      </div>
                    )}
                    
                    {/* Title */}
                    {columnVisibility.title && (
                      <div 
                        className="flex items-center font-medium text-foreground truncate hover:text-primary cursor-pointer transition-colors"
                        onClick={() => handleSongClick(song)}
                        title="Click to view relationships"
                      >
                        {song.title}
                      </div>
                    )}
                    
                    {/* Artist */}
                    {columnVisibility.artist && (
                      <div className="flex items-center text-foreground truncate">
                        {song.artist}
                      </div>
                    )}
                    
                    {/* Album */}
                    {columnVisibility.album && (
                      <div className="flex items-center text-muted-foreground truncate">
                        {song.album || '-'}
                      </div>
                    )}
                    
                    {/* BPM */}
                    {columnVisibility.bpm && (
                      <div className="flex items-center">
                        {song.bpm ? (
                          <Badge 
                            variant="secondary" 
                            className={cn(
                              "text-xs px-1 py-0 h-5",
                              getBpmColor(song.bpm)
                            )}
                          >
                            {song.bpm}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    )}
                    
                    {/* Key */}
                    {columnVisibility.key && (
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
                    )}
                    
                    {/* Genre */}
                    {columnVisibility.genre && (
                      <div className="flex items-center gap-1 min-w-0 flex-wrap">
                        {(() => {
                          const genres = song.genres || (song.genre ? [song.genre] : []);
                          if (genres.length === 0) {
                            return <span className="text-muted-foreground">-</span>;
                          }
                          return genres.map(genre => (
                            <Badge
                              key={genre}
                              variant="secondary"
                              className="text-[10px] px-1 py-0 h-4 flex-shrink-0"
                              style={{ 
                                backgroundColor: `${getGenreColor(genre)}20`, 
                                borderColor: getGenreColor(genre),
                                color: getGenreColor(genre)
                              }}
                            >
                              {genre}
                            </Badge>
                          ));
                        })()}
                      </div>
                    )}
                    
                    {/* Energy Rating */}
                    {columnVisibility.energy && (
                      <div className="flex items-center">
                        <div className="flex gap-[2px]">
                          {Array.from({ length: 5 }, (_, i) => (
                            <div
                              key={i}
                              className={cn(
                                "w-2 h-2 rounded-full",
                                i < song.energy ? "bg-energy-high" : "bg-muted"
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Danceability Rating */}
                    {columnVisibility.danceability && (
                      <div className="flex items-center">
                        <div className="flex gap-[2px]">
                          {Array.from({ length: 5 }, (_, i) => (
                            <div
                              key={i}
                              className={cn(
                                "w-2 h-2 rounded-full",
                                i < song.danceability ? "bg-accent" : "bg-muted"
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Social Rating */}
                    {columnVisibility.social && (
                      <div className="flex items-center">
                        <div className="flex gap-[2px]">
                          {Array.from({ length: 5 }, (_, i) => (
                            <div
                              key={i}
                              className={cn(
                                "w-2 h-2 rounded-full",
                                i < song.social_acceptance ? "bg-secondary" : "bg-muted"
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Duration */}
                    {columnVisibility.duration && (
                      <div className="flex items-center text-muted-foreground font-mono">
                        {formatDuration(song.duration)}
                      </div>
                    )}
                    
                    {/* Tags */}
                    {columnVisibility.tags && (
                      <div className="flex items-center min-w-0">
                        <TagSelector
                          songId={song.id}
                          selectedTags={songTags[song.id] || []}
                          onTagsChange={(tags) => handleTagsChange(song.id, tags)}
                          size="sm"
                        />
                      </div>
                    )}
                    
                    {/* Lyrics */}
                    {columnVisibility.lyrics && (
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
                    )}
                    
                    {/* Notes */}
                    {columnVisibility.notes && (
                      <div className="flex items-center min-w-0">
                        {editingNotes[song.id] !== undefined ? (
                          <textarea
                            value={editingNotes[song.id]}
                            onChange={(e) => handleNotesEdit(song.id, e.target.value)}
                            onBlur={() => handleNotesBlur(song.id)}
                            onKeyDown={(e) => handleNotesKeyDown(e, song.id)}
                            className="w-full h-6 text-xs bg-input border border-border rounded px-1 py-0 text-foreground resize-none overflow-hidden"
                            autoFocus
                            placeholder="Add notes..."
                          />
                        ) : (
                          <div 
                            className="w-full h-6 flex items-center text-xs text-muted-foreground cursor-text hover:bg-table-row-hover rounded px-1 truncate"
                            onClick={() => handleNotesEdit(song.id, getCurrentNotes(song))}
                            title={getCurrentNotes(song) || 'Click to add notes'}
                          >
                            {getCurrentNotes(song) || 'Click to add notes...'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <SongRelationshipsDialog
        song={selectedSongForRelationships}
        open={relationshipsDialogOpen}
        onOpenChange={setRelationshipsDialogOpen}
        relationships={songRelationships}
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