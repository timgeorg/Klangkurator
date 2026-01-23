import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { GenreSelector } from '@/components/ui/genre-selector';
import { Song, storage } from '@/lib/storage';
import { toast } from '@/hooks/use-toast';
import { Music, Save, X, FileText, Link2 } from 'lucide-react';
import { LyricsDialog } from './LyricsDialog';
import { EditRelationshipsDialog } from './EditRelationshipsDialog';

interface EditSongDialogProps {
  song: Song | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updatedSong: Song) => void;
}

const musicalKeys = [
  'C major', 'C minor', 'C# major', 'C# minor',
  'D major', 'D minor', 'D# major', 'D# minor',
  'E major', 'E minor',
  'F major', 'F minor', 'F# major', 'F# minor',
  'G major', 'G minor', 'G# major', 'G# minor',
  'A major', 'A minor', 'A# major', 'A# minor',
  'B major', 'B minor'
];


export function EditSongDialog({ song, open, onOpenChange, onSave }: EditSongDialogProps) {
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    album: '',
    bpm: '',
    musical_key: '',
    genres: [] as string[],
    year: '',
    energy: 0,
    danceability: 0,
    social_acceptance: 0,
    drum_notes: '',
    element_notes: '',
    mixing_notes: ''
  });

  const [saving, setSaving] = useState(false);
  const [lyricsDialogOpen, setLyricsDialogOpen] = useState(false);
  const [relationshipsDialogOpen, setRelationshipsDialogOpen] = useState(false);
  const [currentSong, setCurrentSong] = useState<Song | null>(song);
  // Reset form when song changes
  useEffect(() => {
    if (song) {
      setCurrentSong(song);
      // Support both new genres array and legacy genre string
      const genres = song.genres || (song.genre ? [song.genre] : []);
      setFormData({
        title: song.title || '',
        artist: song.artist || '',
        album: song.album || '',
        bpm: song.bpm?.toString() || '',
        musical_key: song.musical_key || '',
        genres: genres,
        year: song.year?.toString() || '',
        energy: song.energy || 0,
        danceability: song.danceability || 0,
        social_acceptance: song.social_acceptance || 0,
        drum_notes: song.drum_notes || '',
        element_notes: song.element_notes || '',
        mixing_notes: song.mixing_notes || ''
      });
    }
  }, [song]);

  const handleLyricsSave = (updatedSong: Song) => {
    setCurrentSong(updatedSong);
  };

  const handleSave = () => {
    if (!song) return;

    setSaving(true);

    try {
      const updates: Partial<Song> = {
        title: formData.title.trim(),
        artist: formData.artist.trim(),
        album: formData.album.trim() || undefined,
        bpm: formData.bpm ? parseInt(formData.bpm) : undefined,
        musical_key: formData.musical_key || undefined,
        genres: formData.genres.length > 0 ? formData.genres : undefined,
        genre: formData.genres.length > 0 ? formData.genres[0] : undefined, // Legacy support
        year: formData.year ? parseInt(formData.year) : undefined,
        energy: formData.energy,
        danceability: formData.danceability,
        social_acceptance: formData.social_acceptance,
        drum_notes: formData.drum_notes.trim() || undefined,
        element_notes: formData.element_notes.trim() || undefined,
        mixing_notes: formData.mixing_notes.trim() || undefined
      };

      const updatedSong = storage.updateSong(song.id, updates);
      
      if (updatedSong) {
        toast({
          title: "Song updated",
          description: `"${updatedSong.title}" has been saved.`,
        });
        onSave(updatedSong);
        onOpenChange(false);
      } else {
        throw new Error('Failed to update song');
      }
    } catch (error) {
      toast({
        title: "Error saving song",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!song) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="w-5 h-5" />
            Edit Song
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Basic Information</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Song title"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="artist">Artist *</Label>
                <Input
                  id="artist"
                  value={formData.artist}
                  onChange={(e) => handleInputChange('artist', e.target.value)}
                  placeholder="Artist name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="album">Album</Label>
                <Input
                  id="album"
                  value={formData.album}
                  onChange={(e) => handleInputChange('album', e.target.value)}
                  placeholder="Album name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  type="number"
                  value={formData.year}
                  onChange={(e) => handleInputChange('year', e.target.value)}
                  placeholder="Release year"
                  min="1900"
                  max="2100"
                />
              </div>
            </div>
          </div>

          {/* Musical Properties */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Musical Properties</h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bpm">BPM</Label>
                <Input
                  id="bpm"
                  type="number"
                  value={formData.bpm}
                  onChange={(e) => handleInputChange('bpm', e.target.value)}
                  placeholder="120"
                  min="60"
                  max="200"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="key">Key</Label>
                <Select
                  value={formData.musical_key}
                  onValueChange={(value) => handleInputChange('musical_key', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select key" />
                  </SelectTrigger>
                  <SelectContent>
                    {musicalKeys.map(key => (
                      <SelectItem key={key} value={key}>{key}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Genres</Label>
                <GenreSelector
                  selectedGenres={formData.genres}
                  onGenresChange={(genres) => setFormData(prev => ({ ...prev, genres }))}
                  size="md"
                />
              </div>
            </div>
          </div>

          {/* DJ Ratings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">DJ Ratings</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Energy</Label>
                  <span className="text-sm text-muted-foreground">{formData.energy}/5</span>
                </div>
                <Slider
                  value={[formData.energy]}
                  onValueChange={([value]) => handleInputChange('energy', value)}
                  max={5}
                  step={1}
                  className="w-full"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Danceability</Label>
                  <span className="text-sm text-muted-foreground">{formData.danceability}/5</span>
                </div>
                <Slider
                  value={[formData.danceability]}
                  onValueChange={([value]) => handleInputChange('danceability', value)}
                  max={5}
                  step={1}
                  className="w-full"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Social Acceptance</Label>
                  <span className="text-sm text-muted-foreground">{formData.social_acceptance}/5</span>
                </div>
                <Slider
                  value={[formData.social_acceptance]}
                  onValueChange={([value]) => handleInputChange('social_acceptance', value)}
                  max={5}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Notes</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mixing_notes">Mixing Notes</Label>
                <Textarea
                  id="mixing_notes"
                  value={formData.mixing_notes}
                  onChange={(e) => handleInputChange('mixing_notes', e.target.value)}
                  placeholder="Notes about mixing this track..."
                  rows={2}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="drum_notes">Drum Notes</Label>
                <Textarea
                  id="drum_notes"
                  value={formData.drum_notes}
                  onChange={(e) => handleInputChange('drum_notes', e.target.value)}
                  placeholder="Notes about drums and percussion..."
                  rows={2}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="element_notes">Element Notes</Label>
                <Textarea
                  id="element_notes"
                  value={formData.element_notes}
                  onChange={(e) => handleInputChange('element_notes', e.target.value)}
                  placeholder="Notes about musical elements..."
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Lyrics */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Lyrics</h3>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => setLyricsDialogOpen(true)}
            >
              <FileText className="w-4 h-4 mr-2" />
              {currentSong?.lyrics ? 'View / Edit Lyrics' : 'Add Lyrics'}
            </Button>
          </div>

          {/* Relationships */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Relationships</h3>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => setRelationshipsDialogOpen(true)}
            >
              <Link2 className="w-4 h-4 mr-2" />
              Manage Song Relationships
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !formData.title.trim() || !formData.artist.trim()}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>

      <LyricsDialog
        song={currentSong}
        open={lyricsDialogOpen}
        onOpenChange={setLyricsDialogOpen}
        onSave={handleLyricsSave}
      />

      <EditRelationshipsDialog
        song={currentSong}
        open={relationshipsDialogOpen}
        onOpenChange={setRelationshipsDialogOpen}
        onSave={() => {}}
      />
    </Dialog>
  );
}
