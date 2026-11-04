// Transitions page (issue #82) — the rows the page lists, pure so the rules
// test without a DOM. Two facts make one row: a transition fact from
// `buildTransitions` (its `transition` relationships and the consecutive tracks
// of blocks and sets) and a saved transition that has a typed side, which that
// function cannot carry because it needs song ids.
//
// The rules here are REQ-19-TL's list rules and REQ-19-TI's idea rules: one row
// per direction, sorted by the two titles, searched on title and artist, and
// filtered by the idea mark that the saved transition of a row carries.

import type { SongRelationship } from "@/lib/storage";
import type { TransitionEdge } from "@/lib/trackMap/transitions";
import type { TransitionSource } from "@/lib/trackMap/types";

/** One end of a row: a library track or a track the library does not have. */
export interface RowSide {
  /** The track's id, absent for a typed side. */
  id?: string;
  artist: string;
  title: string;
  /** True when the side is a typed track, so the page marks it (REQ-19-TM VC4). */
  typed: boolean;
}

/** One row of the page: a pair of tracks and where the fact comes from. */
export interface TransitionRow {
  /** Stable across renders: the two sides' keys in their direction. */
  key: string;
  from: RowSide;
  to: RowSide;
  /** The sources, in the order `buildTransitions` gives them. */
  sources: TransitionSource[];
  /** True when the saved transition of this row is an idea (REQ-19-TI VC5). */
  idea: boolean;
  /** The saved transition's id, or null for a row that only blocks and sets make. */
  relationshipId: string | null;
  /** The saved transition's note, so the page can show it beside a typed side. */
  notes?: string;
}

/** The filter above the list (REQ-19-TI VC4). */
export type IdeaFilter = "all" | "ideas" | "transitions";

/** A song, as little as the rows need of it. */
export interface RowSong {
  id: string;
  artist: string;
  title: string;
}

export interface BuildRowsInput {
  /** `buildTransitions` output: the saved library pairs and the block and set pairs. */
  edges: readonly TransitionEdge[];
  /** All relationship rows; the ones with a typed side come straight from here. */
  relationships: readonly SongRelationship[];
  /** The library's songs, so a row shows the titles a track has now. */
  songs: readonly RowSong[];
}

/**
 * Every row of the Transitions page.
 *
 * A saved transition joins the list even when a side is typed: no edge carries
 * it, so it is read from its relationship row instead (REQ-19-TM VC3, VC4). A
 * row that a block, a set and a saved transition all make is one row, and the
 * saved transition's id and idea mark join it there, so the page offers its
 * edit and its mark on the row that has them (REQ-19-TI VC5).
 *
 * A pair is identified by its two sides, and a typed side's identity is its
 * artist and title, case ignored (REQ-19-TM VC14), so the same typed pair
 * stated twice gives one row.
 *
 * @param input - The edges, the relationship rows and the library's songs.
 * @returns The rows, sorted by the first title and then the second.
 */
export function buildTransitionRows(input: BuildRowsInput): TransitionRow[] {
  const byId = new Map(input.songs.map((song) => [song.id, song]));
  const rows = new Map<string, TransitionRow>();

  for (const edge of input.edges) {
    const from = librarySide(edge.source, byId);
    const to = librarySide(edge.target, byId);
    // A song the library no longer has names nothing to show.
    if (!from || !to) continue;
    addRow(rows, from, to, edge.sources, null);
  }

  for (const relationship of input.relationships) {
    for (const row of savedRows(relationship, byId)) {
      addRow(rows, row.from, row.to, [savedSource(relationship)], relationship);
    }
  }

  return [...rows.values()]
    .map((row) => ({ ...row, sources: orderSources(row.sources) }))
    .sort(
      (a, b) => compareTitles(a.from.title, b.from.title) || compareTitles(a.to.title, b.to.title),
    );
}

/**
 * The rows whose first or second side matches the typed text.
 *
 * The match is on the title or the artist of either side and ignores case
 * (REQ-19-TL VC12). An empty query keeps every row.
 *
 * @param rows - The rows to narrow.
 * @param query - What the user typed.
 * @returns The matching rows, in their original order.
 */
export function searchRows(rows: readonly TransitionRow[], query: string): TransitionRow[] {
  const wanted = query.trim().toLowerCase();
  if (!wanted) return [...rows];
  return rows.filter((row) => [row.from, row.to].some((side) => matchesSide(side, wanted)));
}

/**
 * The rows the idea filter keeps (REQ-19-TI VC4).
 *
 * @param rows - The rows to narrow.
 * @param filter - All rows, only ideas, or only the rows that are not ideas.
 * @returns The matching rows, in their original order.
 */
export function filterRows(rows: readonly TransitionRow[], filter: IdeaFilter): TransitionRow[] {
  if (filter === "all") return [...rows];
  return rows.filter((row) => (filter === "ideas" ? row.idea : !row.idea));
}

/** Which end of a relationship a reading looks at. */
export type RelationshipSide = "source" | "target";

/** What the far end of a relationship names: a song id, or a typed track. */
export interface RelationshipEnd {
  songId: string | null;
  typed: { artist: string; title: string } | null;
}

/**
 * The end opposite `side`, as the row stores it.
 *
 * A row's end is a song id **or** a typed track, never both (REQ-19-TM VC1),
 * so a reader that shows text can take the typed form when the id is absent.
 *
 * @param relationship - The row.
 * @param side - The end the reader is on; the other end is returned.
 * @returns The other end, or null when the row names neither form there.
 */
export function otherEnd(relationship: SongRelationship, side: RelationshipSide): RelationshipEnd | null {
  const key = side === "source" ? "target" : "source";
  const songId = relationship[`${key}_song_id`] ?? null;
  const typed = relationship[`${key}_track`] ?? null;
  if (!songId && !typed) return null;
  return { songId, typed: typed ? { artist: typed.artist ?? "", title: typed.title } : null };
}

/** Whether a side is a library track, so the page can link to its song page. */
export function sideIsLibrary(side: RowSide): boolean {
  return !side.typed && !!side.id;
}

function matchesSide(side: RowSide, wanted: string): boolean {
  return side.title.toLowerCase().includes(wanted) || side.artist.toLowerCase().includes(wanted);
}

function librarySide(id: string, byId: Map<string, RowSong>): RowSide | null {
  const song = byId.get(id);
  if (!song) return null;
  return { id: song.id, artist: song.artist, title: song.title, typed: false };
}

/** The sides of a saved transition, or none when it is not a transition. */
function savedRows(relationship: SongRelationship, byId: Map<string, RowSong>): Array<{ from: RowSide; to: RowSide }> {
  if (relationship.relationship_type !== "transition") return [];
  const from = savedSide(relationship.source_song_id, relationship.source_track, byId);
  const to = savedSide(relationship.target_song_id, relationship.target_track, byId);
  if (!from || !to) return [];
  // A saved transition from a track to itself makes no row (REQ-19-TL VC16).
  if (from.id && from.id === to.id) return [];
  return [{ from, to }];
}

function savedSide(
  songId: string | null | undefined,
  typed: { artist: string; title: string } | null | undefined,
  byId: Map<string, RowSong>,
): RowSide | null {
  if (songId) return librarySide(songId, byId);
  if (!typed) return null;
  return { artist: typed.artist ?? "", title: typed.title, typed: true };
}

/** The source a saved transition contributes: "Saved", with its note. */
function savedSource(relationship: SongRelationship): TransitionSource {
  const note = relationship.notes?.trim();
  return {
    kind: "relationship",
    id: relationship.id,
    notes: note ? [note] : [],
  };
}

/**
 * A pair's identity: the two sides' keys in their direction.
 *
 * A typed side is keyed on its artist and title, case ignored, so the same
 * pair stated twice lands on one row (REQ-19-TM VC14).
 */
function pairKey(from: RowSide, to: RowSide): string {
  return `${sideKey(from)}\u0000${sideKey(to)}`;
}

function sideKey(side: RowSide): string {
  if (!side.typed) return `song:${side.id}`;
  return `typed:${side.artist.trim().toLowerCase()}\u0000${side.title.trim().toLowerCase()}`;
}

function addRow(
  rows: Map<string, TransitionRow>,
  from: RowSide,
  to: RowSide,
  sources: TransitionSource[],
  relationship: SongRelationship | null,
): void {
  const key = pairKey(from, to);
  const existing = rows.get(key);
  if (!existing) {
    rows.set(key, {
      key,
      from,
      to,
      sources: [...sources],
      idea: !!relationship?.idea,
      relationshipId: relationship?.id ?? null,
      notes: relationship?.notes,
    });
    return;
  }
  for (const source of sources) {
    if (!existing.sources.some((other) => other.kind === source.kind && other.id === source.id)) {
      existing.sources.push(source);
    }
  }
  if (relationship) {
    existing.relationshipId = relationship.id;
    existing.idea = !!relationship.idea;
    existing.notes = relationship.notes;
  }
}

/** A title order that ignores case, so "abc" and "Abc" sit together. */
function compareTitles(a: string, b: string): number {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  if (left === right) return a < b ? -1 : a > b ? 1 : 0;
  return left < right ? -1 : 1;
}

/** The source order `buildTransitions` uses: relationship, block, set. */
const SOURCE_ORDER: Record<TransitionSource["kind"], number> = { relationship: 0, block: 1, set: 2 };

/** The same source order the track map's rows keep, so both read alike. */
function orderSources(sources: TransitionSource[]): TransitionSource[] {
  return [...sources].sort(
    (a, b) => SOURCE_ORDER[a.kind] - SOURCE_ORDER[b.kind] || compareTitles(a.name ?? "", b.name ?? ""),
  );
}
