import { useEffect, useRef, useState } from "react";
import { FileText, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MainGenreSelector } from "@/components/ui/main-genre-selector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { SubgenreSelector } from "@/components/ui/subgenre-selector";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { type Song, type SongPatch, storage } from "@/lib/storage";

import { LyricsDialog } from "./LyricsDialog";
import { SongRelationshipsDialog } from "./SongRelationshipsDialog";

interface EditSongDialogProps {
  song: Song | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updatedSong: Song) => void;
  /** Lyrics or relationships changed from inside this dialog (they save on their own). */
  onDataChange?: () => void;
}

const MUSICAL_KEYS = [
  "C major", "C minor", "C# major", "C# minor",
  "D major", "D minor", "D# major", "D# minor",
  "E major", "E minor",
  "F major", "F minor", "F# major", "F# minor",
  "G major", "G minor", "G# major", "G# minor",
  "A major", "A minor", "A# major", "A# minor",
  "B major", "B minor",
];

const RATINGS = [
  { field: "energy", label: "Energy" },
  { field: "danceability", label: "Danceability" },
  { field: "social_acceptance", label: "Social acceptance" },
] as const;

const NOTES = [
  { field: "mixing_notes", label: "Mixing notes", placeholder: "Where to mix in and out, what to watch for" },
  { field: "drum_notes", label: "Drum notes", placeholder: "Kick, hats, percussion, breaks" },
  { field: "element_notes", label: "Element notes", placeholder: "Vocals, leads, pads, the moments that carry it" },
] as const;

interface FormState {
  title: string;
  artist: string;
  album: string;
  bpm: string;
  musical_key: string;
  mainGenre: string | undefined;
  subgenres: string[];
  year: string;
  energy: number;
  danceability: number;
  social_acceptance: number;
  drum_notes: string;
  element_notes: string;
  mixing_notes: string;
}

const EMPTY_FORM: FormState = {
  title: "",
  artist: "",
  album: "",
  bpm: "",
  musical_key: "",
  mainGenre: undefined,
  subgenres: [],
  year: "",
  energy: 0,
  danceability: 0,
  social_acceptance: 0,
  drum_notes: "",
  element_notes: "",
  mixing_notes: "",
};

export function EditSongDialog({ song, open, onOpenChange, onSave, onDataChange }: EditSongDialogProps) {
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [lyricsDialogOpen, setLyricsDialogOpen] = useState(false);
  const [relationshipsDialogOpen, setRelationshipsDialogOpen] = useState(false);
  const [currentSong, setCurrentSong] = useState<Song | null>(song);

  // The nested lyrics and relationships dialogs read the latest saved song.
  useEffect(() => {
    if (song) setCurrentSong(song);
  }, [song]);

  // Fill the form when the dialog opens or switches to another song, so Cancel
  // discards edits, but not when the same song is refreshed after a nested
  // lyrics or relationship save (that would throw away what was typed here).
  const filledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      filledFor.current = null;
      return;
    }
    if (!song || filledFor.current === song.id) return;
    filledFor.current = song.id;
    setFormData({
      title: song.title || "",
      artist: song.artist || "",
      album: song.album || "",
      bpm: song.bpm?.toString() || "",
      musical_key: song.musical_key || "",
      // Supports the new mainGenre/subgenres and the legacy genres array
      mainGenre: song.mainGenre || song.genres?.[0] || song.genre,
      subgenres: song.subgenres || [],
      year: song.year?.toString() || "",
      energy: song.energy || 0,
      danceability: song.danceability || 0,
      social_acceptance: song.social_acceptance || 0,
      drum_notes: song.drum_notes || "",
      element_notes: song.element_notes || "",
      mixing_notes: song.mixing_notes || "",
    });
  }, [song, open]);

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!song) return;
    setSaving(true);
    try {
      const bpm = parseFloat(formData.bpm);
      const year = parseInt(formData.year, 10);
      // The form holds every field it shows, so an emptied field is sent as
      // null and cleared; the legacy genre fields follow the main genre.
      const updates: SongPatch = {
        title: formData.title.trim(),
        artist: formData.artist.trim(),
        album: formData.album.trim() || null,
        // parseFloat keeps analysed decimals (127.8); parseInt used to truncate them on every save
        bpm: isFinite(bpm) ? Math.round(bpm * 10) / 10 : null,
        musical_key: formData.musical_key || null,
        mainGenre: formData.mainGenre || null,
        subgenres: formData.subgenres,
        // Legacy support
        genres: formData.mainGenre ? [formData.mainGenre, ...formData.subgenres] : null,
        genre: formData.mainGenre || null,
        year: isFinite(year) ? year : null,
        energy: formData.energy,
        danceability: formData.danceability,
        social_acceptance: formData.social_acceptance,
        drum_notes: formData.drum_notes.trim() || null,
        element_notes: formData.element_notes.trim() || null,
        mixing_notes: formData.mixing_notes.trim() || null,
      };

      const updatedSong = await storage.updateSong(song.id, updates);
      if (!updatedSong) throw new Error("Failed to update song");
      toast({ title: "Song updated", description: `“${updatedSong.title}” has been saved.` });
      onSave(updatedSong);
      onOpenChange(false);
    } catch {
      toast({
        title: "Error saving song",
        description: "The changes weren't saved. Check that Klangkurator is still running and try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!song) return null;

  // Keys from file tags or analysis may be in short notation ("Am"); keep them selectable.
  const keyOptions =
    formData.musical_key && !MUSICAL_KEYS.includes(formData.musical_key)
      ? [formData.musical_key, ...MUSICAL_KEYS]
      : MUSICAL_KEYS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit track</DialogTitle>
          <DialogDescription className="truncate">
            {song.title} — {song.artist}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-7">
          <FormSection title="Basics">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="title" label="Title" required>
                <Input id="title" value={formData.title} onChange={(e) => set("title", e.target.value)} />
              </Field>
              <Field id="artist" label="Artist" required>
                <Input id="artist" value={formData.artist} onChange={(e) => set("artist", e.target.value)} />
              </Field>
              <Field id="album" label="Album">
                <Input id="album" value={formData.album} onChange={(e) => set("album", e.target.value)} />
              </Field>
              <Field id="year" label="Year">
                <Input
                  id="year"
                  type="number"
                  inputMode="numeric"
                  className="k-num"
                  value={formData.year}
                  onChange={(e) => set("year", e.target.value)}
                  min="1900"
                  max="2100"
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Musical properties">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="bpm" label="BPM">
                <Input
                  id="bpm"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  className="k-num"
                  value={formData.bpm}
                  onChange={(e) => set("bpm", e.target.value)}
                  placeholder="124"
                  min="40"
                  max="250"
                />
              </Field>
              <Field id="key" label="Key">
                <Select value={formData.musical_key} onValueChange={(value) => set("musical_key", value)}>
                  <SelectTrigger id="key">
                    <SelectValue placeholder="Choose a key" />
                  </SelectTrigger>
                  <SelectContent>
                    {keyOptions.map((key) => (
                      <SelectItem key={key} value={key}>
                        {key}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Main genre">
                <MainGenreSelector
                  selectedGenre={formData.mainGenre}
                  onGenreChange={(genre) =>
                    setFormData((prev) => ({
                      ...prev,
                      mainGenre: genre,
                      // Subgenres belong to a main genre; clear them when it changes
                      subgenres: genre !== prev.mainGenre ? [] : prev.subgenres,
                    }))
                  }
                  size="md"
                />
              </Field>
            </div>
            <Field label="Subgenres">
              <SubgenreSelector
                mainGenre={formData.mainGenre}
                selectedSubgenres={formData.subgenres}
                onSubgenresChange={(subgenres) => set("subgenres", subgenres)}
                size="md"
              />
            </Field>
          </FormSection>

          <FormSection title="Ratings">
            <div className="grid gap-5 sm:grid-cols-3">
              {RATINGS.map(({ field, label }) => (
                <div key={field} className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <Label id={`${field}-label`}>{label}</Label>
                    <span className="k-num text-xs text-muted-foreground">{formData[field]}/5</span>
                  </div>
                  <Slider
                    aria-label={label}
                    value={[formData[field]]}
                    onValueChange={([value]) => set(field, value)}
                    max={5}
                    step={1}
                  />
                </div>
              ))}
            </div>
          </FormSection>

          <FormSection title="Notes">
            {NOTES.map(({ field, label, placeholder }) => (
              <Field key={field} id={field} label={label}>
                <Textarea
                  id={field}
                  value={formData[field]}
                  onChange={(e) => set(field, e.target.value)}
                  placeholder={placeholder}
                  rows={2}
                />
              </Field>
            ))}
          </FormSection>

          <FormSection title="Lyrics and relationships">
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="outline" className="justify-start" onClick={() => setLyricsDialogOpen(true)}>
                <FileText />
                {currentSong?.lyrics ? "View or edit lyrics" : "Add lyrics"}
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => setRelationshipsDialogOpen(true)}>
                <Share2 />
                Manage relationships
              </Button>
            </div>
          </FormSection>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !formData.title.trim() || !formData.artist.trim()}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <LyricsDialog
        song={currentSong}
        open={lyricsDialogOpen}
        onOpenChange={setLyricsDialogOpen}
        onSave={(updated) => {
          setCurrentSong(updated);
          onDataChange?.();
        }}
      />

      <SongRelationshipsDialog
        song={currentSong}
        open={relationshipsDialogOpen}
        onOpenChange={setRelationshipsDialogOpen}
        onSave={() => onDataChange?.()}
      />
    </Dialog>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-t border-border pt-5 first:border-t-0 first:pt-0">
      <h3 className="text-[13px] font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Field({ id, label, required, children }: { id?: string; label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && (
          <span aria-hidden className="text-muted-foreground">
            {" "}
            *
          </span>
        )}
      </Label>
      {children}
    </div>
  );
}
