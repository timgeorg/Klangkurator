import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Song, SongRelationship } from '@/lib/storage';
import { Music, ArrowRight, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SongRelationshipsDialogProps {
  song: Song | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relationships: {
    asSource: Array<SongRelationship & { targetSong: Song }>;
    asTarget: Array<SongRelationship & { sourceSong: Song }>;
  };
}

const relationshipLabels: Record<string, { source: string; target: string }> = {
  remix: { source: 'Is Remix Of', target: 'Remixed By' },
  cover: { source: 'Is Cover Of', target: 'Covered By' },
  mashup: { source: 'Is Mashup With', target: 'Mashed Up In' },
  edit: { source: 'Is Edit Of', target: 'Edited By' },
  bootleg: { source: 'Is Bootleg Of', target: 'Bootlegged By' },
};

export function SongRelationshipsDialog({
  song,
  open,
  onOpenChange,
  relationships,
}: SongRelationshipsDialogProps) {
  if (!song) return null;

  const hasRelationships = 
    relationships.asSource.length > 0 || relationships.asTarget.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="w-5 h-5" />
            Song Relationships
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Song */}
          <div className="p-4 bg-muted/50 rounded-lg border-2 border-primary/20">
            <div className="flex items-center gap-3">
              <Music className="w-8 h-8 text-primary" />
              <div>
                <h3 className="font-semibold text-lg">{song.title}</h3>
                <p className="text-sm text-muted-foreground">{song.artist}</p>
                {song.genre && (
                  <Badge variant="secondary" className="mt-1">
                    {song.genre}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {!hasRelationships && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No relationships found for this song.</p>
            </div>
          )}

          {/* Relationships where this song is the source */}
          {relationships.asSource.length > 0 && (
            <div className="space-y-3">
              {relationships.asSource.map((rel) => {
                const label = relationshipLabels[rel.relationship_type]?.source || 
                  rel.relationship_type;
                
                return (
                  <div
                    key={rel.id}
                    className="p-3 bg-background rounded-lg border hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <ArrowRight className="w-5 h-5 text-primary flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-primary uppercase">
                            {label}
                          </span>
                        </div>
                        <h4 className="font-medium">{rel.targetSong.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {rel.targetSong.artist}
                        </p>
                        {rel.notes && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            {rel.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Relationships where this song is the target */}
          {relationships.asTarget.length > 0 && (
            <div className="space-y-3">
              {relationships.asTarget.map((rel) => {
                const label = relationshipLabels[rel.relationship_type]?.target || 
                  `Has ${rel.relationship_type}`;
                
                return (
                  <div
                    key={rel.id}
                    className="p-3 bg-background rounded-lg border hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <ArrowLeft className="w-5 h-5 text-secondary flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-secondary uppercase">
                            {label}
                          </span>
                        </div>
                        <h4 className="font-medium">{rel.sourceSong.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {rel.sourceSong.artist}
                        </p>
                        {rel.notes && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            {rel.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
