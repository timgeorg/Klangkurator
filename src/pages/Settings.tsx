import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { storage, Tag } from '@/lib/storage';
import { 
  getGenreConfig, 
  saveGenreConfig, 
  GenreConfig,
  DEFAULT_GENRES
} from '@/lib/genreData';
import { toast } from '@/hooks/use-toast';
import { 
  Settings as SettingsIcon, 
  Tags, 
  Music2, 
  Plus, 
  Pencil, 
  Trash2,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

// Color palette for tags and genres
const TAG_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b',
  '#1e293b', '#78716c'
];

interface EditTagDialogProps {
  tag: Tag | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (tag: Tag) => void;
  isNew?: boolean;
}

function EditTagDialog({ tag, open, onOpenChange, onSave, isNew }: EditTagDialogProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');

  useEffect(() => {
    if (tag) {
      setName(tag.name);
      setColor(tag.color);
    } else {
      setName('');
      setColor('#6366f1');
    }
  }, [tag, open]);

  const handleSave = () => {
    if (!name.trim()) {
      toast({ title: 'Name required', description: 'Please enter a tag name.', variant: 'destructive' });
      return;
    }

    if (isNew) {
      const newTag = storage.addTag({ name: name.trim(), color });
      onSave(newTag);
      toast({ title: 'Tag created', description: `"${name}" has been added.` });
    } else if (tag) {
      const updated = storage.updateTag(tag.id, { name: name.trim(), color });
      if (updated) {
        onSave(updated);
        toast({ title: 'Tag updated', description: `"${name}" has been saved.` });
      }
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Create New Tag' : 'Edit Tag'}</DialogTitle>
          <DialogDescription>
            {isNew ? 'Add a new tag for categorizing your songs.' : 'Update the tag name and color.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="tag-name">Name</Label>
            <Input
              id="tag-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Piano, Sing-Along, Peak Time"
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg border-2 border-border"
                style={{ backgroundColor: color }}
              />
              <div className="flex flex-wrap gap-2">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                      color === c ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="pt-2">
            <Label className="text-muted-foreground text-xs">Preview</Label>
            <div className="mt-2">
              <Badge
                style={{ 
                  backgroundColor: `${color}20`, 
                  borderColor: color,
                  color: color 
                }}
                className="px-3 py-1"
              >
                {name || 'Tag Name'}
              </Badge>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>{isNew ? 'Create Tag' : 'Save Changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Settings() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [genreConfig, setGenreConfig] = useState<GenreConfig[]>([]);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false);
  const [isNewTag, setIsNewTag] = useState(false);
  const [deleteTagId, setDeleteTagId] = useState<string | null>(null);
  
  // Genre editing state
  const [expandedGenres, setExpandedGenres] = useState<Set<string>>(new Set());
  const [isGenreDialogOpen, setIsGenreDialogOpen] = useState(false);
  const [editingGenre, setEditingGenre] = useState<GenreConfig | null>(null);
  const [isNewGenre, setIsNewGenre] = useState(false);
  const [genreName, setGenreName] = useState('');
  const [genreColor, setGenreColor] = useState('#6366f1');
  const [deleteGenreName, setDeleteGenreName] = useState<string | null>(null);
  
  // Subgenre editing state
  const [isSubgenreDialogOpen, setIsSubgenreDialogOpen] = useState(false);
  const [editingSubgenre, setEditingSubgenre] = useState<{ mainGenre: string; subgenre: string } | null>(null);
  const [isNewSubgenre, setIsNewSubgenre] = useState(false);
  const [subgenreName, setSubgenreName] = useState('');
  const [subgenreMainGenre, setSubgenreMainGenre] = useState('');
  const [deleteSubgenre, setDeleteSubgenre] = useState<{ mainGenre: string; subgenre: string } | null>(null);

  useEffect(() => {
    loadTags();
    loadGenreConfig();
  }, []);

  const loadTags = () => {
    setTags(storage.getTags());
  };

  const loadGenreConfig = () => {
    setGenreConfig(getGenreConfig());
  };

  const handleEditTag = (tag: Tag) => {
    setEditingTag(tag);
    setIsNewTag(false);
    setIsTagDialogOpen(true);
  };

  const handleNewTag = () => {
    setEditingTag(null);
    setIsNewTag(true);
    setIsTagDialogOpen(true);
  };

  const handleTagSaved = () => {
    loadTags();
  };

  const handleDeleteTag = (tagId: string) => {
    storage.deleteTag(tagId);
    loadTags();
    setDeleteTagId(null);
    toast({ title: 'Tag deleted', description: 'The tag has been removed.' });
  };

  // Genre handlers
  const toggleGenreExpanded = (genreName: string) => {
    setExpandedGenres(prev => {
      const next = new Set(prev);
      if (next.has(genreName)) {
        next.delete(genreName);
      } else {
        next.add(genreName);
      }
      return next;
    });
  };

  const handleNewGenre = () => {
    setEditingGenre(null);
    setIsNewGenre(true);
    setGenreName('');
    setGenreColor('#6366f1');
    setIsGenreDialogOpen(true);
  };

  const handleEditGenre = (genre: GenreConfig) => {
    setEditingGenre(genre);
    setIsNewGenre(false);
    setGenreName(genre.name);
    setGenreColor(genre.color);
    setIsGenreDialogOpen(true);
  };

  const handleSaveGenre = () => {
    if (!genreName.trim()) {
      toast({ title: 'Name required', description: 'Please enter a genre name.', variant: 'destructive' });
      return;
    }

    const newConfig = [...genreConfig];
    
    if (isNewGenre) {
      if (newConfig.some(g => g.name.toLowerCase() === genreName.trim().toLowerCase())) {
        toast({ title: 'Genre exists', description: 'This genre already exists.', variant: 'destructive' });
        return;
      }
      newConfig.push({ name: genreName.trim(), color: genreColor, subgenres: [] });
      toast({ title: 'Genre created', description: `"${genreName}" has been added.` });
    } else if (editingGenre) {
      const index = newConfig.findIndex(g => g.name === editingGenre.name);
      if (index !== -1) {
        newConfig[index] = { ...newConfig[index], name: genreName.trim(), color: genreColor };
        toast({ title: 'Genre updated', description: `"${genreName}" has been saved.` });
      }
    }
    
    saveGenreConfig(newConfig);
    setGenreConfig(newConfig);
    setIsGenreDialogOpen(false);
  };

  const handleDeleteGenre = (name: string) => {
    const newConfig = genreConfig.filter(g => g.name !== name);
    saveGenreConfig(newConfig);
    setGenreConfig(newConfig);
    setDeleteGenreName(null);
    toast({ title: 'Genre deleted', description: 'The genre and its subgenres have been removed.' });
  };


  // Subgenre handlers
  const handleNewSubgenre = (mainGenre: string) => {
    setEditingSubgenre(null);
    setIsNewSubgenre(true);
    setSubgenreName('');
    setSubgenreMainGenre(mainGenre);
    setIsSubgenreDialogOpen(true);
  };

  const handleEditSubgenre = (mainGenre: string, subgenre: string) => {
    setEditingSubgenre({ mainGenre, subgenre });
    setIsNewSubgenre(false);
    setSubgenreName(subgenre);
    setSubgenreMainGenre(mainGenre);
    setIsSubgenreDialogOpen(true);
  };

  const handleSaveSubgenre = () => {
    if (!subgenreName.trim()) {
      toast({ title: 'Name required', description: 'Please enter a subgenre name.', variant: 'destructive' });
      return;
    }

    const newConfig = [...genreConfig];
    const genreIndex = newConfig.findIndex(g => g.name === subgenreMainGenre);
    
    if (genreIndex === -1) return;

    if (isNewSubgenre) {
      if (newConfig[genreIndex].subgenres.some(s => s.toLowerCase() === subgenreName.trim().toLowerCase())) {
        toast({ title: 'Subgenre exists', description: 'This subgenre already exists.', variant: 'destructive' });
        return;
      }
      newConfig[genreIndex].subgenres.push(subgenreName.trim());
      toast({ title: 'Subgenre created', description: `"${subgenreName}" has been added to ${subgenreMainGenre}.` });
    } else if (editingSubgenre) {
      const subIndex = newConfig[genreIndex].subgenres.indexOf(editingSubgenre.subgenre);
      if (subIndex !== -1) {
        newConfig[genreIndex].subgenres[subIndex] = subgenreName.trim();
        toast({ title: 'Subgenre updated', description: `"${subgenreName}" has been saved.` });
      }
    }
    
    saveGenreConfig(newConfig);
    setGenreConfig(newConfig);
    setIsSubgenreDialogOpen(false);
  };

  const handleDeleteSubgenre = (mainGenre: string, subgenre: string) => {
    const newConfig = [...genreConfig];
    const genreIndex = newConfig.findIndex(g => g.name === mainGenre);
    
    if (genreIndex !== -1) {
      newConfig[genreIndex].subgenres = newConfig[genreIndex].subgenres.filter(s => s !== subgenre);
      saveGenreConfig(newConfig);
      setGenreConfig(newConfig);
    }
    
    setDeleteSubgenre(null);
    toast({ title: 'Subgenre deleted', description: 'The subgenre has been removed.' });
  };

  return (
    <div className="flex flex-col h-full bg-background p-6 overflow-auto">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <SettingsIcon className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground">Manage your tags, genres, and preferences</p>
          </div>
        </div>

        {/* Tags Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tags className="w-5 h-5 text-primary" />
                <CardTitle>Tags</CardTitle>
              </div>
              <Button size="sm" onClick={handleNewTag}>
                <Plus className="w-4 h-4 mr-1" />
                Add Tag
              </Button>
            </div>
            <CardDescription>
              Manage tags for categorizing songs by musical elements, energy, vocals, and more.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tags.length === 0 ? (
              <p className="text-muted-foreground text-sm">No tags created yet. Click "Add Tag" to create your first tag.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="group flex items-center gap-1 rounded-lg border border-border p-1 pr-2 hover:bg-muted/50 transition-colors"
                  >
                    <Badge
                      style={{ 
                        backgroundColor: `${tag.color}20`, 
                        borderColor: tag.color,
                        color: tag.color 
                      }}
                      className="px-2 py-0.5"
                    >
                      {tag.name}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleEditTag(tag)}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                      onClick={() => setDeleteTagId(tag.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Genres Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Music2 className="w-5 h-5 text-primary" />
                <CardTitle>Genres & Subgenres</CardTitle>
              </div>
              <Button size="sm" onClick={handleNewGenre}>
                <Plus className="w-4 h-4 mr-1" />
                Add Genre
              </Button>
            </div>
            <CardDescription>
              Manage main genres and their subgenres. Each song can have one main genre and multiple subgenres.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {genreConfig.map((genre) => (
                  <Collapsible 
                    key={genre.name}
                    open={expandedGenres.has(genre.name)}
                    onOpenChange={() => toggleGenreExpanded(genre.name)}
                  >
                    <div className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-6 h-6 p-0">
                          {expandedGenres.has(genre.name) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      
                      <div 
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: genre.color }}
                      />
                      
                      <span className="font-medium flex-1">{genre.name}</span>
                      
                      <span className="text-xs text-muted-foreground">
                        {genre.subgenres.length} subgenres
                      </span>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-6 h-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditGenre(genre);
                        }}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-6 h-6 p-0 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteGenreName(genre.name);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    
                    <CollapsibleContent>
                      <div className="ml-8 mt-2 mb-4 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {genre.subgenres.map((subgenre) => (
                            <div
                              key={subgenre}
                              className="group flex items-center gap-1 rounded-md border border-border/60 p-1 pr-2 hover:bg-muted/30 transition-colors"
                            >
                              <Badge
                                variant="outline"
                                className="px-2 py-0 text-xs"
                                style={{ 
                                  borderColor: `${genre.color}60`,
                                  color: genre.color 
                                }}
                              >
                                {subgenre}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-5 h-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleEditSubgenre(genre.name, subgenre)}
                              >
                                <Pencil className="w-2.5 h-2.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-5 h-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                                onClick={() => setDeleteSubgenre({ mainGenre: genre.name, subgenre })}
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs"
                          onClick={() => handleNewSubgenre(genre.name)}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add Subgenre
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Edit Tag Dialog */}
      <EditTagDialog
        tag={editingTag}
        open={isTagDialogOpen}
        onOpenChange={setIsTagDialogOpen}
        onSave={handleTagSaved}
        isNew={isNewTag}
      />

      {/* Delete Tag Confirmation */}
      <AlertDialog open={!!deleteTagId} onOpenChange={() => setDeleteTagId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the tag from all songs. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTagId && handleDeleteTag(deleteTagId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Genre Dialog */}
      <Dialog open={isGenreDialogOpen} onOpenChange={setIsGenreDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isNewGenre ? 'Create New Genre' : 'Edit Genre'}</DialogTitle>
            <DialogDescription>
              {isNewGenre ? 'Add a main genre category.' : 'Update the genre name and color.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="genre-name">Name</Label>
              <Input
                id="genre-name"
                value={genreName}
                onChange={(e) => setGenreName(e.target.value)}
                placeholder="e.g., House, Techno, Trance"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-lg border-2 border-border"
                  style={{ backgroundColor: genreColor }}
                />
                <div className="flex flex-wrap gap-2">
                  {TAG_COLORS.map((c) => (
                    <button
                      key={c}
                      className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                        genreColor === c ? 'border-foreground scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                      onClick={() => setGenreColor(c)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="pt-2">
              <Label className="text-muted-foreground text-xs">Preview</Label>
              <div className="mt-2">
                <Badge
                  style={{ 
                    backgroundColor: `${genreColor}20`, 
                    borderColor: genreColor,
                    color: genreColor 
                  }}
                  className="px-3 py-1"
                >
                  {genreName || 'Genre Name'}
                </Badge>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGenreDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveGenre}>{isNewGenre ? 'Create Genre' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Subgenre Dialog */}
      <Dialog open={isSubgenreDialogOpen} onOpenChange={setIsSubgenreDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isNewSubgenre ? 'Create New Subgenre' : 'Edit Subgenre'}</DialogTitle>
            <DialogDescription>
              {isNewSubgenre 
                ? `Add a subgenre to ${subgenreMainGenre}.` 
                : 'Update the subgenre name.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="subgenre-name">Name</Label>
              <Input
                id="subgenre-name"
                value={subgenreName}
                onChange={(e) => setSubgenreName(e.target.value)}
                placeholder="e.g., Deep, Minimal, Melodic"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSubgenreDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSubgenre}>{isNewSubgenre ? 'Create Subgenre' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Genre Confirmation */}
      <AlertDialog open={!!deleteGenreName} onOpenChange={() => setDeleteGenreName(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Genre?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the genre and all its subgenres. Songs using this genre will need to be updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteGenreName && handleDeleteGenre(deleteGenreName)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Subgenre Confirmation */}
      <AlertDialog open={!!deleteSubgenre} onOpenChange={() => setDeleteSubgenre(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subgenre?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the subgenre from {deleteSubgenre?.mainGenre}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteSubgenre && handleDeleteSubgenre(deleteSubgenre.mainGenre, deleteSubgenre.subgenre)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
