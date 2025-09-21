import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Rating } from '@/components/ui/rating';
import { Waveform } from '@/components/ui/waveform';
import { TagSelector } from '@/components/ui/tag-selector';
import { ColumnFilter } from '@/components/ui/column-filter';
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
  Filter
} from 'lucide-react';
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
    notes: 200
  });
  const [userResized, setUserResized] = useState<{[key: string]: boolean}>({});

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
    loadSongs();
    loadSongTags();
  }, []);

  const loadSongs = () => {
    const allSongs = storage.getSongs();
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

  // Get unique values for filter options
  const getFilterOptions = () => {
    const genres = [...new Set(songs.map(s => s.genre).filter(Boolean))].map(g => ({ label: g!, value: g! }));
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

  // Apply filters
  const applyFilters = (songs: Song[]) => {
    return songs.filter(song => {
      // Text filters
      if (filters.title && !song.title.toLowerCase().includes(filters.title.toLowerCase())) return false;
      if (filters.artist && !song.artist.toLowerCase().includes(filters.artist.toLowerCase())) return false;
      if (filters.album && !song.album?.toLowerCase().includes(filters.album.toLowerCase())) return false;

      // Multi-select filters
      if (filters.genre.length > 0 && (!song.genre || !filters.genre.includes(song.genre))) return false;
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
  };

  const filteredSongs = applyFilters(
    songs.filter(song =>
      song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.genre?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.musical_key?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

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

  const updateFilter = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

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
                gridTemplateColumns: `${columnWidths.play}px ${columnWidths.preview}px ${columnWidths.title}px ${columnWidths.artist}px ${columnWidths.album}px ${columnWidths.bpm}px ${columnWidths.key}px ${columnWidths.genre}px ${columnWidths.energy}px ${columnWidths.danceability}px ${columnWidths.social}px ${columnWidths.duration}px ${columnWidths.tags}px 1fr`
              }}>
                <div className="flex items-center justify-center relative group">
                  <Play className="w-3 h-3" />
                  <div
                    className="absolute -right-1 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-border"
                    onMouseDown={(e) => startColumnResize('play', e)}
                    title="Drag to resize column"
                  />
                </div>
                <div className="flex items-center gap-1 relative group">
                  <Volume2 className="w-3 h-3" />
                  Preview
                  <div
                    className="absolute -right-1 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-border"
                    onMouseDown={(e) => startColumnResize('preview', e)}
                    title="Drag to resize column"
                  />
                </div>
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
                <div className="relative group">Notes
                  <div
                    className="absolute -right-1 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-border"
                    onMouseDown={(e) => startColumnResize('notes', e)}
                    title="Drag to resize column"
                  />
                </div>
              </div>
            </div>

            {/* Table Body */}
            <div>
              {filteredSongs.map((song, index) => {
                // using shared tagsColWidth for all rows
                
                return (
                  <div 
                    key={song.id}
                    className={cn(
                      "grid gap-2 px-3 py-2 text-xs border-b border-table-border hover:bg-table-row-hover transition-colors cursor-pointer group",
                      index % 2 === 0 ? "bg-table-row" : "bg-background"
                    )}
                    style={{
                      gridTemplateColumns: `${columnWidths.play}px ${columnWidths.preview}px ${columnWidths.title}px ${columnWidths.artist}px ${columnWidths.album}px ${columnWidths.bpm}px ${columnWidths.key}px ${columnWidths.genre}px ${columnWidths.energy}px ${columnWidths.danceability}px ${columnWidths.social}px ${columnWidths.duration}px ${columnWidths.tags}px 1fr`
                    }}
                  >
                    {/* Play Button */}
                    <div className="flex items-center justify-center">
                      <Button size="sm" variant="ghost" className="w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-3 h-3" />
                      </Button>
                    </div>
                    
                    {/* Waveform */}
                    <div className="flex items-center">
                      <Waveform className="w-16 h-6" variant="compact" />
                    </div>
                    
                    {/* Title */}
                    <div className="flex items-center font-medium text-foreground truncate">
                      {song.title}
                    </div>
                    
                    {/* Artist */}
                    <div className="flex items-center text-foreground truncate">
                      {song.artist}
                    </div>
                    
                    {/* Album */}
                    <div className="flex items-center text-muted-foreground truncate">
                      {song.album || '-'}
                    </div>
                    
                    {/* BPM */}
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
                    
                    {/* Key */}
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
                    
                    {/* Genre */}
                    <div className="flex items-center text-muted-foreground truncate">
                      {song.genre || '-'}
                    </div>
                    
                    {/* Energy Rating */}
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
                    
                    {/* Danceability Rating */}
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
                    
                    {/* Social Rating */}
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
                    
                    {/* Duration */}
                    <div className="flex items-center text-muted-foreground font-mono">
                      {formatDuration(song.duration)}
                    </div>
                    
                    {/* Tags */}
                    <div className="flex items-center min-w-0">
                      <TagSelector
                        songId={song.id}
                        selectedTags={songTags[song.id] || []}
                        onTagsChange={(tags) => handleTagsChange(song.id, tags)}
                        size="sm"
                      />
                    </div>
                    
                    {/* Notes */}
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
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}