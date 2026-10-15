// Track map (issue #8) — the map rail's Layers section (plan phase 5). Three
// switches, one per layer (REQ-33-LY): **Relationships** (the seven
// non-transition types, each drawn in its own line style), **Transitions** (one
// edge per direction, deduplicated across its sources, with its notes) and
// **Nearest** (the selected track's nearest tracks, computed). The legend below
// them names every kind the canvas is actually drawing — the computed ones
// (nearest and transition) and the authored relationship types on screen — each
// with its line style, so computed and authored edges are told apart (TM-L1,
// TM-L5).
//
// The switches write the `layers` slice of `useMapConfig`, saved under
// `klangkurator.map.v1`, so a layer switched off is still off after a reload
// (TM-L7). Nothing here is a dependency of the model: a switch changes what is
// drawn and never re-solves the layout, so no node moves (TM-L4).
import { Switch } from "@/components/ui/switch";
import type { MapLayers } from "@/hooks/useMapConfig";
import { RELATIONSHIP_STYLES, RELATIONSHIP_TYPES, relationshipStyle, type RelationshipType } from "@/lib/relationshipStyle";
import { onScreenEdgeKinds } from "@/lib/trackMap/layerEdges";
import type { MapEdge } from "@/lib/trackMap/types";
import { cn } from "@/lib/utils";

/** The seven non-transition relationship types the Relationships layer draws. */
const AUTHORED_TYPES: RelationshipType[] = RELATIONSHIP_TYPES.filter((type) => type !== "transition");

/** The layer switches, in the order the section lists them. */
const LAYER_ROWS: { id: keyof MapLayers; label: string; hint: string }[] = [
  {
    id: "relationships",
    label: "Relationships",
    hint: "The authored links between tracks, each type in its own line style.",
  },
  {
    id: "transitions",
    label: "Transitions",
    hint: "One edge per direction, from relationships, blocks and sets, with its notes.",
  },
  {
    id: "nearest",
    label: "Nearest",
    hint: "The selected track's nearest tracks under the current inputs.",
  },
];

/**
 * One legend line sample, drawn as the canvas draws that kind of edge: a
 * relationship type in its own palette style, a transition in the foreground at
 * the heaviest weight, and a nearest track thin and neutral — the two kinds
 * never read alike (TM-L5). Authored kinds, which carry direction on the map,
 * are shown with the small arrowhead the canvas draws.
 */
function EdgeLineSample({ kind, type }: { kind: "relationship" | "transition" | "nearest"; type?: string }) {
  // A relationship type reads through `relationshipStyle`, so the legend matches
  // the canvas line for line, an unnamed type included.
  const style = kind === "relationship" ? relationshipStyle(type ?? "") : null;
  const width = kind === "transition" ? 2.5 : kind === "nearest" ? 1 : style?.width ?? 1.5;
  const dash = kind === "relationship" ? style?.dash ?? [] : [];
  const authored = kind !== "nearest";
  // A relationship type's colour is the palette's own, like `RelationLine`; the
  // transition and the nearest track are token colours, never orange (TM-M12).
  const colour = authored && style?.color ? { color: style.color } : undefined;

  return (
    <svg
      viewBox="0 0 24 8"
      aria-hidden
      className={cn(
        "h-2 w-6 shrink-0",
        kind === "transition" && "text-foreground",
        kind === "nearest" && "text-border",
        kind === "relationship" && !style?.color && "text-foreground",
      )}
      style={colour}
    >
      <line
        x1="2"
        y1="4"
        x2={authored ? 19 : 22}
        y2="4"
        stroke="currentColor"
        strokeWidth={width}
        strokeDasharray={dash.length ? dash.join(" ") : undefined}
        strokeLinecap="round"
      />
      {authored && <polygon points="22,4 17.5,6.2 17.5,1.8" fill="currentColor" />}
    </svg>
  );
}

interface LayersSectionProps {
  layers: MapLayers;
  /** Writes one layer's switch; saved, so it survives a reload (TM-L7). */
  onLayerChange(layer: keyof MapLayers, on: boolean): void;
  /** The edges the canvas is drawing, so the legend names only what is on screen. */
  edges: readonly MapEdge[];
}

/**
 * The three edge layers and the legend of what is drawn. Each switch is named
 * and Tab-reachable, and turning one off hides that kind of edge and nothing
 * else: the nodes keep their places, because the layers are no part of the
 * model the layout is solved from (TM-L4).
 */
export function LayersSection({ layers, onLayerChange, edges }: LayersSectionProps) {
  const kinds = onScreenEdgeKinds(edges);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        What the map draws. Switching a layer changes the drawing only — the tracks stay where they are.
      </p>

      <ul className="space-y-3">
        {LAYER_ROWS.map((row) => (
          <li key={row.id} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium">{row.label}</span>
              <Switch
                checked={layers[row.id]}
                onCheckedChange={(checked) => onLayerChange(row.id, checked)}
                aria-label={`${row.label} layer`}
              />
            </div>
            <p className="text-xs text-muted-foreground">{row.hint}</p>
            {/* The seven non-transition types the layer draws, each in its own
                line style, so the switch's scope is legible (REQ-33-LY, TM-L1). */}
            {row.id === "relationships" && (
              <ul aria-label="Relationship types in this layer" className="flex flex-wrap gap-x-3 gap-y-1.5 pt-0.5">
                {AUTHORED_TYPES.map((type) => (
                  <li key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <EdgeLineSample kind="relationship" type={type} />
                    {RELATIONSHIP_STYLES[type].label}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      <div className="space-y-2">
        <h2 className="text-[13px] font-semibold">Edge legend</h2>

        {/* The computed kinds first: what the map worked out, drawn differently
            from the authored links (TM-L5). */}
        <p className="text-xs text-muted-foreground">Computed</p>
        {kinds.nearest || kinds.transitions ? (
          <ul aria-label="Computed edge kinds" className="space-y-1.5">
            {kinds.nearest && (
              <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <EdgeLineSample kind="nearest" />
                Nearest track
              </li>
            )}
            {kinds.transitions && (
              <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <EdgeLineSample kind="transition" />
                Transition
              </li>
            )}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">None on screen.</p>
        )}

        {/* The authored kinds on screen, in the palette's own order (TM-L1). */}
        <p className="text-xs text-muted-foreground">Authored</p>
        {kinds.relationshipTypes.length > 0 ? (
          <ul aria-label="Relationship line styles" className="space-y-1.5">
            {kinds.relationshipTypes.map((type) => (
              <li key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <EdgeLineSample kind="relationship" type={type} />
                {relationshipStyle(type).label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            {layers.relationships ? "None on screen." : "Switched off."}
          </p>
        )}
      </div>
    </div>
  );
}
