/**
 * The relationship type list the user edits (issue #81).
 *
 * A relationship row stores the **id** of a type, never its name, so renaming a
 * type touches no row. The list itself is library content: it lives in
 * `library.json` beside the tags and the genres and it joins the export. This
 * module loads it once before the first view renders and answers the three
 * questions every view asks — what is this type called, how does it read from a
 * given track, and what line does it draw.
 *
 * Loaded beside the settings and the crates by `loadSettings`; refreshed after
 * anything that changes it, a type edit or an import.
 */

import { api } from "@/lib/api";

/** One relationship type, as `GET /api/relationship-types` reports it. */
export interface RelationshipType {
  id: string;
  name: string;
  /** Palette colour; null means the foreground colour, as transitions draw. */
  color: string | null;
  /** True when the type reads the same from both tracks. */
  both_ways: boolean;
  /** The id of the type that states the same fact from the other side. */
  opposite_id: string | null;
  /** How many relationships use the type (REQ-14-RT VC7). */
  uses: number;
}

/** The fixed id of the transition type: renaming it never changes this (INV-26). */
export const TRANSITION_TYPE_ID = "transition";

/** The palette's fallback, for a type the list does not know. */
const UNKNOWN_COLOR = "#6D7480";

let types: RelationshipType[] = [];
let loaded = false;
const listeners = new Set<() => void>();

/** Notify subscribers after the list changed. */
function notify(): void {
  listeners.forEach((listener) => listener());
}

/** Subscribe to changes of the type list. */
export function subscribeRelationshipTypes(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Every type, in the order Settings shows it. */
export function getRelationshipTypes(): RelationshipType[] {
  return types;
}

/** Whether the list has been read at least once. */
export function relationshipTypesLoaded(): boolean {
  return loaded;
}

/** The type with this id, or undefined when the list does not know it. */
export function relationshipTypeById(id?: string | null): RelationshipType | undefined {
  if (!id) return undefined;
  return types.find((entry) => entry.id === id);
}

/**
 * The name of a type, as Settings shows it.
 *
 * An id the list does not know still shows something honest: the id itself,
 * never an empty cell.
 *
 * @param id - The type id a relationship stores.
 * @returns The type's name, or "" when the row carries no type.
 */
export function relationshipTypeName(id?: string | null): string {
  if (!id) return "";
  return relationshipTypeById(id)?.name ?? id;
}

/**
 * How a relationship of this type reads from one of its two tracks.
 *
 * The source shows the type's name. The target shows the opposite's name when
 * there is one, else the name (a both-ways type, or a one-way type without an
 * opposite — the arrow carries the direction there). REQ-14-RD VC3 to VC6.
 *
 * @param typeId - The type id the relationship stores.
 * @param direction - Which side of the row the reading track is.
 * @returns The phrase to show.
 */
export function relationshipPhrase(typeId: string, direction: "source" | "target"): string {
  const type = relationshipTypeById(typeId);
  const name = type?.name ?? typeId;
  if (direction === "source" || !type) return name;
  if (type.opposite_id) return relationshipTypeName(type.opposite_id);
  return name;
}

/**
 * The mark a row puts before the partner's title.
 *
 * Only a one-way type without an opposite needs it: the name reads the same on
 * both tracks, so an arrow says which way the fact points — `→` on the source
 * and `←` on the target (REQ-14-RD VC6). Every other type reads its direction
 * in the phrase itself.
 *
 * @param typeId - The type id the relationship stores.
 * @param direction - Which side of the row the reading track is.
 * @returns The arrow, or "" when the phrase already says it.
 */
export function relationshipPartnerArrow(typeId: string, direction: "source" | "target"): string {
  const type = relationshipTypeById(typeId);
  if (!type || type.both_ways || type.opposite_id) return "";
  return direction === "source" ? "→" : "←";
}

/** The colour a type draws in; null means the foreground colour. */
export function relationshipTypeColor(typeId: string): string | null {
  return relationshipTypeById(typeId)?.color ?? null;
}

/** Whether a type reads the same from both tracks. */
export function relationshipTypeBothWays(typeId: string): boolean {
  const type = relationshipTypeById(typeId);
  return type ? type.both_ways : false;
}

/** Whether this is the transition type, whatever it is called (INV-26). */
export function isTransitionType(typeId: string): boolean {
  return typeId === TRANSITION_TYPE_ID;
}

/**
 * The legend entries for the types on screen: one per type, and one for a pair.
 *
 * A type and its opposite state the same fact from the other side, so they share
 * an entry whose label names both (REQ-14-RD VC12).
 */
export interface RelationshipLegendEntry {
  /** The type that heads the entry: the first of the pair the list shows. */
  id: string;
  /** The label: the type's name, or "A / B" for a pair. */
  label: string;
  color: string | null;
  both_ways: boolean;
  isTransition: boolean;
}

/**
 * The legend of the types a set of rows puts on screen.
 *
 * @param typeIds - The type ids the drawing carries.
 * @returns One entry per type, and one per opposite pair, in the list's order.
 */
export function relationshipLegend(typeIds: readonly string[]): RelationshipLegendEntry[] {
  const onScreen = new Set(typeIds);
  const entries: RelationshipLegendEntry[] = [];
  const done = new Set<string>();
  for (const type of types) {
    if (!onScreen.has(type.id) || done.has(type.id)) continue;
    const opposite = type.opposite_id ? relationshipTypeById(type.opposite_id) : undefined;
    if (opposite && onScreen.has(opposite.id)) {
      entries.push({
        id: type.id,
        label: `${type.name} / ${opposite.name}`,
        color: type.color,
        both_ways: false,
        isTransition: isTransitionType(type.id),
      });
      done.add(opposite.id);
    } else {
      entries.push({
        id: type.id,
        label: type.name,
        color: type.color,
        both_ways: type.both_ways,
        isTransition: isTransitionType(type.id),
      });
    }
    done.add(type.id);
  }
  // A type the list does not know still shows, after the ones it does (TM-L1).
  for (const typeId of typeIds) {
    if (done.has(typeId)) continue;
    entries.push({ id: typeId, label: typeId, color: UNKNOWN_COLOR, both_ways: false, isTransition: false });
    done.add(typeId);
  }
  return entries;
}

/** Read the list from the backend. A failure keeps the current copy. */
export async function refreshRelationshipTypes(): Promise<void> {
  types = (await api.get<RelationshipType[]>("/relationship-types")) ?? [];
  loaded = true;
  notify();
}

/** `refreshRelationshipTypes`, but a failed read is not the caller's problem. */
export async function refreshRelationshipTypesQuietly(): Promise<void> {
  try {
    await refreshRelationshipTypes();
  } catch {
    // A failed refresh leaves the in-memory copy; the page still renders.
  }
}

/** Make a new list the current one without a round trip (the Settings page). */
export function setRelationshipTypesForTests(next: RelationshipType[]): void {
  types = next;
  loaded = true;
  notify();
}

/** Test seam: reset the in-memory copy. */
export function __resetRelationshipTypesForTests(): void {
  types = [];
  loaded = false;
  listeners.clear();
}
