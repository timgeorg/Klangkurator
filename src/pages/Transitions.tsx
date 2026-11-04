// Transitions page (issue #82, REQ-19-TL, -TA, -TM, -TI). One store: a
// transition is a relationship of the transition type. This page lists every
// transition the library holds — the saved ones, and the consecutive tracks of
// blocks and sets that `buildTransitions` finds — and lets the user add, edit
// and delete the saved ones.
//
// A side is a library track or a typed track: the typed side is how a
// transition is saved before both tracks are owned, and the link action
// replaces it with a real track once one is.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Pencil, Plus, Trash2 } from "lucide-react";

import { RelationLine } from "@/components/detail/RelationLine";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { TrackPicker } from "@/components/sets/TrackPicker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CoverArt } from "@/components/brand";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiStatus, describeApiError } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { TRANSITION_TYPE_ID } from "@/lib/relationshipTypes";
import { storage, type Block, type DJSet, type Song, type SongRelationship } from "@/lib/storage";
import { buildTransitions } from "@/lib/trackMap/transitions";
import {
  buildTransitionRows,
  filterRows,
  searchRows,
  sideIsLibrary,
  type IdeaFilter,
  type RowSide,
  type TransitionRow,
} from "@/lib/transitionRows";
import { cn } from "@/lib/utils";

/** The Idea switch at a touch screen's size: the track and its thumb grow together. */
const COARSE_SWITCH =
  "[@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-[4.5rem] [@media(pointer:coarse)]:p-1 " +
  "[@media(pointer:coarse)]:[&>span]:h-9 [@media(pointer:coarse)]:[&>span]:w-9 " +
  "[@media(pointer:coarse)]:[&>span]:data-[state=checked]:translate-x-7";

/** The picker's own cap, so a search over 1,900 tracks does not render them all. */
const SONG_LIMIT = 50;

type SideKind = "library" | "typed";

/** What one side of the add form holds, before it is saved. */
interface SideDraft {
  kind: SideKind;
  songId: string;
  artist: string;
  title: string;
}

const emptySide = (): SideDraft => ({ kind: "library", songId: "", artist: "", title: "" });

/** What the add and edit dialog holds. */
interface Draft {
  /** The relationship being edited, or null when adding. */
  id: string | null;
  from: SideDraft;
  to: SideDraft;
  notes: string;
  idea: boolean;
}

const emptyDraft = (): Draft => ({ id: null, from: emptySide(), to: emptySide(), notes: "", idea: false });

/** A source's label: "Saved", or the block's or set's name (REQ-19-TL VC9). */
function sourceLabel(source: TransitionRow["sources"][number]): string {
  if (source.kind === "relationship") return "Saved";
  return source.name || (source.kind === "block" ? "Block" : "Set");
}

/** Whether a draft side holds enough to save (REQ-19-TM VC2: a typed title). */
function sideReady(side: SideDraft): boolean {
  return side.kind === "library" ? !!side.songId : side.title.trim().length > 0;
}

/** The sides of a stored row as the edit dialog opens them. */
function draftOf(row: TransitionRow): Draft {
  return {
    id: row.relationshipId,
    from: sideOfRow(row.from),
    to: sideOfRow(row.to),
    notes: row.notes ?? "",
    idea: row.idea,
  };
}

function sideOfRow(side: RowSide): SideDraft {
  if (side.typed) return { kind: "typed", songId: "", artist: side.artist, title: side.title };
  return { kind: "library", songId: side.id ?? "", artist: "", title: "" };
}

/**
 * The Transitions page (REQ-19-TL): every transition in one list, saved or not.
 */
export default function Transitions() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [relationships, setRelationships] = useState<SongRelationship[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [sets, setSets] = useState<DJSet[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");

  const [query, setQuery] = useState("");
  const [ideaFilter, setIdeaFilter] = useState<IdeaFilter>("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TransitionRow | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [loadedSongs, loadedRelationships, loadedBlocks, loadedSets] = await Promise.all([
        storage.getSongs(),
        storage.getSongRelationships(),
        storage.getBlocks(),
        storage.getSets(),
      ]);
      setSongs(loadedSongs);
      setRelationships(loadedRelationships);
      setBlocks(loadedBlocks);
      setSets(loadedSets);
      setStatus("ready");
    } catch (error) {
      setLoadError(describeApiError(error));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const edges = buildTransitions({ relationships, blocks, sets, songs });
    return buildTransitionRows({ edges, relationships, songs });
  }, [blocks, relationships, sets, songs]);

  const shown = useMemo(() => filterRows(searchRows(rows, query), ideaFilter), [rows, query, ideaFilter]);
  const songIndex = useMemo(() => new Map(songs.map((song) => [song.id, song])), [songs]);
  const ready = status === "ready";

  const saveDraft = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const fields = {
        source_song_id: draft.from.kind === "library" ? draft.from.songId : null,
        source_track: draft.from.kind === "typed" ? { artist: draft.from.artist.trim(), title: draft.from.title.trim() } : null,
        target_song_id: draft.to.kind === "library" ? draft.to.songId : null,
        target_track: draft.to.kind === "typed" ? { artist: draft.to.artist.trim(), title: draft.to.title.trim() } : null,
        notes: draft.notes.trim() || null,
        idea: draft.idea,
      };
      if (draft.id) {
        // A saved transition's note and idea mark change here; its two tracks
        // stay as they are, so the fact keeps reading the same way round.
        await storage.updateSongRelationship(draft.id, { notes: fields.notes, idea: fields.idea });
        toast({ title: "Transition saved", description: "The note and the idea mark are updated." });
      } else {
        await storage.addSongRelationship({ ...fields, relationship_type: TRANSITION_TYPE_ID });
        toast({ title: "Transition added", description: "It is in the list now." });
      }
      setDraft(null);
      await load();
    } catch (error) {
      toastForFailure(error);
    } finally {
      setSaving(false);
    }
  };

  const linkSide = async (row: TransitionRow, side: "source" | "target", song: Song) => {
    if (!row.relationshipId) return;
    try {
      await storage.updateSongRelationship(row.relationshipId, {
        link_side: side,
        song_id: song.id,
      });
      toast({ title: "Linked", description: `The typed side is now ${song.title}.` });
      await load();
    } catch (error) {
      toastForFailure(error);
    }
  };

  const removeRow = async () => {
    if (!pendingDelete?.relationshipId) return;
    try {
      await storage.deleteSongRelationship(pendingDelete.relationshipId);
      toast({ title: "Transition deleted", description: "The saved transition is gone." });
      setPendingDelete(null);
      await load();
    } catch (error) {
      toastForFailure(error);
    }
  };

  return (
    <div className="min-h-full">
      <PageHeader
        title="Transitions"
        meta={ready && rows.length > 0 ? (rows.length === 1 ? "1 transition" : `${rows.length} transitions`) : undefined}
        actions={
          // The empty state carries the action itself, so the header stays quiet
          // when there is nothing to add to.
          ready && rows.length > 0 && (
            <Button onClick={() => setDraft(emptyDraft())}>
              <Plus />
              Add transition
            </Button>
          )
        }
      >
        {ready && rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search either track"
              aria-label="Search transitions by title or artist"
              className="max-w-xs"
            />
            <SegmentedControl
              label="Show"
              value={ideaFilter}
              onValueChange={(value) => setIdeaFilter(value as IdeaFilter)}
              // The shared control is 32 px; on a touch screen every action is
              // at least 44 px (REQ-19-TL VC15).
              className="[@media(pointer:coarse)]:[&_[role=radio]]:min-h-11"
              options={[
                { value: "all", label: "All" },
                { value: "ideas", label: "Ideas" },
                { value: "transitions", label: "Not ideas" },
              ]}
            />
          </div>
        )}
      </PageHeader>

      {status === "error" ? (
        <EmptyState
          title="The transitions didn’t load."
          body={`Klangkurator couldn't reach its backend: ${loadError}. Check that the app is running, then try again.`}
          action={<Button onClick={() => load()}>Try again</Button>}
          arrangement="split"
        />
      ) : status === "loading" ? (
        <div role="status" aria-label="Loading transitions" className="max-w-4xl space-y-3 px-5 py-7 md:px-8">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No transitions yet."
          body="Save a pair of tracks that work into each other, whether or not you own both of them."
          action={<Button onClick={() => setDraft(emptyDraft())}>Add transition</Button>}
          arrangement="orbit"
        />
      ) : shown.length === 0 ? (
        <p className="max-w-3xl px-5 py-10 text-[14px] text-muted-foreground md:px-8">
          No transition matches. Clear the search or show all transitions.
        </p>
      ) : (
        <ul className="max-w-4xl divide-y divide-border/70 border-b border-border/70">
          {shown.map((row) => (
            <TransitionRowItem
              key={row.key}
              row={row}
              songIndex={songIndex}
              songs={songs}
              onEdit={() => setDraft(draftOf(row))}
              onDelete={() => setPendingDelete(row)}
              onLink={linkSide}
            />
          ))}
        </ul>
      )}

      {draft && (
        <TransitionDialog
          draft={draft}
          setDraft={setDraft}
          songs={songs}
          saving={saving}
          onSave={saveDraft}
          onClose={() => setDraft(null)}
        />
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this transition?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `“${pendingDelete.from.title} → ${pendingDelete.to.title}” stops being a saved transition. A block or a set that also holds this pair keeps its own.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={removeRow} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function toastForFailure(error: unknown): void {
  const status = apiStatus(error);
  const title =
    status === 409 ? "That transition exists" : status === 404 ? "That is not there any more" : "The transition wasn't saved";
  const description =
    status === 409
      ? "The two tracks already have this transition in this direction."
      : status === 422
        ? describeApiError(error)
        : "Check that Klangkurator is still running, then try again.";
  toast({ title, description, variant: "destructive" });
}

/** One row of the list: the two tracks, its sources and its actions. */
function TransitionRowItem({
  row,
  songIndex,
  songs,
  onEdit,
  onDelete,
  onLink,
}: {
  row: TransitionRow;
  songIndex: Map<string, Song>;
  songs: Song[];
  onEdit: () => void;
  onDelete: () => void;
  onLink: (row: TransitionRow, side: "source" | "target", song: Song) => void;
}) {
  return (
    <li className="px-5 py-4 md:px-8">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          {/* Narrow: the first track, then the arrow and the second one under
              it, so neither title is squeezed to a few letters. */}
          <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-x-3">
            <RowSideView side={row.from} songIndex={songIndex} className="col-span-2 sm:col-span-1" />
            <ArrowRight aria-label="followed by" className="h-4 w-4 shrink-0 text-muted-foreground" />
            <RowSideView side={row.to} songIndex={songIndex} />
          </div>

          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <RelationLine type={TRANSITION_TYPE_ID} />
            {row.idea && (
              <span className="rounded-chip bg-signal-soft px-1.5 py-0.5 text-[10px] font-medium text-signal-text">Idea</span>
            )}
            {row.sources.map((source, index) => (
              <span key={`${source.kind}-${source.id}`} className="inline-flex items-center gap-2">
                {index > 0 && <span aria-hidden>·</span>}
                <span className={source.kind === "relationship" ? undefined : "text-foreground/80"}>
                  {sourceLabel(source)}
                </span>
                {source.notes.map((note) => (
                  <span key={note} className="text-foreground/70">
                    — {note}
                  </span>
                ))}
              </span>
            ))}
          </p>

        </div>

        <div className="flex flex-wrap items-center gap-1">
          {row.from.typed && row.relationshipId && (
            <LinkSideAction label={`Link the first track, ${row.from.title}`} songs={songs} side={row.from} onPick={(song) => onLink(row, "source", song)} />
          )}
          {row.to.typed && row.relationshipId && (
            <LinkSideAction label={`Link the second track, ${row.to.title}`} songs={songs} side={row.to} onPick={(song) => onLink(row, "target", song)} />
          )}
          {row.relationshipId && (
            <>
              <Button variant="ghost" size="sm" onClick={onEdit} aria-label={`Edit the transition from ${row.from.title} to ${row.to.title}`}>
                <Pencil />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                aria-label={`Delete the transition from ${row.from.title} to ${row.to.title}`}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

/** One side of a row: a linked track's title, or a typed track with its mark. */
function RowSideView({
  side,
  songIndex,
  className,
}: {
  side: RowSide;
  songIndex: Map<string, Song>;
  className?: string;
}) {
  const song = side.id ? songIndex.get(side.id) : undefined;
  if (side.typed || !song) {
    return (
      <span className={cn("flex min-w-0 flex-col", className)} title={`${side.title} — ${side.artist || "No artist"}`}>
        <span className="truncate text-[14px] font-medium">{side.title}</span>
        <span className="truncate text-xs text-muted-foreground">
          {side.artist || "No artist"} · Not in library
        </span>
      </span>
    );
  }
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <CoverArt src={song.artwork_url} className="h-7 w-7 shrink-0 rounded-[3px]" />
      <span className="flex min-w-0 flex-1 flex-col" title={`${song.title} — ${song.artist}`}>
        <Link
          to={`/song/${song.id}`}
          className="truncate rounded-sm text-[14px] font-medium hover:text-signal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {song.title}
        </Link>
        <span className="truncate text-xs text-muted-foreground">{song.artist}</span>
      </span>
    </span>
  );
}

/** The action that attaches a library track to a typed side (REQ-19-TM VC5). */
function LinkSideAction({
  label,
  songs,
  side,
  onPick,
}: {
  label: string;
  songs: Song[];
  side: RowSide;
  onPick: (song: Song) => void;
}) {
  return (
    <TrackPicker
      songs={songs}
      placeholder="Title, artist or album"
      initialQuery={side.title}
      closeOnPick
      onPickSong={onPick}
    >
      <Button variant="outline" size="sm" aria-label={label} title="Link to a library track">
        Link track
      </Button>
    </TrackPicker>
  );
}

/** The add and edit dialog: two sides, a note, and the Idea switch. */
function TransitionDialog({
  draft,
  setDraft,
  songs,
  saving,
  onSave,
  onClose,
}: {
  draft: Draft;
  setDraft: (next: Draft) => void;
  songs: Song[];
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const canSave = sideReady(draft.from) && sideReady(draft.to) && !saving;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{draft.id ? "Edit transition" : "Add transition"}</DialogTitle>
          <DialogDescription>
            Pick the two tracks. Either side can be a track you don't own yet: type its artist and title.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <SideEditor
            legend="The first track"
            side={draft.from}
            songs={songs}
            onChange={(from) => setDraft({ ...draft, from })}
          />
          <SideEditor
            legend="The second track"
            side={draft.to}
            songs={songs}
            onChange={(to) => setDraft({ ...draft, to })}
          />

          <div className="space-y-2">
            <Label htmlFor="transition-notes">Note (optional)</Label>
            <Textarea
              id="transition-notes"
              value={draft.notes}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              placeholder="Where the transition works, what to do with it"
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <div className="min-w-0">
              <Label htmlFor="transition-idea">Idea</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">An idea that you have not tried yet.</p>
            </div>
            <Switch
              id="transition-idea"
              checked={draft.idea}
              onCheckedChange={(idea) => setDraft({ ...draft, idea })}
              // 20 px on a mouse; a touch screen needs 44 px (REQ-19-TL VC15).
              className={COARSE_SWITCH}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!canSave}>
            {saving ? "Saving…" : draft.id ? "Save" : "Add transition"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One side of the dialog: a library search, or artist and title by hand. */
function SideEditor({
  legend,
  side,
  songs,
  onChange,
}: {
  legend: string;
  side: SideDraft;
  songs: Song[];
  onChange: (next: SideDraft) => void;
}) {
  const id = `transition-side-${legend.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <fieldset className="space-y-2">
      <legend className="text-[13px] font-medium">{legend}</legend>
      <SegmentedControl
        label={`${legend}: in the library or not`}
        value={side.kind}
        onValueChange={(kind) => onChange({ ...side, kind })}
        className="[@media(pointer:coarse)]:[&_[role=radio]]:min-h-11"
        options={[
          { value: "library", label: "In library" },
          { value: "typed", label: "Not in library" },
        ]}
      />
      {side.kind === "library" ? (
        <LibraryPicker id={id} songs={songs} songId={side.songId} onPick={(songId) => onChange({ ...side, songId })} />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`${id}-artist`} className="text-xs text-muted-foreground">
              Artist
            </Label>
            <Input
              id={`${id}-artist`}
              value={side.artist}
              onChange={(event) => onChange({ ...side, artist: event.target.value })}
              placeholder="Tate McRae"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-title`} className="text-xs text-muted-foreground">
              Title
            </Label>
            <Input
              id={`${id}-title`}
              value={side.title}
              onChange={(event) => onChange({ ...side, title: event.target.value })}
              placeholder="Housewife"
              aria-required
            />
          </div>
        </div>
      )}
    </fieldset>
  );
}

/** A search over the library, matching a title, an artist or an album. */
function LibraryPicker({
  id,
  songs,
  songId,
  onPick,
}: {
  id: string;
  songs: Song[];
  songId: string;
  onPick: (songId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const chosen = songs.find((song) => song.id === songId);
  const matched = useMemo(() => {
    const wanted = query.trim().toLowerCase();
    if (!wanted) return songs;
    return songs.filter((song) => `${song.title} ${song.artist} ${song.album ?? ""}`.toLowerCase().includes(wanted));
  }, [songs, query]);

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
      <PopoverTrigger asChild>
        <Button id={id} variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          {chosen ? (
            <span className="truncate">
              {chosen.title} — {chosen.artist}
            </span>
          ) : (
            <span className="text-muted-foreground">Find a track</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(24rem,calc(100vw-2rem))] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Title, artist or album" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>No track matches.</CommandEmpty>
            <CommandGroup>
              {matched.slice(0, SONG_LIMIT).map((song) => (
                <CommandItem
                  key={song.id}
                  value={song.id}
                  onSelect={() => {
                    onPick(song.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn("gap-3", songId === song.id && "bg-accent")}
                >
                  <CoverArt src={song.artwork_url} className="h-8 w-8 rounded-[3px]" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{song.title}</span>
                    <span className="truncate text-xs text-muted-foreground">{song.artist}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
