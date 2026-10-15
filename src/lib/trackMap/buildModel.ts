// Track map (issue #8) — shown tracks and their inputs, assembled into the
// `MapModel` the layout and the renderer read (plan phase 1b, track mode;
// plan phase 6, cluster mode). Above the node threshold the shown tracks
// become cluster nodes and cluster links instead of track nodes; the fallbacks
// (crate, then the artist's first letter) and the last resort (the first `T`
// tracks by title, with a notice) are the cluster module's, and a model that
// took one of them says so on `clusterDimension` and `clusterReason`.
import type { SongRelationship } from "@/lib/storage";

import { allNearest, linksFromNearest, type SimilarityOptions } from "./similarity";
import type { Connections } from "./connections";
import {
  buildClusters,
  clusterChoice,
  DEFAULT_NODE_THRESHOLD,
  shouldCluster,
  withClusterFields,
  type ClusterTrack,
} from "./clusters";
import { toFeatures } from "./features";
import type { TransitionEdge } from "./transitions";
import type {
  MapEdge,
  MapInputs,
  MapModel,
  MapNode,
  TrackFeatures,
  TrackMapSong,
} from "./types";

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
  /** The node threshold above which the map clusters; defaults to `DEFAULT_NODE_THRESHOLD`. */
  threshold?: number;
}

/**
 * The map's nodes, links and edges for a set of tracks.
 *
 * Below the node threshold the nodes are the shown tracks and the links are the
 * undirected union of their nearest sets. Above it the tracks collapse into one
 * cluster node per value of the chosen dimension (phase 6), and the layout runs
 * over the clusters; `lastResort` is true when not even the fallbacks could
 * split the tracks, so the caller shows the first `T` by title with a notice.
 * Edges carry what the renderer may draw — the nearest (or cluster) links, the
 * seven non-transition relationship types and the deduplicated transitions.
 *
 * @param input - The shown tracks, their features, the inputs and the edges' sources.
 */
export function buildModel(input: BuildModelInput): MapModel {
  const threshold = input.threshold ?? DEFAULT_NODE_THRESHOLD;
  if (!shouldCluster(input.songs.length, threshold)) return trackModel(input, input.songs);

  const tracks = toClusterTracks(input.songs, input.features);
  const choice = clusterChoice(tracks);

  // The last resort: nothing can split the tracks, so the first `T` by title are
  // shown as tracks and the caller adds the notice (TM-C10). The slice happens
  // here, so the expensive pairwise similarity never runs over all N.
  if (choice.dimension === null) {
    const ordered = [...input.songs].sort((a, b) => collator.compare(a.title, b.title) || compare(a.id, b.id));
    return { ...trackModel(input, ordered.slice(0, threshold)), clusterReason: "lastResort", lastResort: true };
  }

  const build = buildClusters({
    tracks,
    dimension: choice.dimension,
    inputs: input.inputs,
    connections: input.connections,
  });
  return {
    nodes: build.nodes,
    links: build.links,
    // The cluster links are the map's "nearest" edges. A cluster node is not a
    // song, so no authored edge can name one: the two authored filters drop
    // every edge, because the shown ids are the cluster ids.
    edges: [
      ...build.links.map((link): MapEdge => ({ source: link.source, target: link.target, kind: "nearest" })),
      ...relationshipEdges(input.relationships ?? [], shownIdsOf(build.nodes)),
      ...transitionEdges(input.transitions ?? [], shownIdsOf(build.nodes)),
    ],
    clusterDimension: choice.dimension,
    clusterReason: choice.reason,
    lastResort: false,
    unlinkedCount: build.unlinkedCount,
  };
}

/** Track mode: one node per shown song, links from the undirected nearest sets. */
function trackModel(input: BuildModelInput, songs: readonly TrackMapSong[]): MapModel {
  const featureIndex = new Map(input.features.map((feature) => [feature.id, feature]));
  const trackFeatures = songs.map((song) => featureIndex.get(song.id) ?? toFeatures(song));
  const shownIds = new Set(trackFeatures.map((feature) => feature.id));

  const nodes: MapNode[] = songs.map((song, index) => ({
    id: song.id,
    kind: "track",
    label: song.title,
    coverUrl: song.artwork_url,
    genreLabel: trackFeatures[index].genreLabel,
  }));

  const options: SimilarityOptions = { inputs: input.inputs, connections: input.connections, k: input.k };
  const nearestLists = allNearest(trackFeatures, options);
  const links = linksFromNearest(nearestLists);

  return {
    nodes,
    links,
    edges: [
      ...links.map((link): MapEdge => ({ source: link.source, target: link.target, kind: "nearest" })),
      ...relationshipEdges(input.relationships ?? [], shownIds),
      ...transitionEdges(input.transitions ?? [], shownIds),
    ],
    clusterDimension: null,
    clusterReason: null,
    lastResort: false,
    unlinkedCount: [...nearestLists.values()].filter((entries) => entries.length === 0).length,
  };
}

/** The shown songs in their cluster view, features paired up by song id. */
function toClusterTracks(
  songs: readonly TrackMapSong[],
  features: readonly TrackFeatures[],
): ClusterTrack[] {
  const featureIndex = new Map(features.map((feature) => [feature.id, feature]));
  return songs.map((song) => withClusterFields(song, featureIndex.get(song.id) ?? toFeatures(song)));
}

/** The ids of a set of nodes, for filtering the authored edges to what is shown. */
function shownIdsOf(nodes: readonly MapNode[]): Set<string> {
  return new Set(nodes.map((node) => node.id));
}

/** A plain code-unit comparison, so a map never depends on a locale. */
function compare(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** The title order the last resort uses, the same one the page's stopgap used. */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

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
