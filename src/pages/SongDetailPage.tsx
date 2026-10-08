import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Pause, Pencil, Play, Share2 } from "lucide-react";

import { CoverArt } from "@/components/brand";
import { RelationLine } from "@/components/detail/RelationLine";
import { EditSongDialog } from "@/components/dj/EditSongDialog";
import { SongRelationshipsDialog } from "@/components/dj/SongRelationshipsDialog";
import { EmptyState } from "@/components/layout/EmptyState";
import { SectionHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ColorChip } from "@/components/ui/color-chip";
import { Skeleton } from "@/components/ui/skeleton";
import { Waveform } from "@/components/ui/waveform";
import { getMainGenreColor } from "@/lib/genreData";
import { usePlayer } from "@/lib/PlayerContext";
import { relationshipPhrase } from "@/lib/relationshipStyle";
import { storage, Song, SongRelationship, Tag } from "@/lib/storage";
import { crateOf, formatBpm, formatDuration, keyName, splitTitle } from "@/lib/trackFormat";

/** A relationship seen from this song (PF-17). */
interface RelRow {
  rel: SongRelationship;
  direction: "source" | "target";
  otherSong: Song;
}

const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "–";

const NOTE_FIELDS = [
  { key: "mixing_notes", label: "Mixing" },
  { key: "drum_notes", label: "Drums" },
  { key: "element_notes", label: "Elements" },
] as const;

export default function SongDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { current, isPlaying, play, toggle } = usePlayer();

  const [song, setSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<Tag[]>([]);
  const [relationships, setRelationships] = useState<RelRow[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [relationsOpen, setRelationsOpen] = useState(false);
  const requestRef = useRef(0);

  const load = useCallback(
    async (showSkeleton: boolean) => {
      const request = ++requestRef.current;
      if (showSkeleton) setLoading(true);
      try {
        // getSong throws on 404 with the remote backend; returns null locally.
        const loaded = await storage.getSong(id ?? "");
        if (request !== requestRef.current) return;
        setSong(loaded);
        if (loaded) {
          const [loadedTags, allRelationships, allSongs] = await Promise.all([
            storage.getTagsForSong(loaded.id),
            storage.getSongRelationships(),
            storage.getSongs(),
          ]);
          if (request !== requestRef.current) return;
          const byId = new Map(allSongs.map((s) => [s.id, s]));
          setTags(loadedTags);
          setRelationships(
            allRelationships
              .map((rel): RelRow | null => {
                if (rel.source_song_id === loaded.id) {
                  const otherSong = byId.get(rel.target_song_id);
                  return otherSong ? { rel, direction: "source", otherSong } : null;
                }
                if (rel.target_song_id === loaded.id) {
                  const otherSong = byId.get(rel.source_song_id);
                  return otherSong ? { rel, direction: "target", otherSong } : null;
                }
                return null;
              })
              .filter((r): r is RelRow => r !== null),
          );
        }
      } catch {
        // 404 from the remote backend: track not found
        if (request === requestRef.current) setSong(null);
      } finally {
        if (request === requestRef.current) setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    load(true);
  }, [load]);

  if (loading) return <DetailSkeleton />;

  if (!song) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <EmptyState
          arrangement="split"
          title="This track isn’t in the library."
          body="It may have been removed from the library file, or the link points at a track from another library."
          action={
            <Button asChild>
              <Link to="/">Back to Library</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const isCurrent = current?.id === song.id;
  const { main, version } = splitTitle(song.title);
  const genre = song.mainGenre || song.genres?.[0] || song.genre;
  const crate = crateOf(song);
  const notes = NOTE_FIELDS.map((f) => ({ ...f, text: (song[f.key] ?? "").trim() })).filter((n) => n.text);

  return (
    <div className="mx-auto w-full max-w-5xl px-5 pb-20 pt-5 md:px-8 md:pt-7">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 rounded-sm text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" />
        Library
      </Link>

      <article className="mt-6">
        <header className="grid gap-8 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)] md:items-end">
          <CoverArt
            src={song.artwork_url}
            current={isCurrent}
            eager
            className="aspect-square w-full max-w-[300px] rounded-lg"
            iconClassName="h-16 w-16"
          />
          <div className="min-w-0">
            <h1 className="k-display-sm break-words">{main}</h1>
            {version && <p className="mt-2 break-words font-serif text-xl text-muted-foreground">{version}</p>}
            <p className="mt-4 text-lg text-foreground/90">{song.artist}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-muted-foreground">
              {genre && <ColorChip size="md" color={getMainGenreColor(genre)} label={genre} />}
              {song.year ? <span className="k-num">{song.year}</span> : null}
              {crate && <span className="truncate">{crate}</span>}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button onClick={() => (isCurrent ? toggle() : play(song))}>
                {isCurrent && isPlaying ? <Pause /> : <Play />}
                {isCurrent && isPlaying ? "Pause" : "Play"}
              </Button>
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil />
                Edit
              </Button>
              <Button variant="outline" onClick={() => setRelationsOpen(true)}>
                <Share2 />
                Relationships
              </Button>
            </div>
          </div>
        </header>

        <Waveform variant="full" peaks={song.waveform_peaks} active={isCurrent} className="mt-10 h-20 w-full" />

        <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-border pt-8 sm:grid-cols-3 lg:grid-cols-4">
          <Spec label="BPM">{formatBpm(song.bpm)}</Spec>
          <Spec label="Key">
            {song.musical_key ? (
              <>
                {song.musical_key}
                <span className="ml-2 font-sans text-xs text-muted-foreground">{keyName(song.musical_key)}</span>
              </>
            ) : (
              "–"
            )}
          </Spec>
          <Spec label="Duration">{formatDuration(song.duration)}</Spec>
          <Spec label="Year">{song.year ?? "–"}</Spec>
          <Spec label="Genre" mono={false}>
            {genre ? <ColorChip size="md" color={getMainGenreColor(genre)} label={genre} /> : "–"}
          </Spec>
          <Spec label="Subgenres" mono={false}>
            {song.subgenres?.length ? song.subgenres.join(" · ") : "–"}
          </Spec>
          <Spec label="Crate" mono={false}>
            {crate || "–"}
          </Spec>
          <Spec label="Album" mono={false}>
            {song.album || "–"}
          </Spec>
          <Spec label="Added">{formatDate(song.created_at)}</Spec>
          <Spec label="Updated">{formatDate(song.updated_at)}</Spec>
          <div className="col-span-2 min-w-0 sm:col-span-3 lg:col-span-2">
            <dt className="k-label text-muted-foreground">File</dt>
            <dd className="k-num mt-2 truncate text-xs text-foreground/80" title={song.file_path}>
              {song.file_path}
            </dd>
          </div>
        </dl>

        <section aria-labelledby="notes-heading" className="mt-12 border-t border-border pt-8">
          <SectionHeader
            title={<span id="notes-heading">Notes</span>}
            actions={
              notes.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil />
                  Edit notes
                </Button>
              )
            }
          />
          {notes.length > 0 ? (
            <div className="mt-6 grid gap-8 md:grid-cols-2">
              {notes.map((n) => (
                <figure key={n.key} className="min-w-0">
                  <figcaption className="k-label text-muted-foreground">{n.label}</figcaption>
                  <p className="k-prose mt-3 whitespace-pre-wrap">{n.text}</p>
                </figure>
              ))}
            </div>
          ) : (
            <EmptyState
              size="inline"
              arrangement="orbit"
              className="mt-5"
              title="No notes yet."
              body="Write down where to mix in, what the drums do and which elements carry the track, so you never have to re-listen before a gig."
              action={
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  Add notes
                </Button>
              }
            />
          )}
        </section>

        <section aria-labelledby="tags-heading" className="mt-12 border-t border-border pt-8">
          <SectionHeader title={<span id="tags-heading">Tags</span>} count={tags.length || undefined} />
          {tags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <ColorChip key={tag.id} size="md" color={tag.color} label={tag.name} />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-[13px] text-muted-foreground">No tags yet. Add them in the library table.</p>
          )}
        </section>

        <section aria-labelledby="relations-heading" className="mt-12 border-t border-border pt-8">
          <SectionHeader
            title={<span id="relations-heading">Relationships</span>}
            count={relationships.length || undefined}
            actions={
              relationships.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setRelationsOpen(true)}>
                  Manage
                </Button>
              )
            }
          />
          {relationships.length > 0 ? (
            <ul className="mt-4 divide-y divide-border/70 border-y border-border/70">
              {relationships.map(({ rel, direction, otherSong }) => (
                <li key={rel.id} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-1 py-3 sm:grid-cols-[11rem_auto_minmax(0,1fr)]">
                  <span className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground sm:col-span-1">
                    <RelationLine type={rel.relationship_type} />
                    {relationshipPhrase(rel.relationship_type, direction)}
                  </span>
                  <CoverArt src={otherSong.artwork_url} current={current?.id === otherSong.id} className="h-8 w-8 rounded-[3px]" />
                  <span className="min-w-0">
                    <Link
                      to={`/song/${otherSong.id}`}
                      className="block truncate rounded-sm text-[13px] font-medium hover:text-signal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {otherSong.title}
                    </Link>
                    <span className="block truncate text-xs text-muted-foreground">
                      {otherSong.artist}
                      {rel.notes ? ` · ${rel.notes}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              size="inline"
              arrangement="stack"
              className="mt-5"
              title="No relationships yet."
              body="Link remixes, edits, shared samples and transitions to see how your tracks connect."
              action={
                <Button variant="outline" size="sm" onClick={() => setRelationsOpen(true)}>
                  Add a relationship
                </Button>
              }
            />
          )}
        </section>
      </article>

      <EditSongDialog
        song={song}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={(updated) => {
          setSong(updated);
          load(false);
        }}
        onDataChange={() => load(false)}
      />
      <SongRelationshipsDialog
        song={song}
        open={relationsOpen}
        onOpenChange={(open) => {
          setRelationsOpen(open);
          if (!open) load(false);
        }}
        onSave={() => load(false)}
      />
    </div>
  );
}

function Spec({ label, children, mono = true }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="k-label text-muted-foreground">{label}</dt>
      <dd className={mono ? "k-num mt-2 truncate text-[15px]" : "mt-2 truncate text-[15px]"}>{children}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the track" className="mx-auto w-full max-w-5xl px-5 pb-20 pt-5 md:px-8 md:pt-7">
      <Skeleton className="h-4 w-16" />
      <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)] md:items-end">
        <Skeleton className="aspect-square w-full max-w-[300px] rounded-lg" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-9 w-64" />
        </div>
      </div>
      <Skeleton className="mt-10 h-20 w-full" />
      <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    </div>
  );
}
