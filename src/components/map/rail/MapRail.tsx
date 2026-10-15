// Track map — the map's **left** rail (issue #36; built from plan phases 3–6).
// It carries what the map is *showing* (the status line, with the all-off,
// no-match and last-resort reports), the similarity inputs, the shared filters,
// the clusters and the layers. Tim moved these off the right precisely because
// the right rail had grown too long to reach the selected track's details
// without scrolling; the selected track keeps its own rail
// (`SelectedTrackRail`, below).
//
// Both rails collapse as a whole and per section, and both collapse states
// persist (issue #36); collapsed, the canvas takes the freed width and nothing
// overflows sideways. Every control is Tab-reachable, named and shows focus
// (TM-R9).
import { useCallback } from "react";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";

import type { FilterOptions } from "@/components/dj/libraryTable";
import { Button } from "@/components/ui/button";
import type { UseMapConfigReturn } from "@/hooks/useMapConfig";
import type { Song, Tag } from "@/lib/storage";
import { DEFAULT_NODE_THRESHOLD, type ClusterGroup } from "@/lib/trackMap/clusters";
import type { ClusterChoiceReason, ClusterDimension, ClusterFilter, MapEdge } from "@/lib/trackMap/types";
import type { TransitionEdge } from "@/lib/trackMap/transitions";

import type { NearestRow, PartnerRow } from "../TrackDetails";
import { ClustersSection } from "./ClustersSection";
import { FiltersSection } from "./FiltersSection";
import { LayersSection } from "./LayersSection";
import { RailSection } from "./RailSection";
import { SelectedTrackSection } from "./SelectedTrackSection";
import { SimilaritySection } from "./SimilaritySection";

/** The saved ids of the rail's sections, which `useMapConfig` keys the
 * collapse states by. The Clusters section joins them in phase 6. */
type RailSectionId = "similarity" | "filters" | "clusters" | "layers" | "selected";

/** The map-config pieces the rail reads and writes. */
export type RailConfig = Pick<
  UseMapConfigReturn,
  | "inputs"
  | "layers"
  | "railOpen"
  | "leftRailOpen"
  | "enabledCount"
  | "sectionOpen"
  | "setInputEnabled"
  | "setInputWeight"
  | "resetInputs"
  | "setLayer"
  | "setSectionOpen"
  | "setRailOpen"
  | "setLeftRailOpen"
>;

interface MapRailProps {
  config: RailConfig;
  /** The filter options from the loaded library, for the Filters section. */
  filterOptions: FilterOptions;
  /** The core track the map is anchored on, or null (TM-H1). */
  coreSong: Song | null;
  /** Removing the core chip drops the core and `core` from the URL (TM-H2). */
  onRemoveCore(): void;
  /** How many tracks the map shows (the model's nodes). */
  shownCount: number;
  /** How many of them are in no nearest list at all (TM-M11). */
  unlinkedCount: number;
  /** Why an unknown `?focus=` id selected nothing, when that happened (TM-M14). */
  focusNotice: string | null;
  /** Whether the map fell back to the first `T` tracks by title (TM-C10). */
  truncated: boolean;
  /** Whether the shared filters exclude every track (TM-R7). */
  noMatches: boolean;
  /** The dimension the map clustered by, or null (TM-C1). */
  clusterDimension: ClusterDimension | null;
  /** Why it was chosen (TM-C1). */
  clusterReason: ClusterChoiceReason | null;
  /** The clusters with their counts (TM-C1). */
  clusterGroups: ClusterGroup[];
  /** The chosen cluster filters, one chip each (TM-C3). */
  clusterFilters: ClusterFilter[];
  /** Choosing a cluster adds a filter and re-solves (TM-C3). */
  onChooseCluster(dimension: ClusterDimension, value: string): void;
  /** Removing a cluster chip brings the clusters back (TM-C3). */
  onRemoveClusterFilter(filter: ClusterFilter): void;
  /** The edges the canvas is drawing, so the Layers legend names only those (TM-L1, TM-L5). */
  edges: MapEdge[];
  /** The selected track, or null when nothing is selected. */
  song: Song | null;
  tags: Tag[];
  nearest: NearestRow[];
  partners: PartnerRow[];
  transitions: TransitionEdge[];
  songById: Map<string, Song>;
  isPlaying: boolean;
  onPlay(song: Song): void;
  onProperties(song: Song): void;
  onShowRelationships(song: Song): void;
  onSelect(id: string): void;
}

/**
 * The rail beside the map: what the map is showing, and the selected track's
 * details. The rail collapses as a whole from its own header; every section
 * collapses on its own and keeps its header reachable while closed, so the
 * whole rail is keyboard-navigable (TM-R8, TM-R9, TM-R10).
 */
export function MapControlsRail({
  config,
  filterOptions,
  coreSong,
  onRemoveCore,
  shownCount,
  unlinkedCount,
  focusNotice,
  truncated,
  noMatches,
  clusterDimension,
  clusterReason,
  clusterGroups,
  clusterFilters,
  onChooseCluster,
  onRemoveClusterFilter,
  edges,
  song,
  tags,
  nearest,
  partners,
  transitions,
  songById,
  isPlaying,
  onPlay,
  onProperties,
  onShowRelationships,
  onSelect,
}: MapRailProps) {
  const { leftRailOpen, setLeftRailOpen, enabledCount } = config;
  const noInputs = enabledCount === 0;

  const section = useCallback(
    (id: RailSectionId) => ({
      open: config.sectionOpen(id),
      onOpenChange: (next: boolean) => config.setSectionOpen(id, next),
    }),
    [config],
  );

  // Collapsed, the rail is a narrow strip carrying only its own expand control,
  // so the canvas takes the freed width and nothing is cut off (TM-R8).
  if (!leftRailOpen) {
    return (
      <div className="flex w-11 shrink-0 flex-col items-center border-r border-border py-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setLeftRailOpen(true)}
          aria-label="Show the map controls"
          aria-expanded={false}
          title="Show the map controls"
        >
          <PanelLeftOpen />
        </Button>
      </div>
    );
  }

  return (
    // overflow-x-hidden keeps the rail's own layout from ever scrolling
    // sideways at 1280 px with the sidebar open (TM-R8, TM-R10).
    <aside
      aria-label="Map controls"
      className="flex w-80 max-w-[80vw] shrink-0 flex-col overflow-y-auto overflow-x-hidden border-r border-border"
    >
      <div className="shrink-0 border-b border-border px-5 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] text-muted-foreground">
            <span className="k-num">{shownCount}</span> {shownCount === 1 ? "track" : "tracks"} on the map,{" "}
            <span className="k-num">{unlinkedCount}</span> unlinked
          </p>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setLeftRailOpen(false)}
            aria-label="Hide the map controls"
            aria-expanded
            title="Hide the map controls"
          >
            <PanelLeftClose />
          </Button>
        </div>
        {focusNotice && (
          <p role="status" className="mt-1 text-[13px] text-foreground">
            {focusNotice}
          </p>
        )}
        {truncated && (
          <p className="mt-1 text-[13px] text-muted-foreground">
            Showing the first {DEFAULT_NODE_THRESHOLD} tracks by title; the rest need filtering.
          </p>
        )}
        {/* TM-R5: with every input off there is no similarity to compute. */}
        {noInputs && (
          <p role="status" className="mt-1 text-[13px] text-foreground">
            Pick at least one input.
          </p>
        )}
        {/* TM-R7: the shared filters match nothing shown. Reported alongside
            the all-off state when both hold, and on the canvas too. With a core
            active the core's own tracks can be what the filters exclude, so the
            wording promises only that clearing the filters widens the map. */}
        {noMatches && (
          <p role="status" className="mt-1 text-[13px] text-foreground">
            No track matches. Clear the filters to show more.
          </p>
        )}
      </div>

      <RailSection title="Similarity" {...section("similarity")}>
        <SimilaritySection
          inputs={config.inputs}
          onEnabledChange={config.setInputEnabled}
          onWeightCommit={config.setInputWeight}
          onReset={config.resetInputs}
        />
      </RailSection>

      <RailSection title="Filters" {...section("filters")}>
        <FiltersSection
          options={filterOptions}
          coreSong={coreSong}
          onRemoveCore={onRemoveCore}
          clusterFilters={clusterFilters}
          onRemoveClusterFilter={onRemoveClusterFilter}
        />
      </RailSection>

      {/* The clusters (phase 6): the dimension, the reason it was chosen, and
          the clusters with their counts. Choosing one narrows the map to its
          members and re-solves (TM-C1, TM-C3). Tags are never a dimension
          (TM-C5): the section knows only the six cluster dimensions. */}
      <RailSection title="Clusters" {...section("clusters")}>
        <ClustersSection
          dimension={clusterDimension}
          reason={clusterReason}
          groups={clusterGroups}
          onChoose={onChooseCluster}
          active={clusterFilters}
          threshold={DEFAULT_NODE_THRESHOLD}
          shownCount={shownCount}
        />
      </RailSection>

      {/* The layers (phase 5): one switch per edge kind, and the legend of what
          is drawn. Switching one redraws the canvas and moves nothing — the
          layers are no part of the model the layout is solved from (TM-L4). */}
      <RailSection title="Layers" {...section("layers")}>
        <LayersSection layers={config.layers} onLayerChange={config.setLayer} edges={edges} />
      </RailSection>
    </aside>
  );
}

/** What the right rail needs: the rail's own collapse, and the selected track. */
export type SelectedTrackRailProps = Pick<
  MapRailProps,
  | "song"
  | "tags"
  | "nearest"
  | "partners"
  | "transitions"
  | "songById"
  | "isPlaying"
  | "onPlay"
  | "onProperties"
  | "onShowRelationships"
  | "onSelect"
> & {
  config: Pick<RailConfig, "railOpen" | "sectionOpen" | "setSectionOpen" | "setRailOpen">;
};

/**
 * The right-hand rail (issue #36): the selected track, and nothing else. Tim
 * asked for the similarity, filters, layers and clusters to move left precisely
 * because this rail was too long to reach the details without scrolling; with
 * nothing selected it shows today's empty state.
 */
export function SelectedTrackRail({
  config,
  song,
  tags,
  nearest,
  partners,
  transitions,
  songById,
  isPlaying,
  onPlay,
  onProperties,
  onShowRelationships,
  onSelect,
}: SelectedTrackRailProps) {
  const { railOpen, setRailOpen } = config;
  const section = useCallback(
    (id: RailSectionId) => ({
      open: config.sectionOpen(id),
      onOpenChange: (next: boolean) => config.setSectionOpen(id, next),
    }),
    [config],
  );

  if (!railOpen) {
    return (
      <div className="flex w-11 shrink-0 flex-col items-center border-l border-border py-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setRailOpen(true)}
          aria-label="Show the selected track"
          aria-expanded={false}
          title="Show the selected track"
        >
          <PanelRightOpen />
        </Button>
      </div>
    );
  }

  return (
    <aside
      aria-label="Selected track"
      className="flex w-80 max-w-[80vw] shrink-0 flex-col overflow-y-auto overflow-x-hidden border-l border-border"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-5 py-3">
        <p className="text-[13px] text-muted-foreground">Selected track</p>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setRailOpen(false)}
          aria-label="Hide the selected track"
          aria-expanded
          title="Hide the selected track"
        >
          <PanelRightClose />
        </Button>
      </div>
      <SelectedTrackSection
        {...section("selected")}
        song={song}
        tags={tags}
        nearest={nearest}
        partners={partners}
        transitions={transitions}
        songById={songById}
        isPlaying={isPlaying}
        onPlay={onPlay}
        onProperties={onProperties}
        onShowRelationships={onShowRelationships}
        onSelect={onSelect}
      />
    </aside>
  );
}

