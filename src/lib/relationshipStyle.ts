import type { SongRelationship } from "@/lib/storage";

export type RelationshipType = SongRelationship["relationship_type"];

export interface RelationshipStyle {
  /** Short name for legends and pickers. */
  label: string;
  /** How the relation reads from the song that is the source. */
  asSource: string;
  /** How it reads from the song that is the target. */
  asTarget: string;
  /** Palette colour; null means the foreground colour (transitions). */
  color: string | null;
  /** Canvas/SVG dash pattern in px; empty = solid. */
  dash: number[];
  width: number;
}

/**
 * One fixed line language per relationship type, shared by the graph, the
 * relationship lists and the legend. Colours come from the user palette
 * (never orange, which marks the selected or hovered item). Transitions are
 * first-class, so they are drawn in the foreground colour and heaviest.
 */
export const RELATIONSHIP_STYLES: Record<RelationshipType, RelationshipStyle> = {
  transition: { label: "Transition", asSource: "Transitions into", asTarget: "Transitioned from", color: null, dash: [], width: 2.5 },
  remix: { label: "Remix", asSource: "Is a remix of", asTarget: "Remixed by", color: "#6B5BD6", dash: [], width: 1.5 },
  edit: { label: "Edit", asSource: "Is an edit of", asTarget: "Edited by", color: "#4E9A2A", dash: [], width: 1.5 },
  cover: { label: "Cover", asSource: "Is a cover of", asTarget: "Covered by", color: "#2F6BD8", dash: [], width: 1.5 },
  mashup: { label: "Mashup", asSource: "Mashed up with", asTarget: "Mashed up in", color: "#E0607E", dash: [6, 4], width: 1.5 },
  bootleg: { label: "Bootleg", asSource: "Is a bootleg of", asTarget: "Bootlegged by", color: "#B3684A", dash: [6, 4], width: 1.5 },
  same_sample: {
    label: "Same sample",
    asSource: "Shares a sample with",
    asTarget: "Shares a sample with",
    color: "#C9A227",
    dash: [1.5, 4],
    width: 2,
  },
  in_playlist: {
    label: "In playlist",
    asSource: "In a playlist with",
    asTarget: "In a playlist with",
    color: "#6D7480",
    dash: [1.5, 4],
    width: 2,
  },
};

/** Types in the order pickers and legends list them. */
export const RELATIONSHIP_TYPES = Object.keys(RELATIONSHIP_STYLES) as RelationshipType[];

export function relationshipStyle(type: string): RelationshipStyle {
  return (
    RELATIONSHIP_STYLES[type as RelationshipType] ?? {
      label: type,
      asSource: type,
      asTarget: type,
      color: "#6D7480",
      dash: [],
      width: 1.5,
    }
  );
}

export function relationshipPhrase(type: string, direction: "source" | "target"): string {
  const style = relationshipStyle(type);
  return direction === "source" ? style.asSource : style.asTarget;
}
