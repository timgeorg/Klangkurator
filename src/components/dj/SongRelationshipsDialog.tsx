import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronLeft, ChevronsUpDown, List, Network, Plus, Trash2 } from "lucide-react";

import { CoverArt } from "@/components/brand";
import { RelationLine } from "@/components/detail/RelationLine";
import { EmptyState } from "@/components/layout/EmptyState";
import { TrackDetails, type PartnerRow } from "@/components/map/TrackDetails";
import { TrackMapCanvas } from "@/components/map/TrackMapCanvas";
import { Button } from "@/components/ui/button";
import { ColorChip } from "@/components/ui/color-chip";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { usePlayer } from "@/lib/PlayerContext";
import { RELATIONSHIP_STYLES, RELATIONSHIP_TYPES, RelationshipType, relationshipPhrase } from "@/lib/relationshipStyle";
import { Song, SongPlaylistMembership, SongRelationship, storage } from "@/lib/storage";
import { trackGenre } from "@/lib/trackFormat";
import { solveLayout, GOLDEN_ANGLE } from "@/lib/trackMap/layout";
import type { MapEdge, MapLink, MapNode, Positions } from "@/lib/trackMap/types";
import { cn } from "@/lib/utils";

interface SongRelationshipsDialogProps {
  song: Song | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a relationship is added or deleted. */
  onSave?: () => void;
}

interface ExistingRelationship {
  id: string;
  type: string;
  direction: "source" | "target";
  otherSong: Song;
  notes?: string;
}

/** The constant pull the dialog's links use: the graph is authored, so `s`
 * is not a similarity — it only spreads the partners around their song. */
const DIALOG_LINK_PULL = 0.2;

/** A ring of seeds so the dialog's partners settle around their song. */
const DIALOG_SEED_RADIUS = 100;

interface DialogGraph {
  nodes: MapNode[];
  links: MapLink[];
  edges: MapEdge[];
  positions: Positions;
  /** The relationship types on screen, in the order the legends list them. */
  legend: string[];
}

/**
 * The dialog's graph: its song and that song's relationship partners, never the
 * whole collection. The song sits at the origin with its partners on a seeded
 * ring; the same canvas renderer and the same headless layout draw it.
 */
function buildDialogGraph(song: Song, partners: readonly ExistingRelationship[]): DialogGraph {
  const seen = new Set<string>([song.id]);
  const others: Song[] = [];
  for (const partner of partners) {
    if (seen.has(partner.otherSong.id)) continue;
    seen.add(partner.otherSong.id);
    others.push(partner.otherSong);
  }

  const nodes: MapNode[] = [song, ...others].map((entry) => ({
    id: entry.id,
    kind: "track",
    label: entry.title,
    coverUrl: entry.artwork_url,
    genreLabel: trackGenre(entry),
  }));

  const edges: MapEdge[] = partners.map((partner) => ({
    source: song.id,
    target: partner.otherSong.id,
    kind: partner.type === "transition" ? "transition" : "relationship",
    relationshipType: partner.type,
  }));

  const links: MapLink[] = others.map((other) => {
    const [source, target] = song.id < other.id ? [song.id, other.id] : [other.id, song.id];
    return { source, target, s: DIALOG_LINK_PULL };
  });

  const seeds: Positions = new Map([[song.id, { x: 0, y: 0 }]]);
  others.forEach((other, index) => {
    const angle = index * GOLDEN_ANGLE - Math.PI / 2;
    const radius = DIALOG_SEED_RADIUS * Math.sqrt(index + 1);
    seeds.set(other.id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  });

  const legend: string[] = [];
  for (const type of RELATIONSHIP_TYPES) {
    if (partners.some((partner) => partner.type === type)) legend.push(type);
  }

  return { nodes, links, edges, positions: solveLayout(nodes, links, seeds), legend };
}

/** The relationships seen from one song, built from the fetched rows. */
function relationshipsFor(song: Song, rels: SongRelationship[], byId: Map<string, Song>): ExistingRelationship[] {
  const existing: ExistingRelationship[] = [];
  for (const rel of rels) {
    if (rel.source_song_id === song.id) {
      const other = byId.get(rel.target_song_id);
      if (!other) continue;
      existing.push({ id: rel.id, type: rel.relationship_type, direction: "source", otherSong: other, notes: rel.notes });
    } else if (rel.target_song_id === song.id) {
      const other = byId.get(rel.source_song_id);
      if (!other) continue;
      existing.push({ id: rel.id, type: rel.relationship_type, direction: "target", otherSong: other, notes: rel.notes });
    }
  }
  return existing;
}

export function SongRelationshipsDialog({ song: initialSong, open, onOpenChange, onSave }: SongRelationshipsDialogProps) {
  const { current, isPlaying, play, toggle } = usePlayer();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"list" | "graph">("list");
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [history, setHistory] = useState<Song[]>([]);

  const [existing, setExisting] = useState<ExistingRelationship[]>([]);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [songIndex, setSongIndex] = useState<Map<string, Song>>(new Map());
  const [allRelationships, setAllRelationships] = useState<SongRelationship[]>([]);
  /** The track the details show; the graph stays centred on its song. */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<SongPlaylistMembership[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newType, setNewType] = useState<string>("");
  const [newTargetId, setNewTargetId] = useState<string>("");
  const [newNotes, setNewNotes] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const song = currentSong || initialSong;

  const resetForm = () => {
    setShowAddForm(false);
    setNewType("");
    setNewTargetId("");
    setNewNotes("");
    setSearchQuery("");
  };

  const loadFor = useCallback(async (target: Song) => {
    const [rels, songs, memberships] = await Promise.all([
      storage.getSongRelationships(),
      storage.getSongs(),
      storage.getPlaylistsForSong(target.id),
    ]);
    const byId = new Map(songs.map((s) => [s.id, s]));
    setExisting(relationshipsFor(target, rels, byId));
    setAllRelationships(rels);
    setSongIndex(byId);
    setAllSongs(songs.filter((s) => s.id !== target.id));
    setPlaylists(memberships);
    // The dialog opens with its song selected, and re-centring selects the new one.
    setSelectedId(target.id);
    setLoaded(true);
  }, []);

  const songId = song?.id;
  useEffect(() => {
    if (!open || !song) return;
    resetForm();
    loadFor(song).catch(() => {
      toast({ title: "Couldn't load relationships", description: "Check that Klangkurator is still running.", variant: "destructive" });
    });
    // song identity changes on every navigation; the id is what matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, songId, loadFor]);

  const refresh = async () => {
    if (!song) return;
    await loadFor(song);
    onSave?.();
  };

  const handleAdd = async () => {
    if (!song || !newType || !newTargetId) {
      toast({ title: "Missing information", description: "Choose a relationship type and a track.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await storage.addSongRelationship({
        source_song_id: song.id,
        target_song_id: newTargetId,
        relationship_type: newType as RelationshipType,
        notes: newNotes.trim() || undefined,
      });
      toast({ title: "Relationship added", description: "The song relationship has been created." });
      resetForm();
      await refresh();
    } catch {
      toast({ title: "Error adding relationship", description: "The relationship wasn't saved.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (relationshipId: string) => {
    try {
      await storage.deleteSongRelationship(relationshipId);
      toast({ title: "Relationship deleted", description: "The song relationship has been removed." });
      await refresh();
    } catch {
      toast({ title: "Error deleting relationship", description: "The relationship is still there.", variant: "destructive" });
    }
  };

  // Re-centre on another song (list row or graph node), with back history
  const navigateTo = useCallback(
    (target: Song) => {
      if (!song || target.id === song.id) return;
      setHistory((prev) => [...prev, song]);
      setCurrentSong(target);
    },
    [song],
  );

  const goBack = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory((prev) => prev.slice(0, -1));
    setCurrentSong(previous);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setCurrentSong(null);
      setHistory([]);
      setViewMode("list");
      setLoaded(false);
      resetForm();
    }
    onOpenChange(isOpen);
  };

  const availableSongs = useMemo(
    () => allSongs.filter((s) => !existing.some((r) => r.otherSong.id === s.id)),
    [allSongs, existing],
  );

  const filteredSongs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return availableSongs;
    return availableSongs.filter((s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
  }, [availableSongs, searchQuery]);

  const selectedSong = useMemo(() => availableSongs.find((s) => s.id === newTargetId), [availableSongs, newTargetId]);

  const graph = useMemo(
    () => (song && viewMode === "graph" ? buildDialogGraph(song, existing) : null),
    [existing, song, viewMode],
  );

  /** The partners of the song on screen, as the details list them. */
  const shownSong = useMemo(() => {
    if (!song) return null;
    if (selectedId === song.id) return song;
    return songIndex.get(selectedId ?? "") ?? existing.find((r) => r.otherSong.id === selectedId)?.otherSong ?? null;
  }, [existing, selectedId, song, songIndex]);

  const shownPartners = useMemo<PartnerRow[]>(() => {
    if (!shownSong) return [];
    // The dialog's own song is not in `allSongs` (it is excluded from the picker),
    // so add it back: a partner's list must include the song the dialog is about.
    const byId = new Map(allSongs.map((s) => [s.id, s]));
    byId.set(shownSong.id, shownSong);
    if (song) byId.set(song.id, song);
    return relationshipsFor(shownSong, allRelationships, byId).map((relationship) => ({
      id: relationship.id,
      song: relationship.otherSong,
      type: relationship.type,
      direction: relationship.direction,
      notes: relationship.notes,
    }));
  }, [allRelationships, allSongs, shownSong, song]);

  const handlePlay = useCallback(
    (target: Song) => {
      if (current?.id === target.id) toggle();
      else play(target);
    },
    [current?.id, play, toggle],
  );

  const openSongPage = (target: Song) => {
    handleOpenChange(false);
    navigate(`/song/${target.id}`);
  };

  if (!song) return null;

  const hasRelationships = existing.length > 0;
  const previous = history[history.length - 1];

  const graphLabel = `Relationships of ${song.title}: ${graph ? graph.nodes.length : 0} tracks`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col">
        <DialogHeader>
          <div className="flex items-center gap-1">
            {previous && (
              <Button variant="ghost" size="icon-sm" onClick={goBack} aria-label={`Back to ${previous.title}`} className="-ml-1.5">
                <ChevronLeft />
              </Button>
            )}
            <DialogTitle>Relationships</DialogTitle>
          </div>
          <DialogDescription className="truncate">
            {history.length > 0 ? `${song.title} — exploring from ${history[0].title}` : `${song.title} — ${song.artist}`}
          </DialogDescription>
        </DialogHeader>

        {hasRelationships && (
          <div role="group" aria-label="View" className="-mt-1 flex gap-1">
            {(["list", "graph"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={viewMode === mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-chip px-3.5 text-[13px] font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  viewMode === mode ? "bg-signal-soft text-signal-text" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {mode === "list" ? <List className="h-3.5 w-3.5" /> : <Network className="h-3.5 w-3.5" />}
                {mode === "list" ? "List" : "Graph"}
              </button>
            ))}
          </div>
        )}

        <div className="-mx-6 min-h-0 flex-1 space-y-5 overflow-y-auto px-6">
          {viewMode === "graph" && hasRelationships && graph ? (
            <div className="space-y-4">
              <div className="h-[24rem] w-full overflow-hidden rounded-lg border border-border">
                <TrackMapCanvas
                  nodes={graph.nodes}
                  edges={graph.edges}
                  positions={graph.positions}
                  selectedId={selectedId}
                  playingId={current?.id ?? null}
                  label={graphLabel}
                  onSelect={setSelectedId}
                />
              </div>
              <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Relationship line styles">
                {graph.legend.map((type) => (
                  <li key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <RelationLine type={type} />
                    {RELATIONSHIP_STYLES[type as RelationshipType]?.label ?? type}
                  </li>
                ))}
              </ul>
              {shownSong && (
                <TrackDetails
                  song={shownSong}
                  partners={shownPartners}
                  isPlaying={current?.id === shownSong.id && isPlaying}
                  onPlay={handlePlay}
                  onSongPage={openSongPage}
                  onShowRelationships={navigateTo}
                  onSelect={setSelectedId}
                />
              )}
            </div>
          ) : (
            <>
              {playlists.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-[13px] font-semibold">In playlists</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {playlists.map((m) => (
                      <ColorChip
                        key={m.playlist.id}
                        size="md"
                        color={m.playlist.color}
                        label={`${m.playlist.name} · #${m.position + 1}`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {loaded && existing.length === 0 && (
                <EmptyState
                  size="inline"
                  arrangement="split"
                  title="No relationships yet."
                  body="Link remixes, edits, shared samples and transitions to see how your tracks connect."
                />
              )}

              {existing.length > 0 && (
                <ul className="divide-y divide-border/70 border-y border-border/70">
                  {existing.map((rel) => (
                    <li key={rel.id} className="flex items-center gap-2 py-2">
                      <button
                        type="button"
                        onClick={() => navigateTo(rel.otherSong)}
                        aria-label={`Show the relationships of ${rel.otherSong.title}`}
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <CoverArt
                          src={rel.otherSong.artwork_url}
                          current={current?.id === rel.otherSong.id}
                          className="h-9 w-9 rounded-[3px]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-xs text-muted-foreground">
                            <RelationLine type={rel.type} />
                            {relationshipPhrase(rel.type, rel.direction)}
                          </span>
                          <span className="block truncate text-[13px] font-medium">{rel.otherSong.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {rel.otherSong.artist}
                            {rel.notes ? ` · ${rel.notes}` : ""}
                          </span>
                        </span>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(rel.id)}
                        aria-label={`Delete the relationship with ${rel.otherSong.title}`}
                        title="Delete"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              {!showAddForm ? (
                <Button variant="outline" onClick={() => setShowAddForm(true)} disabled={!loaded || availableSongs.length === 0}>
                  <Plus />
                  Add a relationship
                </Button>
              ) : (
                <div className="space-y-4 rounded-lg border border-border p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="rel-type">Type</Label>
                      <Select value={newType} onValueChange={setNewType}>
                        <SelectTrigger id="rel-type">
                          <SelectValue placeholder="Choose a type" />
                        </SelectTrigger>
                        <SelectContent>
                          {RELATIONSHIP_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              <span className="flex items-center gap-2">
                                <RelationLine type={type} />
                                {RELATIONSHIP_STYLES[type].label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="rel-song">Track</Label>
                      <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            id="rel-song"
                            variant="outline"
                            role="combobox"
                            aria-expanded={searchOpen}
                            className="w-full justify-between font-normal"
                          >
                            {selectedSong ? (
                              <span className="truncate">
                                {selectedSong.title} — {selectedSong.artist}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Find a track</span>
                            )}
                            <ChevronsUpDown className="text-muted-foreground" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] p-0" align="start">
                          <Command shouldFilter={false}>
                            <CommandInput placeholder="Title or artist" value={searchQuery} onValueChange={setSearchQuery} />
                            <CommandList>
                              <CommandEmpty>No track matches.</CommandEmpty>
                              <CommandGroup>
                                {filteredSongs.slice(0, 50).map((s) => (
                                  <CommandItem
                                    key={s.id}
                                    value={s.id}
                                    onSelect={(value) => {
                                      setNewTargetId(value);
                                      setSearchOpen(false);
                                      setSearchQuery("");
                                    }}
                                  >
                                    <Check className={cn("mr-2 h-3.5 w-3.5 text-signal-text", newTargetId !== s.id && "invisible")} />
                                    <span className="flex min-w-0 flex-col">
                                      <span className="truncate">{s.title}</span>
                                      <span className="truncate text-xs text-muted-foreground">{s.artist}</span>
                                    </span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rel-notes">Notes (optional)</Label>
                    <Textarea
                      id="rel-notes"
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      placeholder="How the two connect, where the transition works"
                      rows={2}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={resetForm}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleAdd} disabled={saving || !newType || !newTargetId}>
                      {saving ? "Adding…" : "Add"}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
