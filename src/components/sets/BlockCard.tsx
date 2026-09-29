import { useState, useEffect } from 'react';
import { Block, Song, storage } from '@/lib/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit2, Trash2, Music, ArrowRight } from 'lucide-react';

interface BlockCardProps {
  block: Block;
  onEdit: (block: Block) => void;
  onDelete: (block: Block) => void;
}

export function BlockCard({ block, onEdit, onDelete }: BlockCardProps) {
  const [allSongs, setAllSongs] = useState<Song[]>([]);

  useEffect(() => {
    storage.getSongs().then(setAllSongs);
  }, []);

  const songs = block.songs
    .sort((a, b) => a.position - b.position)
    .map(bs => allSongs.find(s => s.id === bs.song_id))
    .filter(Boolean) as Song[];

  // Calculate total duration
  const totalDuration = songs.reduce((sum, s) => sum + (s.duration || 0), 0);
  // Block totals: same mm:ss convention as track durations (minutes unpadded);
  // round first so summed float durations can't yield a 60-second minute.
  const formatDuration = (seconds: number) => {
    const total = Math.round(seconds);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: block.color }}
            />
            <CardTitle className="text-lg">{block.name}</CardTitle>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="sm" onClick={() => onEdit(block)}>
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-destructive hover:text-destructive"
              onClick={() => onDelete(block)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {block.description && (
          <p className="text-sm text-muted-foreground">{block.description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="secondary">
            <Music className="w-3 h-3 mr-1" />
            {songs.length} songs
          </Badge>
          {totalDuration > 0 && (
            <Badge variant="outline">
              {formatDuration(totalDuration)}
            </Badge>
          )}
        </div>
        
        {/* Song chain preview */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {songs.slice(0, 4).map((song, index) => (
            <div key={song.id} className="flex items-center gap-1 flex-shrink-0">
              <div className="px-2 py-1 bg-muted rounded text-xs truncate max-w-[120px]">
                {song.title}
              </div>
              {index < Math.min(songs.length - 1, 3) && (
                <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              )}
            </div>
          ))}
          {songs.length > 4 && (
            <span className="text-xs text-muted-foreground">+{songs.length - 4} more</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
