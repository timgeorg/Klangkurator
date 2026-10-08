import { useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";

import { CoverArt } from "@/components/brand";
import { EmptyState } from "@/components/layout/EmptyState";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SwatchPicker } from "@/components/ui/swatch-picker";
import { Textarea } from "@/components/ui/textarea";
import { ENTITY_COLORS } from "@/lib/palette";
import { type Block, type Song, storage } from "@/lib/storage";
import { formatBpm, formatDuration, splitTitle } from "@/lib/trackFormat";

import { RunningOrderList, Transition, type OrderRow } from "./RunningOrder";
import { byPosition, indexById, plural, totalSeconds } from "./setModel";
import { TrackPicker } from "./TrackPicker";

interface BlockEditorProps {
  /** The block to edit; null creates a new one. */
  block: Block | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful save, before the dialog closes. */
  onSave: () => void;
  /** The library, already loaded by the page. */
  songs: Song[];
}

/** Create or edit a block: a name, a colour and two or more tracks in mixing order. */
export function BlockEditor({ block, open, onOpenChange, onSave, songs }: BlockEditorProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,60rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <BlockForm
          key={block?.id ?? "new"}
          block={block}
          songs={songs}
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

interface Entry {
  song_id: string;
  transition_notes?: string;
}

function BlockForm({
  block,
  songs,
  onCancel,
  onSaved,
}: {
  block: Block | null;
  songs: Song[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(block?.name ?? "");
  const [description, setDescription] = useState(block?.description ?? "");
  const [color, setColor] = useState(() => block?.color ?? ENTITY_COLORS[Math.floor(Math.random() * ENTITY_COLORS.length)].hex);
  const [entries, setEntries] = useState<Entry[]>(() =>
    byPosition(block?.songs ?? []).map(({ song_id, transition_notes }) => ({ song_id, transition_notes: transition_notes ?? "" })),
  );
  const [nameError, setNameError] = useState("");
  const [orderError, setOrderError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const orderRef = useRef<HTMLDivElement>(null);

  const songIndex = useMemo(() => indexById(songs), [songs]);
  const inBlock = useMemo(() => new Set(entries.map((e) => e.song_id)), [entries]);
  const available = useMemo(() => songs.filter((s) => !inBlock.has(s.id)), [songs, inBlock]);
  const tracks = entries.map((e) => songIndex.get(e.song_id)).filter((s): s is Song => !!s);

  const labelOf = (songId: string) => {
    const song = songIndex.get(songId);
    return song ? splitTitle(song.title).main : "missing track";
  };

  const add = (song: Song) => {
    setEntries((prev) => [...prev, { song_id: song.id, transition_notes: "" }]);
    if (orderError && entries.length + 1 >= 2) setOrderError("");
  };

  const move = (index: number, delta: -1 | 1) =>
    setEntries((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const remove = (index: number) => setEntries((prev) => prev.filter((_, i) => i !== index));

  const setNote = (index: number, note: string) =>
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, transition_notes: note } : e)));

  const save = async () => {
    const trimmed = name.trim();
    setNameError(trimmed ? "" : "Give the block a name.");
    setOrderError(entries.length >= 2 ? "" : "A block holds at least two tracks, so it has a transition.");
    if (!trimmed) {
      nameRef.current?.focus();
      return;
    }
    if (entries.length < 2) {
      orderRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      return;
    }

    setSaving(true);
    setSaveError("");
    const songsPayload = entries.map((e, position) => ({
      song_id: e.song_id,
      position,
      transition_notes: e.transition_notes?.trim() || undefined,
    }));
    try {
      if (block) {
        // An empty string clears the description; the backend skips nulls.
        await storage.updateBlock(block.id, { name: trimmed, description: description.trim(), color, songs: songsPayload });
      } else {
        await storage.addBlock({ name: trimmed, description: description.trim() || undefined, color, songs: songsPayload });
      }
      onSaved();
    } catch (error) {
      setSaveError(`The block wasn't saved: ${error instanceof Error ? error.message : "unknown error"}. Try again.`);
    } finally {
      setSaving(false);
    }
  };

  const rows: OrderRow[] = entries.map((entry) => {
    const song = songIndex.get(entry.song_id);
    if (!song) {
      return {
        key: entry.song_id,
        name: "missing track",
        art: <span aria-hidden className="h-10 w-10 rounded-[3px] border border-dashed border-border" />,
        title: "Track no longer in the library",
        missing: true,
      };
    }
    const { main } = splitTitle(song.title);
    return {
      key: entry.song_id,
      name: main,
      art: <CoverArt src={song.artwork_url} className="h-10 w-10 rounded-[3px]" />,
      title: main,
      subtitle: song.artist,
      meta: (
        <>
          {formatBpm(song.bpm)}
          {song.musical_key ? ` · ${song.musical_key}` : ""} · {formatDuration(song.duration)}
        </>
      ),
    };
  });

  return (
    <>
      <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
        <DialogTitle>{block ? "Edit block" : "New block"}</DialogTitle>
        <DialogDescription>Two or more tracks that mix well, in the order you play them.</DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="grid gap-5">
          <div className="space-y-2">
            <Label htmlFor="block-name">
              Name<span aria-hidden className="text-muted-foreground"> *</span>
            </Label>
            <Input
              id="block-name"
              ref={nameRef}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError && e.target.value.trim()) setNameError("");
              }}
              aria-invalid={!!nameError}
              aria-describedby={nameError ? "block-name-error" : undefined}
            />
            {nameError && (
              <p id="block-name-error" className="text-xs text-destructive">
                {nameError}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="block-description">Description</Label>
            <Textarea id="block-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2.5">
            <Label id="block-colour">Colour</Label>
            <SwatchPicker value={color} onChange={setColor} label="Block colour" />
          </div>
        </div>

        <section ref={orderRef} aria-labelledby="block-order" className="mt-8 border-t border-border pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <h3 id="block-order" className="text-[13px] font-semibold">
                Tracks
              </h3>
              <span className="k-num text-xs text-muted-foreground">
                {plural(tracks.length, "track")} · {formatDuration(totalSeconds(tracks))}
              </span>
            </div>
            <TrackPicker songs={available} onPickSong={add} placeholder="Search title, artist, album">
              <Button variant="outline" size="sm">
                <Plus />
                Add track
              </Button>
            </TrackPicker>
          </div>
          {orderError && <p className="mt-2 text-xs text-destructive">{orderError}</p>}

          <div className="mt-4">
            {rows.length === 0 ? (
              <EmptyState
                size="inline"
                arrangement="split"
                title="No tracks yet."
                body="Add the tracks in the order you mix them. Notes on each transition go between them."
              />
            ) : (
              <RunningOrderList
                rows={rows}
                onMove={move}
                onRemove={remove}
                renderTransition={(index) => (
                  <Transition
                    from={labelOf(entries[index].song_id)}
                    to={labelOf(entries[index + 1].song_id)}
                    note={entries[index].transition_notes ?? ""}
                    onNoteChange={(note) => setNote(index, note)}
                  />
                )}
              />
            )}
          </div>
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
          {saving ? "Saving…" : block ? "Save block" : "Create block"}
        </Button>
      </DialogFooter>
    </>
  );
}
