// Track map (issue #8) — who is connected to whom, undirected (plan phase
// 1b). This is the plan's `R(t)`: a relationship of any of the eight types in
// either direction, and every transition fact in either direction. The
// similarity composite reads it through `relationshipSimilarity`.
import type { SongRelationship } from "@/lib/storage";

import type { TransitionEdge } from "./transitions";

/** The undirected neighbours of each song id (the plan's `R(t)`). */
export type Connections = Map<string, Set<string>>;

const NOBODY: ReadonlySet<string> = new Set();

/**
 * A song's connections, or an empty set when it has none.
 *
 * @param connections - The built connections, or undefined for "none known".
 * @param id - The song id.
 */
export function connectionSet(connections: Connections | undefined, id: string): ReadonlySet<string> {
  return connections?.get(id) ?? NOBODY;
}

/**
 * Whether two songs are connected, either way round.
 *
 * @param connections - The built connections.
 * @param a - One song id.
 * @param b - The other song id.
 */
export function isConnected(connections: Connections | undefined, a: string, b: string): boolean {
  return connectionSet(connections, a).has(b);
}

/**
 * Every connection in the library, undirected.
 *
 * @param relationships - All `song_relationships` rows; every one of the
 *   eight types counts, `transition` included.
 * @param transitions - The transition facts, transitions.ts; their pairs
 *   count as connections too.
 */
export function buildConnections(
  relationships: readonly SongRelationship[],
  transitions: readonly TransitionEdge[] = [],
): Connections {
  const connections: Connections = new Map();
  for (const relationship of relationships) {
    connect(connections, relationship.source_song_id, relationship.target_song_id);
  }
  for (const transition of transitions) {
    connect(connections, transition.source, transition.target);
  }
  return connections;
}

/** Adds a pair both ways; a song is never its own connection. */
function connect(connections: Connections, a: string, b: string): void {
  if (!a || !b || a === b) return;
  neighboursOf(connections, a).add(b);
  neighboursOf(connections, b).add(a);
}

function neighboursOf(connections: Connections, id: string): Set<string> {
  let neighbours = connections.get(id);
  if (!neighbours) {
    neighbours = new Set();
    connections.set(id, neighbours);
  }
  return neighbours;
}
