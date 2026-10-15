// Track map (issue #8) — the core (plan phase 4b, TM-H1–TM-H3): the song named
// by `?core=<id>` together with its relationship partners. The URL carries only
// the id, never the members, so they are recomputed from the loaded
// relationships on every arrival — a reload keeps the core (REQ-33-SV,
// REQ-33-DG), and the map is anchored on one track's neighbourhood.
//
// "Its relationship partners" is the dialog's own list: any of the eight
// relationship types, either direction round (`14_RELATIONSHIPS.md`). It is
// deliberately not the wider `R(t)` of connections.ts, which also counts
// transitions found in a block's or a set's running order — those are a
// similarity input, not a partner.
import type { SongRelationship } from "@/lib/storage";

/**
 * The core's members: the song itself and every track it has a relationship
 * with, in either direction, of any of the eight types.
 *
 * @param coreId - The core song's id.
 * @param relationships - All `song_relationships` rows.
 * @returns The members' ids, the core's own id included; an empty set for an
 *   empty core id, and never an empty id.
 */
export function coreMemberIds(coreId: string, relationships: readonly SongRelationship[]): Set<string> {
  const members = new Set<string>();
  if (!coreId) return members;
  members.add(coreId);
  for (const relationship of relationships) {
    if (relationship.source_song_id === coreId) addPartner(members, relationship.target_song_id);
    else if (relationship.target_song_id === coreId) addPartner(members, relationship.source_song_id);
  }
  return members;
}

/** Adds a partner's id, skipping an empty one as `connect` in connections.ts does. */
function addPartner(members: Set<string>, id: string): void {
  if (id) members.add(id);
}
