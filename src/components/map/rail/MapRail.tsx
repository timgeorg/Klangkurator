// Track map (issue #8) — the map rail (plan phase 3): the status line at the
// top and its sections below it. Phase 3 carries the selected track and the
// section-collapse scaffolding; phase 4a adds the Similarity, Filters, Layers
// and Clusters sections and the rail's own collapse.
import type { Song, Tag } from "@/lib/storage";
import { DEFAULT_NODE_THRESHOLD } from "@/lib/trackMap/clusters";
import type { TransitionEdge } from "@/lib/trackMap/transitions";

import type { NearestRow, PartnerRow } from "../TrackDetails";
import { SelectedTrackSection } from "./SelectedTrackSection";

interface MapRailProps {
  /** How many tracks the map shows (the model's nodes). */
  shownCount: number;
  /** How many of them are in no nearest list at all (TM-M11). */
  unlinkedCount: number;
  /** Why an unknown `?focus=` id selected nothing, when that happened (TM-M14). */
  focusNotice: string | null;
  /** Whether the library is larger than the node threshold, so only the first `T` show. */
  truncated: boolean;
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
 * details. Every section is collapsible and its header stays reachable while
 * closed, so the rail is fully keyboard-navigable (TM-R9, TM-R10).
 */
export function MapRail({
  shownCount,
  unlinkedCount,
  focusNotice,
  truncated,
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
  return (
    <aside aria-label="Map controls" className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-border">
      <div className="shrink-0 border-b border-border px-5 py-3">
        <p className="text-[13px] text-muted-foreground">
          <span className="k-num">{shownCount}</span> {shownCount === 1 ? "track" : "tracks"} on the map,{" "}
          <span className="k-num">{unlinkedCount}</span> unlinked
        </p>
        {focusNotice && (
          <p role="status" className="mt-1 text-[13px] text-foreground">
            {focusNotice}
          </p>
        )}
        {truncated && (
          <p className="mt-1 text-[13px] text-muted-foreground">
            Showing the first {DEFAULT_NODE_THRESHOLD} tracks by title; the rest need filtering. Clustering larger
            libraries comes in a later phase.
          </p>
        )}
      </div>

      <SelectedTrackSection
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
