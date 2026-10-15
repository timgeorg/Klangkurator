// Track map (issue #8) — shared types fixed up front (plan phase 1a), so
// phases 1b and 2 can run side by side. The shapes follow
// docs/plans/TRACK_MAP_PLAN.md › Types fixed up front, which defers default
// values to docs/requirements/33_TRACK_MAP.md.
import type { Song } from "@/lib/storage";

/** Inputs the similarity composite can weigh. */
export type MapInput =
  | "bpm"
  | "tags"
  | "relationships"
  | "genre"
  | "subgenre"
  | "key"
  | "energy"
  | "danceability"
  | "social_acceptance"
  | "year"
  | "duration";

/** All inputs, in the stable order the map rail lists them. */
export const MAP_INPUTS: readonly MapInput[] = [
  "bpm",
  "tags",
  "relationships",
  "genre",
  "subgenre",
  "key",
  "energy",
  "danceability",
  "social_acceptance",
  "year",
  "duration",
];

export interface InputSetting {
  enabled: boolean;
  /** 0.5–3, step 0.5 (proposed); only `enabled` turns an input off */
  weight: number;
}

export type MapInputs = Record<MapInput, InputSetting>;

/** The spec's default table: key matters least, BPM, tags and relationships most; year and duration start off. */
export const DEFAULT_INPUTS: MapInputs = {
  bpm: { enabled: true, weight: 3 },
  tags: { enabled: true, weight: 3 },
  relationships: { enabled: true, weight: 3 },
  genre: { enabled: true, weight: 2 },
  subgenre: { enabled: true, weight: 2 },
  key: { enabled: true, weight: 0.5 },
  energy: { enabled: true, weight: 1 },
  danceability: { enabled: true, weight: 1 },
  social_acceptance: { enabled: true, weight: 1 },
  year: { enabled: false, weight: 1 },
  duration: { enabled: false, weight: 1 },
};

/** Camelot notation, 1–12, A = minor, B = major; enharmonics share a code. */
export interface CamelotKey {
  n: number; // 1–12
  mode: "A" | "B";
}

/** Values one track carries into the similarity computation. */
export interface TrackFeatures {
  id: string;
  bpm?: number; // missing when absent, ≤ 0 or not finite
  key?: CamelotKey;
  genre?: string; // trackGenre(), trimmed, lowercased for comparing
  genreLabel?: string; // display case, for labels and colour
  subgenres: string[]; // lowercased; [0] is the cluster key
  tagIds: string[];
  energy?: number; // missing when 0 (unrated)
  danceability?: number;
  social_acceptance?: number;
  year?: number;
  duration?: number; // seconds
}

export type ClusterDimension =
  | "genre"
  | "bpmRange"
  | "subgenre"
  | "energy" // Tim's four, in priority order
  | "crate"
  | "artistInitial"; // fallbacks (answer 3)

/** Matched by groupKey(track, dimension). */
export interface ClusterFilter {
  dimension: ClusterDimension;
  value: string;
}

/** Why a cluster dimension was chosen, for the rail's Clusters section (TM-C1). */
export type ClusterChoiceReason =
  /** The first of the four dimensions whose group count is inside the band. */
  | "band"
  /** None fitted the band, so the one nearest it. */
  | "nearest"
  /** No dimension of the four could split the tracks, so the crate or the artist. */
  | "fallback"
  /** Nothing at all can split the tracks: the first `T` by title, with a notice (TM-C10). */
  | "lastResort";

export interface TransitionSource {
  kind: "relationship" | "block" | "set";
  id: string;
  name?: string; // block or set name
  notes: string[]; // unique, in order of appearance
}

export interface MapNode {
  id: string; // song id, or a cluster id (opaque)
  kind: "track" | "cluster";
  label: string;
  coverUrl?: string; // track only
  genreLabel?: string; // for the user's genre colour
  clusterDimension?: ClusterDimension;
  clusterValue?: string;
  count?: number; // cluster only
}

/** Undirected link the layout runs on; source < target. */
export interface MapLink {
  source: string;
  target: string;
  s: number;
}

export interface MapEdge {
  source: string;
  target: string;
  kind: "relationship" | "transition" | "nearest";
  relationshipType?: string; // relationship: one of the seven non-transition types
  sources?: TransitionSource[]; // transition only
}

export interface MapModel {
  nodes: MapNode[];
  /** What the layout uses */
  links: MapLink[];
  /** What the renderer may draw */
  edges: MapEdge[];
  clusterDimension: ClusterDimension | null;
  /** Why the dimension was chosen, for the rail's Clusters section (phase 6, TM-C1); null in track mode. */
  clusterReason?: ClusterChoiceReason | null;
  /** Whether the map fell back to the first `T` tracks by title (phase 6, TM-C10). */
  lastResort?: boolean;
  unlinkedCount: number;
}

export type Positions = Map<string, { x: number; y: number }>;

export interface TrackMapCanvasProps {
  nodes: MapNode[];
  /** Already filtered by the active layers */
  edges: MapEdge[];
  positions: Positions;
  selectedId: string | null;
  playingId: string | null;
  /** The canvas's accessible name */
  label: string;
  onSelect(id: string | null): void;
  /** Issue #32: a double-click on a track plays it (a run of one). */
  onDoubleClick?(id: string): void;
  /** Issue #35: the node under the pointer, with its screen point for a popover. */
  onHover?(id: string | null, clientX: number | null, clientY: number | null): void;
  /** Mid-animation positions, for warm starts */
  onDisplayedPositions?(p: Positions): void;
}

export interface TrackMapCanvasHandle {
  zoomIn(): void;
  zoomOut(): void;
  fit(): void;
  reset(): void;
  centreOn(id: string): void;
  zoomLevel(): number;
}

/** The song shape features.ts will build from (phase 1b), kept here so the
 * types stay mutually referencable without an import cycle. */
export type TrackMapSong = Pick<
  Song,
  | "id"
  | "title"
  | "artist"
  | "bpm"
  | "musical_key"
  | "duration"
  | "mainGenre"
  | "genres"
  | "genre"
  | "subgenres"
  | "year"
  | "artwork_url"
  | "danceability"
  | "energy"
  | "social_acceptance"
  | "root_folder"
>;