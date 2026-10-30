import type { AltTransition, SetItem } from "@/lib/storage";

/** The shape the backend's `SetItem` model validates, and what the editor writes. */
type ItemPayload = {
  id: string;
  type: SetItem["type"];
  ref_id: string;
  position: number;
  transition_notes?: string;
  alternative_transitions: AltTransition[];
};

/**
 * The id a set item points at.
 *
 * The backend stores `ref_id`; a set written by an older version of the app may
 * carry `song_id` or `block_id` instead, so a membership check that read only
 * `ref_id` would miss those and offer a song the set already holds.
 *
 * @param item (SetItem): The item to read.
 * @returns (string): The referenced song or block id, or "" when it has none.
 */
export function itemRef(item: Pick<SetItem, "ref_id"> & { song_id?: string | null; block_id?: string | null }): string {
  return item.ref_id || item.song_id || item.block_id || "";
}

/** Every item a set holds, in the editor's flat list and inside its phases. */
function everyItem(items: SetItem[], phases: SetPhaseLike[]): SetItem[] {
  return [...items, ...phases.flatMap((phase) => (phase.items ?? []) as SetItem[])];
}

type SetPhaseLike = { items?: unknown[] | null };

/**
 * Whether a set already holds this song, in its flat list or inside a phase.
 *
 * The set editor offers each song once per set, and the "Add to set" menu greys
 * a set out on the same rule, so both read this one answer.
 *
 * @param items (SetItem[]): The set's flat running order.
 * @param phases (object[]): The set's phases, if any.
 * @param songId (string): The song to look for.
 * @returns (boolean): True when the set already holds the song.
 */
export function setHasSong(items: SetItem[], phases: SetPhaseLike[] | null | undefined, songId: string): boolean {
  return everyItem(items, phases ?? []).some((item) => item.type === "song" && itemRef(item) === songId);
}

/**
 * The items to save after adding a song to a set, or `null` when the set already
 * holds it.
 *
 * Three rules keep the save faithful to a set the editor could have written:
 *
 * 1. **Every item is normalised** to the backend's `SetItem` shape. Existing
 *    items may carry `song_id`/`block_id` or extra keys, and passing them through
 *    unchanged makes the request fail validation.
 * 2. **Positions are renumbered 0..n-1.** A stored set can have gaps (deleting an
 *    item renumbers on the editor's next save), and `position: items.length` would
 *    then place the new item before the real end.
 * 3. **Phases are untouched.** A set can hold its tracks in `phases` while the
 *    flat editor shows only `items`; the new song goes last of the flat running
 *    order, which is where the editor appends, and the caller sends `items` only.
 *
 * @param items (SetItem[]): The set's flat running order, as stored.
 * @param songId (string): The song to append.
 * @returns (ItemPayload[] | null): The items to save, or `null` when the song is
 *   already in the set.
 */
export function addSongToItems(items: SetItem[], songId: string): ItemPayload[] | null {
  if (items.some((item) => item.type === "song" && itemRef(item) === songId)) return null;

  const normalised: ItemPayload[] = items.map((item, index) => {
    const payload: ItemPayload = {
      id: item.id,
      type: item.type,
      ref_id: itemRef(item),
      position: index,
      alternative_transitions: (item.alternative_transitions ?? []).map(({ ref_id, label }) => ({ ref_id, label })),
    };
    // The editor sends the trimmed note or leaves it out; an empty one is skipped
    // so a set written here matches one written there.
    const notes = item.transition_notes?.trim();
    if (notes) payload.transition_notes = notes;
    return payload;
  });

  normalised.push({
    id: crypto.randomUUID(),
    type: "song",
    ref_id: songId,
    position: normalised.length,
    alternative_transitions: [],
  });
  return normalised;
}
