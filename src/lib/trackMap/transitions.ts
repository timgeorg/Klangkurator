// Track map (issue #8) — the transition facts of a library (plan phase 1b):
// `transition` relationships, consecutive tracks in a block, and consecutive
// tracks in a set's flat `items` with blocks expanded in place. A gap breaks
// a run, a pair is deduplicated per `from → to` direction, and each edge
// keeps its sources and their notes. `phases` are never read.
import type { Block, BlockSong, DJSet, SetItem, SongRelationship } from "@/lib/storage";

import type { TransitionSource } from "./types";

/** One deduplicated transition, one per `from → to` direction. */
export interface TransitionEdge {
  source: string;
  target: string;
  kind: "transition";
  sources: TransitionSource[];
}

export interface TransitionInputs {
  /** All `song_relationships` rows; only type `transition` makes a fact. */
  relationships?: readonly SongRelationship[];
  /** All blocks; each one also resolves the blocks a set references. */
  blocks?: readonly Block[];
  /** All sets; their flat `items` are read, `phases` never. */
  sets?: readonly DJSet[];
  /** The library's songs; an id outside it is a gap. Without them, no gap is detected. */
  songs?: readonly { id: string }[];
}

// Sources come back in this order: relationship, block, set, then by name and id.
const KIND_ORDER: Record<TransitionSource["kind"], number> = { relationship: 0, block: 1, set: 2 };

/**
 * Every transition the library holds, deduplicated per direction.
 *
 * Facts: each `transition` relationship (its `notes`), each pair of
 * consecutive tracks in a block by `position` (the earlier entry's
 * `transition_notes`), and each pair of consecutive tracks in a set's flat
 * `items` by `position`, blocks expanded in place (inside a block the note is
 * the block entry's; at an item boundary the earlier `SetItem`'s). A missing
 * song, a missing block or a missing song inside a block ends one run and
 * starts the next, so its neighbours never pair up. A pair whose `from`
 * equals its `to` is skipped.
 *
 * The result is sorted by `source` then `target`, so the same library always
 * gives the same edges.
 *
 * @param inputs - The relationships, blocks, sets and songs to read.
 */
export function buildTransitions(inputs: TransitionInputs): TransitionEdge[] {
  const known = inputs.songs ? new Set(inputs.songs.map((song) => song.id)) : null;
  const isKnown = (id: string): boolean => (known ? known.has(id) : true);
  const blocks = inputs.blocks ?? [];
  const blockIndex = new Map(blocks.map((block) => [block.id, block]));
  const edges = new Map<string, BuiltEdge>();

  for (const relationship of inputs.relationships ?? []) {
    if (relationship.relationship_type !== "transition") continue;
    addFact(edges, relationship.source_song_id, relationship.target_song_id, {
      kind: "relationship",
      id: relationship.id,
      notes: notesOf(relationship.notes),
    });
  }

  for (const block of blocks) {
    for (const pair of consecutivePairs(blockSlots(block, isKnown))) {
      addFact(edges, pair.from, pair.to, {
        kind: "block",
        id: block.id,
        name: block.name,
        notes: notesOf(pair.note),
      });
    }
  }

  for (const set of inputs.sets ?? []) {
    for (const pair of consecutivePairs(setSlots(set, blockIndex, isKnown))) {
      addFact(edges, pair.from, pair.to, {
        kind: "set",
        id: set.id,
        name: set.name,
        notes: notesOf(pair.note),
      });
    }
  }

  return [...edges.values()]
    .map((edge): TransitionEdge => ({
      source: edge.from,
      target: edge.to,
      kind: "transition",
      sources: orderSources(edge),
    }))
    .sort((a, b) => compare(a.source, b.source) || compare(a.target, b.target));
}

// ── Facts ─────────────────────────────────────────────────

/** A slot in a running order: a song, or a gap where one is missing. */
interface Slot {
  id: string | null;
  note?: string;
}

interface Pair {
  from: string;
  to: string;
  note?: string;
}

interface BuiltEdge {
  from: string;
  to: string;
  sources: Map<string, TransitionSource>;
}

function blockSlots(block: Block, isKnown: (id: string) => boolean): Slot[] {
  return sorted(block.songs).map((entry: BlockSong) => ({
    id: isKnown(entry.song_id) ? entry.song_id : null,
    note: entry.transition_notes,
  }));
}

/**
 * A set's running order with blocks expanded in place. A block that no longer
 * exists contributes a gap, as does a song that left the library.
 *
 * Notes follow the plan: inside a block the note is the block entry
 * (`BlockSong`) it leaves; at an item's boundary it is the earlier
 * `SetItem`'s `transition_notes`, so a pair leaving a block carries the block
 * item's note.
 */
function setSlots(set: DJSet, blockIndex: Map<string, Block>, isKnown: (id: string) => boolean): Slot[] {
  const slots: Slot[] = [];
  for (const item of sorted(set.items)) {
    const ref = itemRef(item);
    if (item.type === "block") {
      const block = blockIndex.get(ref);
      if (!block) {
        slots.push({ id: null });
        continue;
      }
      const expanded = blockSlots(block, isKnown);
      for (let index = 0; index < expanded.length; index += 1) {
        // The block's last slot is what leaves it, so the block item's note wins there.
        const leavesBlock = index === expanded.length - 1;
        slots.push({ ...expanded[index], note: leavesBlock ? item.transition_notes : expanded[index].note });
      }
      continue;
    }
    slots.push({ id: isKnown(ref) ? ref : null, note: item.transition_notes });
  }
  return slots;
}

/** The adjacent pairs of a running order; a gap ends the run around it. */
function consecutivePairs(slots: readonly Slot[]): Pair[] {
  const pairs: Pair[] = [];
  for (let index = 0; index + 1 < slots.length; index += 1) {
    const from = slots[index];
    const to = slots[index + 1];
    if (!from.id || !to.id) continue;
    pairs.push({ from: from.id, to: to.id, note: from.note });
  }
  return pairs;
}

function addFact(edges: Map<string, BuiltEdge>, from: string, to: string, source: TransitionSource): void {
  if (!from || !to || from === to) return;
  const key = `${from}\u0000${to}`;
  let edge = edges.get(key);
  if (!edge) {
    edge = { from, to, sources: new Map() };
    edges.set(key, edge);
  }
  const sourceKey = `${source.kind}\u0000${source.id}`;
  const existing = edge.sources.get(sourceKey);
  if (!existing) {
    edge.sources.set(sourceKey, { ...source, notes: [...source.notes] });
    return;
  }
  for (const note of source.notes) {
    if (!existing.notes.includes(note)) existing.notes.push(note);
  }
}

/** The plan's source order: relationship, block, set, then by name and id. */
function orderSources(edge: BuiltEdge): TransitionSource[] {
  return [...edge.sources.values()].sort(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      compare(a.name ?? "", b.name ?? "") ||
      compare(a.id, b.id),
  );
}

/** The id a set item points at; older data carries song_id or block_id instead. */
function itemRef(item: SetItem): string {
  return item.ref_id || item.song_id || item.block_id || "";
}

function sorted<T extends { position: number }>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => a.position - b.position);
}

function notesOf(note?: string): string[] {
  return note && note.trim() ? [note] : [];
}

function compare(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
