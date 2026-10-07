import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Waveform } from '@/components/ui/waveform';
import { EditSongDialog } from '@/components/dj/EditSongDialog';
import { storage, Song, SongRelationship, Tag } from '@/lib/storage';
import { usePlayer } from '@/lib/PlayerContext';
import { getMainGenreColor } from '@/lib/genreData';
import { formatDuration } from '@/lib/trackFormat';
import {
  ArrowLeft, Music2, Play, Pencil, Clock, FileText,
} from 'lucide-react';

/** Song ↔ song relationships rendered on the detail page (PF-17). */
interface RelRow {
  rel: SongRelationship;
  direction: 'source' | 'target';
  otherSong: Song;
}

// Same labels as SongRelationshipsDialog (kept local — dialog is not refactored).
const relationshipLabels: Record<string, { source: string; target: string }> = {
  remix: { source: 'Is Remix Of', target: 'Remixed By' },
  cover: { source: 'Is Cover Of', target: 'Covered By' },
  mashup: { source: 'Is Mashup With', target: 'Mashed Up In' },
  edit: { source: 'Is Edit Of', target: 'Edited By' },
  bootleg: { source: 'Is Bootleg Of', target: 'Bootlegged By' },
  same_sample: { source: 'Uses Same Sample As', target: 'Same Sample Used By' },
  in_playlist: { source: 'In Playlist', target: 'Contains' },
  transition: { source: 'Transitions To', target: 'Transitioned From' },
};

const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '-';

export default function SongDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const player = usePlayer();

  const [song, setSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<Tag[]>([]);
  const [relationships, setRelationships] = useState<RelRow[]>([]);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        // getSong throws on 404 with the remote backend; returns null locally.
        const loaded = await storage.getSong(id ?? '');
        if (cancelled) return;
        setSong(loaded);
        if (loaded) {
          const [loadedTags, allRelationships, allSongs] = await Promise.all([
            storage.getTagsForSong(loaded.id),
            storage.getSongRelationships(),
            storage.getSongs(),
          ]);
          if (cancelled) return;
          setTags(loadedTags);
          setRelationships(
            allRelationships
              .map((rel): RelRow | null => {
                if (rel.source_song_id === loaded.id) {
                  const otherSong = allSongs.find(s => s.id === rel.target_song_id);
                  return otherSong ? { rel, direction: 'source', otherSong } : null;
                }
                if (rel.target_song_id === loaded.id) {
                  const otherSong = allSongs.find(s => s.id === rel.source_song_id);
                  return otherSong ? { rel, direction: 'target', otherSong } : null;
                }
                return null;
              })
              .filter((r): r is RelRow => r !== null)
          );
        }
      } catch {
        // 404 from the remote backend → track not found
        if (!cancelled) setSong(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        Loading track…
      </div>
    );
  }

  if (!song) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Music2 className="w-8 h-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Track not found</p>
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-3 h-3 mr-1" /> Back
        </Button>
      </div>
    );
  }

  const mainGenre = song.mainGenre || song.genre;
  const notes = song.mixing_notes || song.drum_notes || song.element_notes || '';

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Back + header */}
      <div>
        <Button variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>

        <Card className="bg-card/50 border-border">
          <CardContent className="p-5">
            <div className="flex gap-5">
              {song.artwork_url ? (
                <img
                  src={song.artwork_url}
                  alt={song.title}
                  className="w-40 h-40 rounded object-cover bg-muted shrink-0"
                />
              ) : (
                <div className="w-40 h-40 rounded bg-muted flex items-center justify-center shrink-0">
                  <Music2 className="w-16 h-16 text-muted-foreground" />
                </div>
              )}
              <div className="flex flex-col min-w-0 flex-1">
                <h2 className="text-2xl font-bold text-foreground truncate">{song.title}</h2>
                <p className="text-base text-muted-foreground truncate">{song.artist}</p>
                {song.album && <p className="text-sm text-muted-foreground truncate">{song.album}</p>}
                <div className="mt-auto flex gap-2 pt-4">
                  <Button size="sm" className="bg-orange-600 hover:bg-orange-700" onClick={() => player.play(song)}>
                    <Play className="w-3 h-3 mr-1" /> Play
                  </Button>
                  <Button size="sm" variant="outline" className="border-border hover:bg-table-row-hover" onClick={() => setEditOpen(true)}>
                    <Pencil className="w-3 h-3 mr-1" /> Edit
                  </Button>
                </div>
              </div>
            </div>
            {song.waveform_peaks && (
              <div className="mt-4">
                <Waveform variant="full" peaks={song.waveform_peaks} className="w-full h-16" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Metadata grid */}
      <Card className="bg-card/50 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="w-4 h-4" /> Metadata
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">BPM</dt>
              <dd className="text-sm font-medium">{song.bpm ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">Key</dt>
              <dd className="text-sm font-medium">{song.musical_key || '-'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">Main Genre</dt>
              <dd className="text-sm">
                {mainGenre ? (
                  <span
                    className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs"
                    style={{
                      color: getMainGenreColor(mainGenre),
                      borderColor: getMainGenreColor(mainGenre),
                      backgroundColor: `${getMainGenreColor(mainGenre)}20`,
                    }}
                  >
                    {mainGenre}
                  </span>
                ) : '-'}
              </dd>
            </div>
            <div className="col-span-2 md:col-span-3">
              <dt className="text-xs text-muted-foreground mb-0.5">Subgenres</dt>
              <dd className="flex flex-wrap gap-1">
                {song.subgenres?.length ? (
                  song.subgenres.map(g => (
                    <Badge key={g} variant="outline" className="text-xs">
                      {g}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm font-medium">-</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">Root Folder</dt>
              <dd className="text-sm font-medium truncate">{song.root_folder || '-'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">Duration</dt>
              <dd className="text-sm font-medium">{formatDuration(song.duration)}</dd>
            </div>
            <div className="col-span-2 md:col-span-3">
              <dt className="text-xs text-muted-foreground mb-0.5">File Path</dt>
              <dd>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded block truncate" title={song.file_path}>
                  {song.file_path}
                </code>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">Added</dt>
              <dd className="text-sm font-medium">{formatDate(song.created_at)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">Updated</dt>
              <dd className="text-sm font-medium">{formatDate(song.updated_at)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Notes (read-only in v1 — the table's inline editing covers editing) */}
      <Card className="bg-card/50 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="w-4 h-4" /> Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {notes ? (
            <p className="text-sm whitespace-pre-wrap text-foreground">{notes}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Tags (read-only in v1) */}
      <Card className="bg-card/50 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Tags</CardTitle>
        </CardHeader>
        <CardContent>
          {tags.length ? (
            <div className="flex flex-wrap gap-1.5">
              {tags.map(tag => (
                <Badge key={tag.id} variant="outline" style={{ color: tag.color, borderColor: tag.color }}>
                  {tag.name}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No tags.</p>
          )}
        </CardContent>
      </Card>

      {/* Relationships (read-only in v1) */}
      <Card className="bg-card/50 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Relationships</CardTitle>
        </CardHeader>
        <CardContent>
          {relationships.length ? (
            <ul className="space-y-1.5">
              {relationships.map(({ rel, direction, otherSong }) => (
                <li key={rel.id} className="text-sm">
                  <span className="text-muted-foreground">
                    {relationshipLabels[rel.relationship_type]?.[direction] || rel.relationship_type}
                  </span>{' '}
                  <span className="text-muted-foreground">{direction === 'source' ? '→' : '←'}</span>{' '}
                  <button
                    className="text-foreground hover:text-primary transition-colors"
                    onClick={() => navigate(`/song/${otherSong.id}`)}
                  >
                    {otherSong.title}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No relationships.</p>
          )}
        </CardContent>
      </Card>

      <EditSongDialog
        song={song}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={(updated) => setSong(updated)}
      />
    </div>
  );
}