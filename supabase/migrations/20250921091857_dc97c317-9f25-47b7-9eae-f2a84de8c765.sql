-- Create songs table with comprehensive metadata
CREATE TABLE public.songs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  bpm INTEGER,
  musical_key TEXT,
  duration INTEGER, -- in seconds
  genre TEXT,
  year INTEGER,
  file_path TEXT,
  artwork_url TEXT,
  
  -- DJ-specific ratings (1-5 scale)
  danceability INTEGER DEFAULT 0 CHECK (danceability >= 0 AND danceability <= 5),
  energy INTEGER DEFAULT 0 CHECK (energy >= 0 AND energy <= 5),
  social_acceptance INTEGER DEFAULT 0 CHECK (social_acceptance >= 0 AND social_acceptance <= 5),
  
  -- Notes about sound characteristics
  drum_notes TEXT,
  element_notes TEXT,
  mixing_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

-- Create policies for songs
CREATE POLICY "Users can view their own songs" 
ON public.songs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own songs" 
ON public.songs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own songs" 
ON public.songs 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own songs" 
ON public.songs 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create tags table
CREATE TABLE public.tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1', -- hex color for tag visualization
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for tags
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tags" 
ON public.tags 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tags" 
ON public.tags 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tags" 
ON public.tags 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tags" 
ON public.tags 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create song_tags junction table
CREATE TABLE public.song_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(song_id, tag_id)
);

-- Enable RLS for song_tags
ALTER TABLE public.song_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own song tags" 
ON public.song_tags 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own song tags" 
ON public.song_tags 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own song tags" 
ON public.song_tags 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create song relationships table for knowledge graph
CREATE TABLE public.song_relationships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  target_song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL, -- 'remix', 'same_sample', 'cover', 'mashup', 'edit', 'bootleg'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(source_song_id, target_song_id, relationship_type)
);

-- Enable RLS for relationships
ALTER TABLE public.song_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own song relationships" 
ON public.song_relationships 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own song relationships" 
ON public.song_relationships 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own song relationships" 
ON public.song_relationships 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own song relationships" 
ON public.song_relationships 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create playlists/sets table
CREATE TABLE public.playlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  is_smart_playlist BOOLEAN DEFAULT false,
  search_criteria JSONB, -- for smart playlists based on filters
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for playlists
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own playlists" 
ON public.playlists 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own playlists" 
ON public.playlists 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own playlists" 
ON public.playlists 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own playlists" 
ON public.playlists 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create playlist_songs junction table
CREATE TABLE public.playlist_songs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(playlist_id, song_id)
);

-- Enable RLS for playlist_songs
ALTER TABLE public.playlist_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own playlist songs" 
ON public.playlist_songs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own playlist songs" 
ON public.playlist_songs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own playlist songs" 
ON public.playlist_songs 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own playlist songs" 
ON public.playlist_songs 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_songs_updated_at
BEFORE UPDATE ON public.songs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_playlists_updated_at
BEFORE UPDATE ON public.playlists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_songs_user_id ON public.songs(user_id);
CREATE INDEX idx_songs_artist ON public.songs(artist);
CREATE INDEX idx_songs_genre ON public.songs(genre);
CREATE INDEX idx_songs_bpm ON public.songs(bpm);
CREATE INDEX idx_songs_energy ON public.songs(energy);
CREATE INDEX idx_songs_danceability ON public.songs(danceability);
CREATE INDEX idx_tags_user_id ON public.tags(user_id);
CREATE INDEX idx_song_tags_song_id ON public.song_tags(song_id);
CREATE INDEX idx_song_tags_tag_id ON public.song_tags(tag_id);
CREATE INDEX idx_song_relationships_source ON public.song_relationships(source_song_id);
CREATE INDEX idx_song_relationships_target ON public.song_relationships(target_song_id);
CREATE INDEX idx_playlists_user_id ON public.playlists(user_id);
CREATE INDEX idx_playlist_songs_playlist_id ON public.playlist_songs(playlist_id);