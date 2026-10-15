// Track map (issue #8) — the map rail's Clusters section (plan phase 6). It
// names the dimension the map clustered by and why it was chosen (the first
// inside the band, the one nearest it, or one of the two fallbacks), and lists
// the clusters with their counts, so the map says what its nodes are (TM-C1,
// REQ-33-CL). Choosing a cluster there does what choosing it on the canvas
// does: it adds a `ClusterFilter` and re-solves (TM-C3). Tags never cluster
// (TM-C5), so the section can never name them: the dimensions it knows are the
// six `ClusterDimension` values, and tags are not one of them.
import { Button } from "@/components/ui/button";
import { CLUSTER_DIMENSION_LABELS, C_MAX, C_MIN, type ClusterGroup } from "@/lib/trackMap/clusters";
import type { ClusterChoiceReason, ClusterDimension } from "@/lib/trackMap/types";
import { cn } from "@/lib/utils";

/** Why the dimension was chosen, as the section reads it (TM-C1). */
const REASON_TEXT: Record<ClusterChoiceReason, string> = {
  band: `inside the ${C_MIN}–${C_MAX} group band`,
  nearest: "no dimension fitted the band, so the one nearest it",
  fallback: "none of the four could split the tracks, so a fallback",
  lastResort: "nothing could split the tracks",
};

interface ClustersSectionProps {
  /** The dimension the map clustered by, or null in track mode or the last resort. */
  dimension: ClusterDimension | null;
  /** Why it was chosen; null in track mode. */
  reason: ClusterChoiceReason | null;
  /** The clusters, in node order, with their counts (TM-C1). */
  groups: ClusterGroup[];
  /** Choosing one adds a `ClusterFilter` and re-solves (TM-C3). */
  onChoose(dimension: ClusterDimension, value: string): void;
  /** The cluster filters already chosen, so a listed one reads as active. */
  active: { dimension: ClusterDimension; value: string }[];
  /** The node threshold, so the section says why there are no clusters below it. */
  threshold: number;
  /** How many tracks the map is showing. */
  shownCount: number;
}

/**
 * The Clusters section: the dimension, the reason and the clusters with their
 * counts. Below the threshold there is nothing to cluster, and the section says
 * so; above it, each listed cluster is a named, Tab-reachable button that
 * narrows the map to exactly its members, like choosing it on the canvas.
 */
export function ClustersSection({
  dimension,
  reason,
  groups,
  onChoose,
  active,
  threshold,
  shownCount,
}: ClustersSectionProps) {
  if (dimension === null) {
    return (
      <p className="text-xs text-muted-foreground">
        {reason === "lastResort"
          ? "No dimension can split these tracks; the map shows the first tracks by title. Filter the library to see fewer."
          : `The map clusters above ${threshold} tracks. ${shownCount} ${shownCount === 1 ? "track is" : "tracks are"} on the map, so every track shows on its own.`}
      </p>
    );
  }

  const label = CLUSTER_DIMENSION_LABELS[dimension];
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Clustered by <span className="text-foreground">{label}</span> — {REASON_TEXT[reason ?? "band"]}. Choose a cluster
        to show exactly its tracks; if they are still too many, the map clusters them again.
      </p>
      <ul aria-label={`${label} clusters`} className="space-y-1">
        {groups.map((group) => {
          const isActive = active.some((filter) => filter.dimension === dimension && filter.value === group.value);
          return (
            <li key={group.value}>
              <Button
                variant="ghost"
                size="sm"
                aria-pressed={isActive}
                onClick={() => onChoose(dimension, group.value)}
                className={cn(
                  "flex h-7 w-full items-center justify-between gap-2 rounded-chip px-2 text-[13px]",
                  isActive && "bg-accent font-medium",
                )}
              >
                <span className="truncate text-left">{group.label}</span>
                <span className="k-num shrink-0 text-xs text-muted-foreground">{group.count}</span>
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
