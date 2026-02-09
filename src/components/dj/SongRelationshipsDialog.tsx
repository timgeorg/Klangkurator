import { useState, useCallback, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Song, SongRelationship, SongPlaylistMembership, storage } from '@/lib/storage';
import { Music, ArrowRight, ArrowLeft, List, Network, ChevronLeft, Plus, Trash2, Save, Link2, ListMusic, ChevronsUpDown, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { SongRelationshipGraph } from './SongRelationshipGraph';

interface SongRelationshipsDialogProps {
  song: Song | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
  relationships?: {
    asSource: Array<SongRelationship & { targetSong: Song }>;
    asTarget: Array<SongRelationship & { sourceSong: Song }>;
  };
}

const relationshipTypes = [
  { value: 'remix', label: 'Remix' },
  { value: 'cover', label: 'Cover' },
  { value: 'mashup', label: 'Mashup' },
  { value: 'edit', label: 'Edit' },
  { value: 'bootleg', label: 'Bootleg' },
  { value: 'same_sample', label: 'Same Sample' },
  { value: 'in_playlist', label: 'In Playlist' },
  { value: 'transition', label: 'Transition' },
];

const relationshipLabels: Record<string, { source: string; target: string }> = {
  remix: { source: 'Is Remix Of', target: 'Remixed By' },
  cover: { source: 'Is Cover Of', target: 'Covered By' },
  mashup: { source: 'Is Mashup With', target: 'Mashed Up In' },
  edit: { source: 'Is Edit Of', target: 'Edited By' },
  bootleg: { source: 'Is Bootleg Of', target: 'Bootlegged By' },
  same_sample: { source: 'Uses Same Sample As', target: 'Same Sample Used By' },
  in_playlist: { source: 'In Playlist', target: 'Contains' },
  transition: { source: 'Transitions To', target: 'Transitioned From' },
};

interface ExistingRelationship {
  id: string;
  type: string;
  direction: 'source' | 'target';
  otherSong: Song;
  notes?: string;
}

// Helper to load relationships for a song
function loadRelationshipsForSong(song: Song) {
  const allRelationships = storage.getSongRelationships();
  const allSongs = storage.getSongs();
  
  const asSource = allRelationships
    .filter(rel => rel.source_song_id === song.id)
    .map(rel => ({
      ...rel,
      targetSong: allSongs.find(s => s.id === rel.target_song_id)!
    }))
    .filter(rel => rel.targetSong);
  
  const asTarget = allRelationships
    .filter(rel => rel.target_song_id === song.id)
    .map(rel => ({
      ...rel,
      sourceSong: allSongs.find(s => s.id === rel.source_song_id)!
    }))
    .filter(rel => rel.sourceSong);
  
  return { asSource, asTarget };
}

function toExistingRelationships(song: Song): ExistingRelationship[] {
  const allRelationships = storage.getSongRelationships();
  const allSongs = storage.getSongs();
  const existing: ExistingRelationship[] = [];

  allRelationships.forEach(rel => {
    if (rel.source_song_id === song.id) {
      const targetSong = allSongs.find(s => s.id === rel.target_song_id);
      if (targetSong) {
        existing.push({ id: rel.id, type: rel.relationship_type, direction: 'source', otherSong: targetSong, notes: rel.notes });
      }
    } else if (rel.target_song_id === song.id) {
      const sourceSong = allSongs.find(s => s.id === rel.source_song_id);
      if (sourceSong) {
        existing.push({ id: rel.id, type: rel.relationship_type, direction: 'target', otherSong: sourceSong, notes: rel.notes });
      }
    }
  });

  return existing;
}

export function SongRelationshipsDialog({
  song: initialSong,
  open,
  onOpenChange,
  onSave,
  relationships: initialRelationships,
}: SongRelationshipsDialogProps) {
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [currentRelationships, setCurrentRelationships] = useState<{
    asSource: Array<SongRelationship & { targetSong: Song }>;
    asTarget: Array<SongRelationship & { sourceSong: Song }>;
  } | null>(null);
  const [navigationHistory, setNavigationHistory] = useState<Song[]>([]);

  // Edit state
  const [existingRelationships, setExistingRelationships] = useState<ExistingRelationship[]>([]);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [playlistMemberships, setPlaylistMemberships] = useState<SongPlaylistMembership[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRelationType, setNewRelationType] = useState<string>('');
  const [newTargetSongId, setNewTargetSongId] = useState<string>('');
  const [newNotes, setNewNotes] = useState('');
  const [songSearchOpen, setSongSearchOpen] = useState(false);
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  // Use current navigation state or fall back to initial props
  const song = currentSong || initialSong;
  const relationships = currentRelationships || initialRelationships || { asSource: [], asTarget: [] };

  // Load edit data when song changes
  useEffect(() => {
    if (song && open) {
      const songs = storage.getSongs();
      setAllSongs(songs.filter(s => s.id !== song.id));
      setExistingRelationships(toExistingRelationships(song));
      const memberships = storage.getPlaylistsForSong(song.id);
      setPlaylistMemberships(memberships);
      resetForm();
    }
  }, [song?.id, open]);

  const resetForm = () => {
    setShowAddForm(false);
    setNewRelationType('');
    setNewTargetSongId('');
    setNewNotes('');
    setSongSearchQuery('');
  };

  const refreshRelationships = useCallback(() => {
    if (!song) return;
    const newRels = loadRelationshipsForSong(song);
    setCurrentRelationships(newRels);
    setExistingRelationships(toExistingRelationships(song));
    onSave?.();
  }, [song, onSave]);

  const handleAddRelationship = () => {
    if (!song || !newRelationType || !newTargetSongId) {
      toast({ title: "Missing information", description: "Please select a relationship type and target song.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      storage.addSongRelationship({
        source_song_id: song.id,
        target_song_id: newTargetSongId,
        relationship_type: newRelationType as SongRelationship['relationship_type'],
        notes: newNotes.trim() || undefined,
      });
      toast({ title: "Relationship added", description: "The song relationship has been created." });
      resetForm();
      refreshRelationships();
    } catch (error) {
      toast({ title: "Error adding relationship", description: "Failed to add relationship.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRelationship = (relationshipId: string) => {
    try {
      storage.deleteSongRelationship(relationshipId);
      toast({ title: "Relationship deleted", description: "The song relationship has been removed." });
      refreshRelationships();
    } catch (error) {
      toast({ title: "Error deleting relationship", description: "Failed to delete relationship.", variant: "destructive" });
    }
  };

  const getRelationshipLabel = (type: string, direction: 'source' | 'target') => {
    const labels = relationshipLabels[type];
    if (!labels) return type;
    return direction === 'source' ? labels.source : labels.target;
  };

  // Navigate to a different song in the graph
  const handleNavigateToSong = useCallback((targetSong: Song) => {
    if (!song) return;
    setNavigationHistory(prev => [...prev, song]);
    const newRelationships = loadRelationshipsForSong(targetSong);
    setCurrentSong(targetSong);
    setCurrentRelationships(newRelationships);
  }, [song]);

  // Go back in navigation history
  const handleGoBack = useCallback(() => {
    if (navigationHistory.length === 0) return;
    const previousSong = navigationHistory[navigationHistory.length - 1];
    setNavigationHistory(prev => prev.slice(0, -1));
    const newRelationships = loadRelationshipsForSong(previousSong);
    setCurrentSong(previousSong);
    setCurrentRelationships(newRelationships);
  }, [navigationHistory]);

  // Reset state when dialog closes
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      setCurrentSong(null);
      setCurrentRelationships(null);
      setNavigationHistory([]);
      resetForm();
    }
    onOpenChange(isOpen);
  }, [onOpenChange]);

  // Filter out songs that already have a relationship
  const availableSongs = useMemo(() =>
    allSongs.filter(s => !existingRelationships.some(r => r.otherSong.id === s.id)),
    [allSongs, existingRelationships]
  );

  const filteredSongs = useMemo(() => {
    if (!songSearchQuery.trim()) return availableSongs;
    const query = songSearchQuery.toLowerCase();
    return availableSongs.filter(s =>
      s.title.toLowerCase().includes(query) ||
      s.artist.toLowerCase().includes(query)
    );
  }, [availableSongs, songSearchQuery]);

  const selectedSong = useMemo(() =>
    availableSongs.find(s => s.id === newTargetSongId),
    [availableSongs, newTargetSongId]
  );

  if (!song) return null;

  const hasRelationships = relationships.asSource.length > 0 || relationships.asTarget.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {navigationHistory.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleGoBack} className="h-8 px-2">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              )}
              <DialogTitle className="flex items-center gap-2">
                <Music className="w-5 h-5" />
                {viewMode === 'graph' ? (
                  <span>
                    <span className="text-primary">{song.title}</span>
                    <span className="text-muted-foreground font-normal text-sm ml-2">by {song.artist}</span>
                  </span>
                ) : (
                  'Song Relationships'
                )}
              </DialogTitle>
            </div>
            {hasRelationships && (
              <div className="flex gap-1 mr-6">
                <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className="h-8 px-3">
                  <List className="w-4 h-4 mr-1" />
                  List
                </Button>
                <Button variant={viewMode === 'graph' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('graph')} className="h-8 px-3">
                  <Network className="w-4 h-4 mr-1" />
                  Graph
                </Button>
              </div>
            )}
          </div>
          <DialogDescription>
            {navigationHistory.length > 0
              ? `Exploring from: ${navigationHistory[0].title}`
              : `${song.title} — ${song.artist}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-4 overflow-y-auto">
          {/* Playlist Memberships */}
          {viewMode === 'list' && playlistMemberships.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <ListMusic className="w-4 h-4" />
                In Playlists
              </Label>
              <div className="flex flex-wrap gap-2">
                {playlistMemberships.map((membership) => (
                  <Badge
                    key={membership.playlist.id}
                    variant="outline"
                    style={{
                      borderColor: membership.playlist.color,
                      backgroundColor: `${membership.playlist.color}20`
                    }}
                  >
                    {membership.playlist.name}
                    <span className="ml-1 text-muted-foreground text-xs">(#{membership.position + 1})</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Graph View */}
          {viewMode === 'graph' && hasRelationships && (
            <SongRelationshipGraph
              key={song.id}
              centerSong={song}
              relationships={relationships}
              onNavigateToSong={handleNavigateToSong}
            />
          )}

          {/* List View - Existing Relationships */}
          {viewMode === 'list' && (
            <>
              {existingRelationships.length === 0 && (
                <div className="text-center py-6 text-muted-foreground bg-muted/30 rounded-lg">
                  <Link2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No relationships yet</p>
                </div>
              )}

              {existingRelationships.length > 0 && (
                <div className="space-y-2">
                  {existingRelationships.map((rel) => (
                    <div
                      key={rel.id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border hover:border-primary/50 transition-colors"
                    >
                      <div
                        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                        onClick={() => handleNavigateToSong(rel.otherSong)}
                      >
                        {rel.direction === 'source' ? (
                          <ArrowRight className="w-4 h-4 text-primary flex-shrink-0" />
                        ) : (
                          <ArrowLeft className="w-4 h-4 text-secondary flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="text-xs">
                              {getRelationshipLabel(rel.type, rel.direction)}
                            </Badge>
                          </div>
                          <p className="font-medium truncate">{rel.otherSong.title}</p>
                          <p className="text-sm text-muted-foreground truncate">{rel.otherSong.artist}</p>
                          {rel.notes && (
                            <p className="text-xs text-muted-foreground mt-1 italic truncate">{rel.notes}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                        onClick={() => handleDeleteRelationship(rel.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Relationship */}
              <div className="space-y-3 pt-2 border-t">
                {!showAddForm ? (
                  <Button variant="outline" className="w-full" onClick={() => setShowAddForm(true)} disabled={availableSongs.length === 0}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Relationship
                  </Button>
                ) : (
                  <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Relationship Type</Label>
                        <Select value={newRelationType} onValueChange={setNewRelationType}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {relationshipTypes.map(type => (
                              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Related Song</Label>
                        <Popover open={songSearchOpen} onOpenChange={setSongSearchOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" aria-expanded={songSearchOpen} className="w-full justify-between font-normal">
                              {selectedSong ? (
                                <span className="truncate">{selectedSong.title} - {selectedSong.artist}</span>
                              ) : (
                                <span className="text-muted-foreground">Search songs...</span>
                              )}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0 bg-popover z-50" align="start">
                            <Command shouldFilter={false}>
                              <CommandInput placeholder="Search by title or artist..." value={songSearchQuery} onValueChange={setSongSearchQuery} />
                              <CommandList>
                                <CommandEmpty>No songs found.</CommandEmpty>
                                <CommandGroup>
                                  {filteredSongs.slice(0, 50).map(s => (
                                    <CommandItem
                                      key={s.id}
                                      value={s.id}
                                      onSelect={(value) => {
                                        setNewTargetSongId(value);
                                        setSongSearchOpen(false);
                                        setSongSearchQuery('');
                                      }}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", newTargetSongId === s.id ? "opacity-100" : "opacity-0")} />
                                      <div className="flex flex-col min-w-0">
                                        <span className="truncate font-medium">{s.title}</span>
                                        <span className="truncate text-xs text-muted-foreground">{s.artist}</span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Notes (optional)</Label>
                      <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Add notes about this relationship..." rows={2} />
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={resetForm}>Cancel</Button>
                      <Button size="sm" onClick={handleAddRelationship} disabled={saving || !newRelationType || !newTargetSongId}>
                        <Save className="w-4 h-4 mr-1" />
                        Add
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
