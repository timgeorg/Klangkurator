import { DJSet, Block, Song, storage } from '@/lib/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit2, Trash2, Music, ArrowRight, Boxes, GitBranch } from 'lucide-react';

interface SetCardProps {
  djSet: DJSet;
  onEdit: (djSet: DJSet) => void;
  onDelete: (djSet: DJSet) => void;
}

export function SetCard({ djSet, onEdit, onDelete }: SetCardProps) {
  const allSongs = storage.getSongs();
  const allBlocks = storage.getBlocks();

  // Count songs and blocks
  const songCount = djSet.items.filter(i => i.type === 'song').length;
  const blockCount = djSet.items.filter(i => i.type === 'block').length;
  
  // Count total songs (including those in blocks)
  let totalSongs = songCount;
  djSet.items.forEach(item => {
    if (item.type === 'block') {
      const block = allBlocks.find(b => b.id === item.block_id);
      if (block) totalSongs += block.songs.length;
    }
  });

  // Count alternatives
  const altCount = djSet.items.reduce((sum, item) => 
    sum + (item.alternative_transitions?.length || 0), 0);

  // Get first few item labels for preview
  const previewItems = djSet.items.slice(0, 4).map(item => {
    if (item.type === 'song') {
      const song = allSongs.find(s => s.id === item.song_id);
      return { type: 'song' as const, label: song?.title || 'Unknown' };
    } else {
      const block = allBlocks.find(b => b.id === item.block_id);
      return { type: 'block' as const, label: block?.name || 'Unknown' };
    }
  });

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: djSet.color }}
            />
            <CardTitle className="text-lg">{djSet.name}</CardTitle>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="sm" onClick={() => onEdit(djSet)}>
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-destructive hover:text-destructive"
              onClick={() => onDelete(djSet)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {djSet.description && (
          <p className="text-sm text-muted-foreground">{djSet.description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Badge variant="secondary">
            <Music className="w-3 h-3 mr-1" />
            {totalSongs} songs
          </Badge>
          {blockCount > 0 && (
            <Badge variant="outline">
              <Boxes className="w-3 h-3 mr-1" />
              {blockCount} blocks
            </Badge>
          )}
          {altCount > 0 && (
            <Badge variant="outline" className="text-primary border-primary/50">
              <GitBranch className="w-3 h-3 mr-1" />
              {altCount} alternatives
            </Badge>
          )}
        </div>
        
        {/* Item chain preview */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {previewItems.map((item, index) => (
            <div key={index} className="flex items-center gap-1 flex-shrink-0">
              <div className={`px-2 py-1 rounded text-xs truncate max-w-[100px] flex items-center gap-1 ${
                item.type === 'block' ? 'bg-primary/20 text-primary' : 'bg-muted'
              }`}>
                {item.type === 'block' && <Boxes className="w-3 h-3" />}
                {item.label}
              </div>
              {index < Math.min(djSet.items.length - 1, 3) && (
                <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              )}
            </div>
          ))}
          {djSet.items.length > 4 && (
            <span className="text-xs text-muted-foreground">+{djSet.items.length - 4} more</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
