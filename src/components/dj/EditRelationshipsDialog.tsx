import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Song, SongRelationship, SongPlaylistMembership, storage } from '@/lib/storage';
import { toast } from '@/hooks/use-toast';
import { Link2, Plus, Trash2, Save, X, Music, ListMusic, Search, Check, ChevronsUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface EditRelationshipsDialogProps {
  song: Song | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
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

export function EditRelationshipsDialog({ song, open, onOpenChange, onSave }: EditRelationshipsDialogProps) {
  const [existingRelationships, setExistingRelationships] = useState<ExistingRelationship[]>([]);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [playlistMemberships, setPlaylistMemberships] = useState<SongPlaylistMembership[]>([]);
  const [saving, setSaving] = useState(false);

  // New relationship form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRelationType, setNewRelationType] = useState<string>('');
  const [newTargetSongId, setNewTargetSongId] = useState<string>('');
  const [newNotes, setNewNotes] = useState('');
  const [songSearchOpen, setSongSearchOpen] = useState(false);
  const [songSearchQuery, setSongSearchQuery] = useState('');
  // Load existing relationships and playlist memberships
  useEffect(() => {
    if (song && open) {
      const songs = storage.getSongs();
      setAllSongs(songs.filter(s => s.id !== song.id));

      const relationships = storage.getSongRelationships();
      const existing: ExistingRelationship[] = [];

      relationships.forEach(rel => {
        if (rel.source_song_id === song.id) {
          const targetSong = songs.find(s => s.id === rel.target_song_id);
          if (targetSong) {
            existing.push({
              id: rel.id,
              type: rel.relationship_type,
              direction: 'source',
              otherSong: targetSong,
              notes: rel.notes,
            });
          }
        } else if (rel.target_song_id === song.id) {
          const sourceSong = songs.find(s => s.id === rel.source_song_id);
          if (sourceSong) {
            existing.push({
              id: rel.id,
              type: rel.relationship_type,
              direction: 'target',
              otherSong: sourceSong,
              notes: rel.notes,
            });
          }
        }
      });

      setExistingRelationships(existing);
      
      // Load playlist memberships
      const memberships = storage.getPlaylistsForSong(song.id);
      setPlaylistMemberships(memberships);
      
      resetForm();
    }
  }, [song, open]);

  const resetForm = () => {
    setShowAddForm(false);
    setNewRelationType('');
    setNewTargetSongId('');
    setNewNotes('');
    setSongSearchQuery('');
  };

  const handleAddRelationship = () => {
    if (!song || !newRelationType || !newTargetSongId) {
      toast({
        title: "Missing information",
        description: "Please select a relationship type and target song.",
        variant: "destructive",
      });
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

      // Refresh the list
      const targetSong = allSongs.find(s => s.id === newTargetSongId);
      if (targetSong) {
        setExistingRelationships(prev => [
          ...prev,
          {
            id: crypto.randomUUID(), // Will be replaced on next load
            type: newRelationType,
            direction: 'source',
            otherSong: targetSong,
            notes: newNotes.trim() || undefined,
          }
        ]);
      }

      toast({
        title: "Relationship added",
        description: "The song relationship has been created.",
      });

      resetForm();
      onSave();
    } catch (error) {
      toast({
        title: "Error adding relationship",
        description: "Failed to add relationship. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRelationship = (relationshipId: string) => {
    try {
      storage.deleteSongRelationship(relationshipId);
      setExistingRelationships(prev => prev.filter(r => r.id !== relationshipId));
      
      toast({
        title: "Relationship deleted",
        description: "The song relationship has been removed.",
      });
      
      onSave();
    } catch (error) {
      toast({
        title: "Error deleting relationship",
        description: "Failed to delete relationship. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getRelationshipLabel = (type: string, direction: 'source' | 'target') => {
    const labels = relationshipLabels[type];
    if (!labels) return type;
    return direction === 'source' ? labels.source : labels.target;
  };

  // Filter out songs that already have a relationship
  const availableSongs = useMemo(() => 
    allSongs.filter(s => !existingRelationships.some(r => r.otherSong.id === s.id)),
    [allSongs, existingRelationships]
  );

  // Filter available songs by search query
  const filteredSongs = useMemo(() => {
    if (!songSearchQuery.trim()) return availableSongs;
    const query = songSearchQuery.toLowerCase();
    return availableSongs.filter(s => 
      s.title.toLowerCase().includes(query) || 
      s.artist.toLowerCase().includes(query)
    );
  }, [availableSongs, songSearchQuery]);

  // Get selected song details
  const selectedSong = useMemo(() => 
    availableSongs.find(s => s.id === newTargetSongId),
    [availableSongs, newTargetSongId]
  );

  if (!song) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Edit Relationships
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {song.title} - {song.artist}
          </p>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-4">
          {/* Playlist Memberships */}
          {playlistMemberships.length > 0 && (
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
                    <span className="ml-1 text-muted-foreground text-xs">
                      (#{membership.position + 1})
                    </span>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Existing Relationships */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Song Relationships</Label>
            
            {existingRelationships.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground bg-muted/30 rounded-lg">
                <Link2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No relationships yet</p>
              </div>
            ) : (
              <ScrollArea className="h-[200px]">
                <div className="space-y-2 pr-4">
                  {existingRelationships.map((rel) => (
                    <div
                      key={rel.id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Music className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="text-xs">
                              {getRelationshipLabel(rel.type, rel.direction)}
                            </Badge>
                          </div>
                          <p className="font-medium truncate">{rel.otherSong.title}</p>
                          <p className="text-sm text-muted-foreground truncate">{rel.otherSong.artist}</p>
                          {rel.notes && (
                            <p className="text-xs text-muted-foreground mt-1 italic truncate">
                              {rel.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteRelationship(rel.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Add New Relationship */}
          <div className="space-y-3 pt-2 border-t">
            {!showAddForm ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowAddForm(true)}
                disabled={availableSongs.length === 0}
              >
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
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Related Song</Label>
                    <Popover open={songSearchOpen} onOpenChange={setSongSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={songSearchOpen}
                          className="w-full justify-between font-normal"
                        >
                          {selectedSong ? (
                            <span className="truncate">
                              {selectedSong.title} - {selectedSong.artist}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Search songs...</span>
                          )}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput 
                            placeholder="Search by title or artist..." 
                            value={songSearchQuery}
                            onValueChange={setSongSearchQuery}
                          />
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
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      newTargetSongId === s.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
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
                  <Textarea
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Add notes about this relationship..."
                    rows={2}
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleAddRelationship}
                    disabled={saving || !newRelationType || !newTargetSongId}
                  >
                    <Save className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
