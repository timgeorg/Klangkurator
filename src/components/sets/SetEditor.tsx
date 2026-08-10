import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DJSet, SetItem, Block, Song, storage } from '@/lib/storage';
import { toast } from '@/hooks/use-toast';
import { 
  Plus, 
  Trash2, 
  Save, 
  X, 
  Music, 
  ArrowDown, 
  GripVertical,
  LayoutDashboard,
  Boxes,
  GitBranch,
  Lightbulb,
  ChevronDown
} from 'lucide-react';

interface SetEditorProps {
  djSet: DJSet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

interface EnrichedSetItem extends SetItem {
  song?: Song;
  block?: Block;
}

const SET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', 
  '#f97316', '#eab308', '#22c55e', '#06b6d4'
];

export function SetEditor({ djSet, open, onOpenChange, onSave }: SetEditorProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(SET_COLORS[0]);
  const [items, setItems] = useState<EnrichedSetItem[]>([]);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [allBlocks, setAllBlocks] = useState<Block[]>([]);
  const [saving, setSaving] = useState(false);
  const [addType, setAddType] = useState<'song' | 'block'>('song');

  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      loadEditorData();
    }
  }, [djSet, open]);

  const loadEditorData = async () => {
    const [songs, blocks] = await Promise.all([
      storage.getSongs(),
      storage.getBlocks(),
    ]);
    setAllSongs(songs);
    setAllBlocks(blocks);

    if (djSet) {
      setName(djSet.name);
      setDescription(djSet.description || '');
      setColor(djSet.color);
      
      // Enrich items with song/block data
      const enrichedItems = djSet.items
        .sort((a, b) => a.position - b.position)
        .map(item => ({
          ...item,
          song: item.type === 'song' ? songs.find(s => s.id === item.song_id || s.id === item.ref_id) : undefined,
          block: item.type === 'block' ? blocks.find(b => b.id === item.block_id || b.id === item.ref_id) : undefined,
        }));
      setItems(enrichedItems);
    } else {
      setName('');
      setDescription('');
      setColor(SET_COLORS[Math.floor(Math.random() * SET_COLORS.length)]);
      setItems([]);
    }
  };

  const handleAddItem = (id: string, type: 'song' | 'block') => {
    const newItem: EnrichedSetItem = {
      id: crypto.randomUUID(),
      type,
      song_id: type === 'song' ? id : undefined,
      block_id: type === 'block' ? id : undefined,
      position: items.length,
      song: type === 'song' ? allSongs.find(s => s.id === id) : undefined,
      block: type === 'block' ? allBlocks.find(b => b.id === id) : undefined,
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    updated.forEach((item, i) => item.position = i);
    setItems(updated);
  };

  const handleUpdateTransitionNotes = (index: number, notes: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], transition_notes: notes };
    setItems(updated);
  };

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === items.length - 1)
    ) return;

    const updated = [...items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];
    updated.forEach((item, i) => item.position = i);
    setItems(updated);
  };

  const handleAddAlternative = (index: number, songId: string, notes?: string) => {
    const updated = [...items];
    const alternatives = updated[index].alternative_transitions || [];
    alternatives.push({ to_song_id: songId, notes });
    updated[index] = { ...updated[index], alternative_transitions: alternatives };
    setItems(updated);
  };

  const handleRemoveAlternative = (itemIndex: number, altIndex: number) => {
    const updated = [...items];
    const alternatives = [...(updated[itemIndex].alternative_transitions || [])];
    alternatives.splice(altIndex, 1);
    updated[itemIndex] = { 
      ...updated[itemIndex], 
      alternative_transitions: alternatives.length > 0 ? alternatives : undefined 
    };
    setItems(updated);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for this set.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const setData = {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        items: items.map(({ id, type, song_id, block_id, position, transition_notes, alternative_transitions }) => ({
          id,
          type,
          ref_id: song_id || block_id || '',
          song_id,
          block_id,
          position,
          transition_notes,
          alternative_transitions
        }))
      };

      if (djSet) {
        await storage.updateSet(djSet.id, setData);
        toast({ title: "Set updated", description: "Your set has been saved." });
      } else {
        await storage.addSet(setData);
        toast({ title: "Set created", description: "Your new set has been created." });
      }

      onSave();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error saving set",
        description: "Failed to save set. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Get last song in the set for transition suggestions
  const getLastSongId = (): string | null => {
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      if (item.type === 'song' && item.song_id) {
        return item.song_id;
      }
      if (item.type === 'block' && item.block) {
        const lastBlockSong = item.block.songs[item.block.songs.length - 1];
        if (lastBlockSong) return lastBlockSong.song_id;
      }
    }
    return null;
  };

  const transitionSuggestions = getLastSongId() 
    ? storage.getTransitionSuggestions(getLastSongId()!) 
    : [];

  const getItemLabel = (item: EnrichedSetItem): string => {
    if (item.type === 'song' && item.song) {
      return `${item.song.title} - ${item.song.artist}`;
    }
    if (item.type === 'block' && item.block) {
      return `[Block] ${item.block.name}`;
    }
    return 'Unknown';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5" />
            {djSet ? 'Edit Set' : 'Create Set'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-4 overflow-y-auto">
          {/* Set info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Set Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Saturday Night Main Room"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {SET_COLORS.map(c => (
                  <button
                    key={c}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      color === c ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes about this set..."
              rows={2}
            />
          </div>

          {/* Items in set */}
          <div className="space-y-2">
            <Label className="flex items-center justify-between">
              <span>Set Items ({items.length})</span>
              <div className="flex gap-2">
                <Select value={addType} onValueChange={(v) => setAddType(v as 'song' | 'block')}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="song">Song</SelectItem>
                    <SelectItem value="block">Block</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select onValueChange={(id) => handleAddItem(id, addType)} value="">
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder={`Add ${addType}...`} />
                  </SelectTrigger>
                  <SelectContent>
                    {addType === 'song' ? (
                      allSongs.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">No songs available</div>
                      ) : (
                        allSongs.map(song => (
                          <SelectItem key={song.id} value={song.id}>
                            {song.title} - {song.artist}
                          </SelectItem>
                        ))
                      )
                    ) : (
                      allBlocks.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">No blocks available</div>
                      ) : (
                        allBlocks.map(block => (
                          <SelectItem key={block.id} value={block.id}>
                            {block.name} ({block.songs.length} songs)
                          </SelectItem>
                        ))
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            </Label>

            {/* Transition suggestions */}
            {transitionSuggestions.length > 0 && (
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Lightbulb className="w-4 h-4 text-primary" />
                  Suggested Transitions
                </div>
                <div className="flex flex-wrap gap-2">
                  {transitionSuggestions.map(({ song, notes }) => (
                    <Button
                      key={song.id}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleAddItem(song.id, 'song')}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      {song.title}
                      {notes && <span className="ml-1 text-muted-foreground">({notes})</span>}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                <LayoutDashboard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Add songs or blocks to build your set</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2 pr-4">
                  {items.map((item, index) => (
                    <div key={item.id}>
                      {/* Item card */}
                      <div className={`flex items-center gap-2 p-3 rounded-lg border ${
                        item.type === 'block' ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'
                      }`}>
                        <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
                        
                        {item.type === 'block' ? (
                          <Boxes className="w-4 h-4 text-primary" />
                        ) : (
                          <Music className="w-4 h-4 text-muted-foreground" />
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{getItemLabel(item)}</p>
                          {item.type === 'song' && item.song && (
                            <p className="text-xs text-muted-foreground">
                              {item.song.bpm && `${item.song.bpm} BPM`}
                              {item.song.musical_key && ` • ${item.song.musical_key}`}
                            </p>
                          )}
                          {item.type === 'block' && item.block && (
                            <p className="text-xs text-muted-foreground">
                              {item.block.songs.length} songs
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMoveItem(index, 'up')}
                            disabled={index === 0}
                          >
                            ↑
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMoveItem(index, 'down')}
                            disabled={index === items.length - 1}
                          >
                            ↓
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleRemoveItem(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Transition (between items) */}
                      {index < items.length - 1 && (
                        <div className="py-2 pl-4 space-y-2">
                          <div className="flex items-center gap-2">
                            <ArrowDown className="w-4 h-4 text-muted-foreground" />
                            <Input
                              value={item.transition_notes || ''}
                              onChange={(e) => handleUpdateTransitionNotes(index, e.target.value)}
                              placeholder="Transition notes..."
                              className="flex-1 text-sm h-8"
                            />
                            
                            {/* Add alternative button */}
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="text-xs">
                                  <GitBranch className="w-3 h-3 mr-1" />
                                  Alt
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64">
                                <div className="space-y-2">
                                  <Label className="text-xs">Add Alternative Transition</Label>
                                  <Select onValueChange={(songId) => handleAddAlternative(index, songId)}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select song..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {allSongs.map(song => (
                                        <SelectItem key={song.id} value={song.id}>
                                          {song.title} - {song.artist}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                          
                          {/* Show alternatives */}
                          {item.alternative_transitions && item.alternative_transitions.length > 0 && (
                            <div className="ml-8 space-y-1">
                              {item.alternative_transitions.map((alt, altIndex) => {
                                const altSong = allSongs.find(s => s.id === alt.to_song_id);
                                return (
                                  <div key={altIndex} className="flex items-center gap-2 text-xs">
                                    <GitBranch className="w-3 h-3 text-muted-foreground" />
                                    <Badge variant="outline" className="font-normal">
                                      Alt: {altSong?.title || 'Unknown'}
                                    </Badge>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 w-5 p-0 text-destructive"
                                      onClick={() => handleRemoveAlternative(index, altIndex)}
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {djSet ? 'Update Set' : 'Create Set'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
