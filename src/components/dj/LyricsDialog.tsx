import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Song, storage } from '@/lib/storage';
import { toast } from '@/hooks/use-toast';
import { FileText, Save, X } from 'lucide-react';

interface LyricsDialogProps {
  song: Song | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updatedSong: Song) => void;
}

export function LyricsDialog({ song, open, onOpenChange, onSave }: LyricsDialogProps) {
  const [lyrics, setLyrics] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (song) {
      setLyrics(song.lyrics || '');
    }
  }, [song]);

  const handleSave = async () => {
    if (!song) return;

    setSaving(true);

    try {
      const updatedSong = await storage.updateSong(song.id, {
        lyrics: lyrics.trim() || undefined
      });

      if (updatedSong) {
        toast({
          title: "Lyrics saved",
          description: `Lyrics for "${updatedSong.title}" have been saved.`,
        });
        onSave(updatedSong);
        onOpenChange(false);
      } else {
        throw new Error('Failed to update song');
      }
    } catch (error) {
      toast({
        title: "Error saving lyrics",
        description: "Failed to save lyrics. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!song) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Lyrics - {song.title}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{song.artist}</p>
        </DialogHeader>

        <div className="flex-1 min-h-0 py-4">
          <Textarea
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            placeholder="Paste or type lyrics here..."
            className="h-[400px] resize-none font-mono text-sm"
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Lyrics'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
