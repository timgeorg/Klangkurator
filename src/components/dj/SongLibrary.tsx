import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Rating } from '@/components/ui/rating';
import { EnergyBar } from '@/components/ui/energy-bar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { toast } from '@/hooks/use-toast';
import { Search, Plus, Music2, Clock, Hash, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  bpm?: number;
  musical_key?: string;
  genre?: string;
  year?: number;
  duration?: number;
  danceability: number;
  energy: number;
  social_acceptance: number;
  drum_notes?: string;
  element_notes?: string;
  mixing_notes?: string;
}

export function SongLibrary() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadSongs();
    }
  }, [user]);

  const loadSongs = async () => {
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSongs(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading songs",
        description: error.message,
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
    if (bpm < 100) return 'text-bpm-slow';
    if (bpm < 130) return 'text-bpm-medium';
    return 'text-bpm-fast';
  };

  const filteredSongs = songs.filter(song =>
    song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    song.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
    song.genre?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    song.musical_key?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Music2 className="w-8 h-8 text-primary mx-auto mb-2 animate-pulse" />
          <p className="text-muted-foreground">Loading your music library...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Music Library
          </h1>
          <p className="text-muted-foreground">
            {songs.length} tracks in your collection
          </p>
        </div>
        <Button className="bg-gradient-primary hover:shadow-glow">
          <Plus className="w-4 h-4 mr-2" />
          Add Song
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Search by title, artist, genre, or key..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-card border-border"
        />
      </div>

      {/* Song Grid */}
      <div className="grid gap-4">
        {filteredSongs.length === 0 ? (
          <Card className="bg-gradient-card border-border/50 shadow-card">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Music2 className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No songs found</h3>
              <p className="text-muted-foreground text-center">
                {searchQuery 
                  ? "Try adjusting your search terms" 
                  : "Start building your DJ database by adding your first song"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredSongs.map((song) => (
            <Card 
              key={song.id} 
              className="bg-gradient-card border-border/50 hover:shadow-elevated transition-all duration-300 hover:-translate-y-1"
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  {/* Waveform placeholder */}
                  <div className="w-16 h-12 bg-gradient-waveform rounded opacity-20 flex-shrink-0" />
                  
                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-lg truncate">{song.title}</h3>
                        <p className="text-muted-foreground truncate">{song.artist}</p>
                        {song.album && (
                          <p className="text-sm text-muted-foreground truncate">{song.album}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {song.bpm && (
                          <Badge variant="secondary" className={cn("text-xs", getBpmColor(song.bpm))}>
                            {song.bpm} BPM
                          </Badge>
                        )}
                        {song.musical_key && (
                          <Badge variant="outline" className="text-xs">
                            {song.musical_key}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Ratings */}
                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Zap className="w-3 h-3 text-energy-high" />
                          <span className="text-xs text-muted-foreground">Energy</span>
                        </div>
                        <Rating 
                          value={song.energy} 
                          readonly 
                          size="sm" 
                          variant="energy"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Music2 className="w-3 h-3 text-accent" />
                          <span className="text-xs text-muted-foreground">Dance</span>
                        </div>
                        <Rating 
                          value={song.danceability} 
                          readonly 
                          size="sm" 
                          variant="danceability"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Hash className="w-3 h-3 text-secondary" />
                          <span className="text-xs text-muted-foreground">Social</span>
                        </div>
                        <Rating 
                          value={song.social_acceptance} 
                          readonly 
                          size="sm" 
                          variant="social"
                        />
                      </div>
                    </div>

                    {/* Additional info */}
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-4">
                        {song.genre && (
                          <span className="flex items-center gap-1">
                            <Music2 className="w-3 h-3" />
                            {song.genre}
                          </span>
                        )}
                        {song.year && <span>{song.year}</span>}
                      </div>
                      {song.duration && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(song.duration)}
                        </div>
                      )}
                    </div>
                    
                    {/* Notes preview */}
                    {(song.drum_notes || song.element_notes) && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {song.drum_notes && (
                          <div>Drums: {song.drum_notes.substring(0, 50)}...</div>
                        )}
                        {song.element_notes && (
                          <div>Elements: {song.element_notes.substring(0, 50)}...</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}