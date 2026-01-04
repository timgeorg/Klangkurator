import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Block, BlockSong, Song, storage } from '@/lib/storage';
import { toast } from '@/hooks/use-toast';
import { 
  Plus, 
  Trash2, 
  Save, 
  X, 
  Music, 
  ArrowDown, 
  GripVertical,
  Boxes
} from 'lucide-react';

interface BlockEditorProps {
  block: Block | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

const BLOCK_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', 
  '#f97316', '#eab308', '#22c55e', '#06b6d4'
];

export function BlockEditor({ block, open, onOpenChange, onSave }: BlockEditorProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(BLOCK_COLORS[0]);
  const [blockSongs, setBlockSongs] = useState<(BlockSong & { song?: Song })[]>([]);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [saving, setSaving] = useState(false);

  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      const songs = storage.getSongs();
      setAllSongs(songs);

      if (block) {
        setName(block.name);
        setDescription(block.description || '');
        setColor(block.color);
        
        // Load block songs with song data
        const enrichedSongs = block.songs
          .sort((a, b) => a.position - b.position)
          .map(bs => ({
            ...bs,
            song: songs.find(s => s.id === bs.song_id)
          }));
        setBlockSongs(enrichedSongs);
      } else {
        setName('');
        setDescription('');
        setColor(BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)]);
        setBlockSongs([]);
      }
    }
  }, [block, open]);

  const handleAddSong = (songId: string) => {
    const song = allSongs.find(s => s.id === songId);
    if (!song) return;

    const newBlockSong: BlockSong & { song?: Song } = {
      song_id: songId,
      position: blockSongs.length,
      song
    };
    setBlockSongs([...blockSongs, newBlockSong]);
  };

  const handleRemoveSong = (index: number) => {
    const updated = blockSongs.filter((_, i) => i !== index);
    // Reorder positions
    updated.forEach((bs, i) => bs.position = i);
    setBlockSongs(updated);
  };

  const handleUpdateTransitionNotes = (index: number, notes: string) => {
    const updated = [...blockSongs];
    updated[index] = { ...updated[index], transition_notes: notes };
    setBlockSongs(updated);
  };

  const handleMoveSong = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === blockSongs.length - 1)
    ) return;

    const updated = [...blockSongs];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];
    
    // Update positions
    updated.forEach((bs, i) => bs.position = i);
    setBlockSongs(updated);
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for this block.",
        variant: "destructive",
      });
      return;
    }

    if (blockSongs.length < 2) {
      toast({
        title: "At least 2 songs required",
        description: "A block needs at least 2 songs to define a transition.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const blockData = {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        songs: blockSongs.map(({ song_id, position, transition_notes }) => ({
          song_id,
          position,
          transition_notes
        }))
      };

      if (block) {
        storage.updateBlock(block.id, blockData);
        toast({ title: "Block updated", description: "Your block has been saved." });
      } else {
        storage.addBlock(blockData);
        toast({ title: "Block created", description: "Your new block has been created." });
      }

      onSave();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error saving block",
        description: "Failed to save block. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Songs not yet in this block
  const availableSongs = allSongs.filter(
    s => !blockSongs.some(bs => bs.song_id === s.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Boxes className="w-5 h-5" />
            {block ? 'Edit Block' : 'Create Block'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-4 overflow-y-auto">
          {/* Block info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Block Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Peak Time Opener"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {BLOCK_COLORS.map(c => (
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
              placeholder="Notes about when to use this block..."
              rows={2}
            />
          </div>

          {/* Song chain */}
          <div className="space-y-2">
            <Label className="flex items-center justify-between">
              <span>Songs in Block ({blockSongs.length})</span>
              <Select onValueChange={handleAddSong} value="">
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Add song..." />
                </SelectTrigger>
                <SelectContent>
                  {availableSongs.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">No songs available</div>
                  ) : (
                    availableSongs.map(song => (
                      <SelectItem key={song.id} value={song.id}>
                        {song.title} - {song.artist}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </Label>

            {blockSongs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                <Music className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Add songs to create your block</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2 pr-4">
                  {blockSongs.map((bs, index) => (
                    <div key={`${bs.song_id}-${index}`}>
                      {/* Song card */}
                      <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg border">
                        <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{bs.song?.title || 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {bs.song?.artist || 'Unknown Artist'}
                            {bs.song?.bpm && ` • ${bs.song.bpm} BPM`}
                            {bs.song?.musical_key && ` • ${bs.song.musical_key}`}
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMoveSong(index, 'up')}
                            disabled={index === 0}
                          >
                            ↑
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMoveSong(index, 'down')}
                            disabled={index === blockSongs.length - 1}
                          >
                            ↓
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleRemoveSong(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Transition notes (between songs) */}
                      {index < blockSongs.length - 1 && (
                        <div className="flex items-center gap-2 py-2 pl-8">
                          <ArrowDown className="w-4 h-4 text-muted-foreground" />
                          <Input
                            value={bs.transition_notes || ''}
                            onChange={(e) => handleUpdateTransitionNotes(index, e.target.value)}
                            placeholder="Transition notes (e.g., 'mix at 2:30, 8-bar blend')"
                            className="flex-1 text-sm h-8"
                          />
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
            {block ? 'Update Block' : 'Create Block'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
