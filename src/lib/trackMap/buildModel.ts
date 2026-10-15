// Track map (issue #8) — shown tracks and their inputs, assembled into the
// `MapModel` the layout and the renderer read (plan phase 1b, track mode).
// Clusters are phase 6: this runs on a set of tracks and always reports
// `clusterDimension: null`.
import type { SongRelationship } from "@/lib/storage";

import { allNearest, type NearestEntry, type SimilarityOptions } from "./similarity";
import type { Connections } from "./connections";
import { toFeatures } from "./features";
import type { TransitionEdge } from "./transitions";
import type { MapEdge, MapInputs, MapLink, MapModel, MapNode, TrackFeatures, TrackMapSong } from "./types";

/** Everything `buildModel` reads. */
export interface BuildModelInput {
  /** The shown tracks, in the order the nodes keep. */
  songs: readonly TrackMapSong[];
  /** The features of the library's songs (features.ts). */
  features: readonly TrackFeatures[];
  inputs: MapInputs;
  /** connections.ts output; without it the relationships input is skipped. */
  connections?: Connections;
  /** For the relationship edges; `transition` rows become transition edges. */
  relationships?: readonly SongRelationship[];
  /** transitions.ts output, for the transition edges. */
  transitions?: readonly TransitionEdge[];
  /** How many nearest tracks per node; defaults to the plan's `k = 8`. */
  k?: number;
}

/**
 * The map's nodes, links and edges for a set of tracks.
 *
 * Nodes are the shown tracks. Links are the undirected union of the nearest
 * sets: `{A, B}` is linked when `B ∈ nearest(A)` or `A ∈ nearest(B)`, with
 * `s = S(A, B)`. Edges carry what the renderer may draw — the nearest links,
 * the seven non-transition relationship types and the deduplicated
 * transitions — each filtered to pairs of shown tracks.
 *
 * @param input - The shown tracks, their features, the inputs and the edges' sources.
 */
export function buildModel(input: BuildModelInput): MapModel {
  const featureIndex = new Map(input.features.map((feature) => [feature.id, feature]));
  const trackFeatures = input.songs.map((song) => featureIndex.get(song.id) ?? toFeatures(song));
  const shownIds = new Set(trackFeatures.map((feature) => feature.id));

  const options: SimilarityOptions = {
    inputs: input.inputs,
    connections: input.connections,
    k: input.k,
  };

  const nodes: MapNode[] = input.songs.map((song, index) => ({
    id: song.id,
    kind: "track",
    label: song.title,
    coverUrl: song.artwork_url,
    genreLabel: trackFeatures[index].genreLabel,
  }));

  const nearestLists = allNearest(trackFeatures, options);
  const links = buildLinks(nearestLists);
  const unlinkedCount = [...nearestLists.values()].filter((entries) => entries.length === 0).length;

  return {
    nodes,
    links,
    edges: [
      ...links.map((link): MapEdge => ({ source: link.source, target: link.target, kind: "nearest" })),
      ...relationshipEdges(input.relationships ?? [], shownIds),
      ...transitionEdges(input.transitions ?? [], shownIds),
    ],
    clusterDimension: null,
    unlinkedCount,
  };
}

/** The undirected union of the nearest sets, `source < target`, one link per pair. */
function buildLinks(nearestLists: Map<string, NearestEntry[]>): MapLink[] {
  const links = new Map<string, MapLink>();
  for (const [id, entries] of nearestLists) {
    for (const entry of entries) {
      const [source, target] = id < entry.id ? [id, entry.id] : [entry.id, id];
      links.set(`${source}\u0000${target}`, { source, target, s: entry.s });
    }
  }
  return [...links.values()].sort(
    (a, b) =>
      (a.source < b.source ? -1 : a.source > b.source ? 1 : 0) ||
      (a.target < b.target ? -1 : a.target > b.target ? 1 : 0),
  );
}

/** The seven non-transition relationship types, as stored. */
function relationshipEdges(relationships: readonly SongRelationship[], shownIds: Set<string>): MapEdge[] {
  return relationships
    .filter((relationship) => relationship.relationship_type !== "transition")
    .filter((relationship) => shownIds.has(relationship.source_song_id) && shownIds.has(relationship.target_song_id))
    .map((relationship): MapEdge => ({
      source: relationship.source_song_id,
      target: relationship.target_song_id,
      kind: "relationship",
      relationshipType: relationship.relationship_type,
    }));
}

/** The deduplicated transitions, in their `from → to` direction. */
function transitionEdges(transitions: readonly TransitionEdge[], shownIds: Set<string>): MapEdge[] {
  return transitions
    .filter((transition) => shownIds.has(transition.source) && shownIds.has(transition.target))
    .map((transition): MapEdge => ({
      source: transition.source,
      target: transition.target,
      kind: "transition",
      sources: transition.sources,
    }));
}
