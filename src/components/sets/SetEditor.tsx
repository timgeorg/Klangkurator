import { useEffect, useMemo, useRef, useState } from "react";
import { GitBranch, Plus, X } from "lucide-react";

import { CoverArt } from "@/components/brand";
import { EmptyState } from "@/components/layout/EmptyState";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SwatchPicker } from "@/components/ui/swatch-picker";
import { Textarea } from "@/components/ui/textarea";
import { ENTITY_COLORS } from "@/lib/palette";
import { type AltTransition, type Block, type DJSet, type SetItem, type Song, storage } from "@/lib/storage";
import { formatBpm, formatDuration, formatTotal } from "@/lib/trackFormat";
import { TrackTitle } from "@/components/dj/TrackTitle";

import { EntityTile } from "./CoverMosaic";
import { RunningOrderList, Transition, type OrderRow } from "./RunningOrder";
import {
  byPosition,
  indexById,
  itemRef,
  plural,
  readAlternatives,
  resolveItem,
  totalSeconds,
  tracksOf,
  type ResolvedItem,
} from "./setModel";
import { TrackPicker } from "./TrackPicker";

interface SetEditorProps {
  /** The set to edit; null creates a new one. */
  djSet: DJSet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful save, before the dialog closes. */
  onSave: () => void;
  /** The library and blocks, already loaded by the page. */
  songs: Song[];
  blocks: Block[];
}

/** Create or edit a set: its running order of tracks and blocks, with transition notes and alternatives. */
export function SetEditor({ djSet, open, onOpenChange, onSave, songs, blocks }: SetEditorProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,60rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <SetForm
          key={djSet?.id ?? "new"}
          djSet={djSet}
          songs={songs}
          blocks={blocks}
          onCancel={() => onOpenChange(false)}
          onSaved={() => {
            onSave();
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Normalise stored items: ref_id filled in, alternatives in the backend's shape, in order. */
function initialItems(djSet: DJSet | null): SetItem[] {
  return byPosition(djSet?.items ?? []).map((item) => ({
    id: item.id,
    type: item.type,
    ref_id: itemRef(item),
    position: item.position,
    transition_notes: item.transition_notes ?? "",
    alternative_transitions: readAlternatives(item.alternative_transitions),
  }));
}

function SetForm({
  djSet,
  songs,
  blocks,
  onCancel,
  onSaved,
}: {
  djSet: DJSet | null;
  songs: Song[];
  blocks: Block[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(djSet?.name ?? "");
  const [description, setDescription] = useState(djSet?.description ?? "");
  const [color, setColor] = useState(() => djSet?.color ?? ENTITY_COLORS[Math.floor(Math.random() * ENTITY_COLORS.length)].hex);
  const [items, setItems] = useState<SetItem[]>(() => initialItems(djSet));
  const [nameError, setNameError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ song: Song; notes?: string }>>([]);
  const nameRef = useRef<HTMLInputElement>(null);

  const songIndex = useMemo(() => indexById(songs), [songs]);
  const blockIndex = useMemo(() => indexById(blocks), [blocks]);
  const resolved = useMemo(() => items.map((item) => resolveItem(item, songIndex, blockIndex)), [items, songIndex, blockIndex]);
  const tracks = tracksOf(resolved);
  const target = (djSet?.target_duration_min ?? 0) * 60;
  const phaseTracks = (djSet?.phases ?? []).reduce((n, phase) => n + (phase.items?.length ?? 0), 0);

  const usedSongs = useMemo(() => new Set(items.filter((i) => i.type === "song").map((i) => i.ref_id)), [items]);
  const usedBlocks = useMemo(() => new Set(items.filter((i) => i.type === "block").map((i) => i.ref_id)), [items]);
  const availableSongs = useMemo(() => songs.filter((s) => !usedSongs.has(s.id)), [songs, usedSongs]);
  const availableBlocks = useMemo(() => blocks.filter((b) => !usedBlocks.has(b.id)), [blocks, usedBlocks]);

  // The last track that plays, blocks expanded: suggestions continue from it.
  const lastSong = useMemo(() => {
    for (let i = resolved.length - 1; i >= 0; i--) {
      const entry = resolved[i];
      if (entry.kind === "song") return entry.song;
      if (entry.kind === "block" && entry.tracks.length) return entry.tracks[entry.tracks.length - 1];
    }
    return null;
  }, [resolved]);
  const lastSongId = lastSong?.id ?? null;

  useEffect(() => {
    if (!lastSongId) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    storage
      .getTransitionSuggestions(lastSongId)
      .then((found) => !cancelled && setSuggestions(found))
      .catch(() => !cancelled && setSuggestions([]));
    return () => {
      cancelled = true;
    };
  }, [lastSongId]);

  const freshSuggestions = suggestions.filter(({ song }) => !usedSongs.has(song.id));

  const append = (type: SetItem["type"], refId: string) =>
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), type, ref_id: refId, position: prev.length, transition_notes: "", alternative_transitions: [] },
    ]);

  const update = (index: number, patch: Partial<SetItem>) =>
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const move = (index: number, delta: -1 | 1) =>
    setItems((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const remove = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const addAlternative = (index: number, song: Song) => {
    const current = items[index].alternative_transitions ?? [];
    if (current.some((alt) => alt.ref_id === song.id)) return;
    update(index, { alternative_transitions: [...current, { ref_id: song.id }] });
  };

  const removeAlternative = (index: number, refId: string) =>
    update(index, { alternative_transitions: (items[index].alternative_transitions ?? []).filter((alt) => alt.ref_id !== refId) });

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Give the set a name.");
      nameRef.current?.focus();
      return;
    }
    setSaving(true);
    setSaveError("");
    const payload: SetItem[] = items.map((item, position) => ({
      id: item.id,
      type: item.type,
      ref_id: item.ref_id,
      position,
      transition_notes: item.transition_notes?.trim() || undefined,
      alternative_transitions: (item.alternative_transitions ?? []).map(({ ref_id, label }): AltTransition => ({ ref_id, label })),
    }));
    try {
      if (djSet) {
        // An empty string clears the description; the backend skips nulls.
        await storage.updateSet(djSet.id, { name: trimmed, description: description.trim(), color, items: payload });
      } else {
        await storage.addSet({ name: trimmed, description: description.trim() || undefined, color, items: payload, phases: [] });
      }
      onSaved();
    } catch (error) {
      setSaveError(`The set wasn't saved: ${error instanceof Error ? error.message : "unknown error"}. Try again.`);
    } finally {
      setSaving(false);
    }
  };

  const rows: OrderRow[] = resolved.map((entry) => rowFor(entry));
  const nameOf = (entry: ResolvedItem) => rowFor(entry).name;

  return (
    <>
      <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
        <DialogTitle>{djSet ? "Edit set" : "New set"}</DialogTitle>
        <DialogDescription>The order you plan to play tracks and blocks in.</DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="grid gap-5">
          <div className="space-y-2">
            <Label htmlFor="set-name">
              Name<span aria-hidden className="text-muted-foreground"> *</span>
            </Label>
            <Input
              id="set-name"
              ref={nameRef}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError && e.target.value.trim()) setNameError("");
              }}
              aria-invalid={!!nameError}
              aria-describedby={nameError ? "set-name-error" : undefined}
            />
            {nameError && (
              <p id="set-name-error" className="text-xs text-destructive">
                {nameError}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="set-description">Description</Label>
            <Textarea id="set-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2.5">
            <Label id="set-color">Color</Label>
            <SwatchPicker value={color} onChange={setColor} label="Set color" />
          </div>
        </div>

        <section aria-labelledby="set-order" className="mt-8 border-t border-border pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 id="set-order" className="text-[13px] font-semibold">
                Running order
              </h3>
              <span className="k-num text-xs text-muted-foreground">
                {plural(tracks.length, "track")} · {formatTotal(totalSeconds(tracks))}
                {target > 0 && <> of {formatTotal(target)}</>}
              </span>
            </div>
            <TrackPicker
              songs={availableSongs}
              alreadyAdded={songs.filter((s) => usedSongs.has(s.id))}
              blocks={availableBlocks}
              onPickSong={(song) => append("song", song.id)}
              onPickBlock={(block) => append("block", block.id)}
              placeholder="Search tracks and blocks"
            >
              <Button variant="outline" size="sm">
                <Plus />
                Add track or block
              </Button>
            </TrackPicker>
          </div>

          {phaseTracks > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              This set also has {plural(phaseTracks, "track")} stored in phases. The editor does not show phases yet;
              saving leaves them as they are.
            </p>
          )}

          <div className="mt-4">
            {rows.length === 0 ? (
              <EmptyState
                size="inline"
                arrangement="orbit"
                title="The running order is empty."
                body="Add tracks and blocks in the order you plan to play them."
              />
            ) : (
              <RunningOrderList
                rows={rows}
                onMove={move}
                onRemove={remove}
                renderTransition={(index) => {
                  const from = nameOf(resolved[index]);
                  const alternatives = items[index].alternative_transitions ?? [];
                  const nextSongId = items[index + 1]?.type === "song" ? items[index + 1].ref_id : null;
                  return (
                    <Transition
                      from={from}
                      to={nameOf(resolved[index + 1])}
                      note={items[index].transition_notes ?? ""}
                      onNoteChange={(note) => update(index, { transition_notes: note })}
                      actions={
                        <TrackPicker
                          songs={songs.filter((s) => s.id !== nextSongId && !alternatives.some((alt) => alt.ref_id === s.id))}
                          onPickSong={(song) => addAlternative(index, song)}
                          closeOnPick
                          placeholder="Search an alternative next track"
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0 text-muted-foreground"
                            aria-label={`Add an alternative after ${from}`}
                            title="Add an alternative next track"
                          >
                            <GitBranch />
                            <span className="hidden sm:inline">Alternative</span>
                          </Button>
                        </TrackPicker>
                      }
                    >
                      {alternatives.length > 0 && (
                        <ul aria-label="Alternatives" className="mt-1.5 flex flex-wrap gap-1.5">
                          {alternatives.map((alt) => {
                            const song = songIndex.get(alt.ref_id);
                            const title = song ? song.title : "Track no longer in the library";
                            return (
                              <li
                                key={alt.ref_id}
                                className="inline-flex h-6 max-w-full items-center gap-1.5 rounded-chip border border-border pl-2 pr-0.5 text-xs"
                              >
                                <GitBranch aria-hidden className="h-3 w-3 shrink-0 text-muted-foreground" />
                                <span className="text-muted-foreground">or</span>
                                {song ? <TrackTitle title={title} /> : <span className="truncate">{title}</span>}
                                {alt.label && <span className="truncate text-muted-foreground">({alt.label})</span>}
                                <button
                                  type="button"
                                  onClick={() => removeAlternative(index, alt.ref_id)}
                                  aria-label={`Remove alternative ${title}`}
                                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </Transition>
                  );
                }}
              />
            )}
          </div>

          {lastSong && freshSuggestions.length > 0 && (
            <div className="mt-5 border-t border-dashed border-border pt-4">
              <p className="text-[13px] text-muted-foreground">
                Saved transitions from <TrackTitle title={lastSong.title} className="text-foreground" />
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {freshSuggestions.map(({ song, notes }) => (
                  <Button
                    key={song.id}
                    variant="outline"
                    size="sm"
                    onClick={() => append("song", song.id)}
                    title={notes || undefined}
                    className="max-w-full"
                  >
                    <Plus />
                    <TrackTitle title={song.title} />
                  </Button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      <DialogFooter className="border-t border-border px-6 py-4 sm:items-center">
        {saveError && (
          <p role="alert" className="mr-auto text-[13px] text-destructive">
            {saveError}
          </p>
        )}
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : djSet ? "Save set" : "Create set"}
        </Button>
      </DialogFooter>
    </>
  );
}

function rowFor(entry: ResolvedItem): OrderRow {
  if (entry.kind === "song") {
    return {
      key: entry.item.id,
      name: entry.song.title,
      art: <CoverArt src={entry.song.artwork_url} className="h-10 w-10 rounded-[3px]" />,
      title: <TrackTitle title={entry.song.title} />,
      subtitle: entry.song.artist,
      meta: (
        <>
          {formatBpm(entry.song.bpm)}
          {entry.song.musical_key ? ` · ${entry.song.musical_key}` : ""} · {formatDuration(entry.song.duration)}
        </>
      ),
    };
  }
  if (entry.kind === "block") {
    return {
      key: entry.item.id,
      name: entry.block.name,
      art: <EntityTile color={entry.block.color} shape="half" className="h-10 w-10 rounded-[3px]" />,
      title: entry.block.name,
      subtitle: `Block · ${entry.tracks.map((s) => s.title).join(" → ") || "no tracks"}`,
      meta: (
        <>
          {plural(entry.tracks.length, "track")} · {formatDuration(totalSeconds(entry.tracks))}
        </>
      ),
    };
  }
  const isBlock = entry.item.type === "block";
  return {
    key: entry.item.id,
    name: isBlock ? "deleted block" : "missing track",
    art: <span aria-hidden className="h-10 w-10 rounded-[3px] border border-dashed border-border" />,
    title: isBlock ? "Deleted block" : "Track no longer in the library",
    missing: true,
  };
}
