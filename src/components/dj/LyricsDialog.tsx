import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Song, storage } from "@/lib/storage";

interface LyricsDialogProps {
  song: Song | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updatedSong: Song) => void;
}

/** Lyrics save on their own (LY-1), independent of the edit dialog's Save or Cancel. */
export function LyricsDialog({ song, open, onOpenChange, onSave }: LyricsDialogProps) {
  const [lyrics, setLyrics] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (song) setLyrics(song.lyrics || "");
  }, [song]);

  const handleSave = async () => {
    if (!song) return;
    setSaving(true);
    try {
      const updatedSong = await storage.updateSong(song.id, { lyrics: lyrics.trim() || undefined });
      if (!updatedSong) throw new Error("Failed to update song");
      toast({ title: "Lyrics saved", description: `Lyrics for “${updatedSong.title}” have been saved.` });
      onSave(updatedSong);
      onOpenChange(false);
    } catch {
      toast({
        title: "Error saving lyrics",
        description: "The lyrics weren't saved. Check that Klangkurator is still running and try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!song) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>Lyrics</DialogTitle>
          <DialogDescription className="truncate">
            {song.title} — {song.artist}
          </DialogDescription>
        </DialogHeader>

        <Textarea
          aria-label={`Lyrics for ${song.title}`}
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          placeholder="Paste or type the lyrics"
          className="min-h-[360px] flex-1 resize-none font-serif text-[15px] leading-relaxed"
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save lyrics"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
