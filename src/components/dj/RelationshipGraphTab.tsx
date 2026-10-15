// Track map (issue #8) — the relationships dialog's graph tab (plan phase 2,
// its own module since phase 7). The dialog's graph is a small instance of the
// track map's canvas: the song and its relationship partners, never the whole
// collection, with the same renderer (`TrackMapCanvas`) and the same headless
// layout (`lib/trackMap/layout.ts`).
//
// It lives in its own module so the renderer's modules leave the library's
// first paint: the tab is imported on demand by `SongRelationshipsDialog`, so
// `react-force-graph-2d`, `d3-force` and the layout only arrive when the user
// opens Graph (plan › Risks and spikes › Bundle size, the phase 7 checklist
// item).
import { useMemo } from "react";

import { RelationLine } from "@/components/detail/RelationLine";
import { TrackDetails, type PartnerRow } from "@/components/map/TrackDetails";
import { TrackMapCanvas } from "@/components/map/TrackMapCanvas";
import { RELATIONSHIP_STYLES, RELATIONSHIP_TYPES, RelationshipType } from "@/lib/relationshipStyle";
import type { Song } from "@/lib/storage";
import { trackGenre } from "@/lib/trackFormat";
import { solveLayout, GOLDEN_ANGLE } from "@/lib/trackMap/layout";
import type { MapEdge, MapLink, MapNode, Positions } from "@/lib/trackMap/types";

/** One relationship seen from the dialog's song, as the dialog holds it. */
export interface DialogPartner {
  id: string;
  type: string;
  direction: "source" | "target";
  otherSong: Song;
  notes?: string;
}

/** The constant pull the dialog's links use: the graph is authored, so `s`
 * is not a similarity — it only spreads the partners around their song. */
const DIALOG_LINK_PULL = 0.2;

/** A ring of seeds so the dialog's partners settle around their song. */
const DIALOG_SEED_RADIUS = 100;

interface DialogGraph {
  nodes: MapNode[];
  links: MapLink[];
  edges: MapEdge[];
  positions: Positions;
  /** The relationship types on screen, in the order the legends list them. */
  legend: string[];
}

/**
 * The dialog's graph: its song and that song's relationship partners, never the
 * whole collection. The song sits at the origin with its partners on a seeded
 * ring; the same canvas renderer and the same headless layout draw it.
 */
function buildDialogGraph(song: Song, partners: readonly DialogPartner[]): DialogGraph {
  const seen = new Set<string>([song.id]);
  const others: Song[] = [];
  for (const partner of partners) {
    if (seen.has(partner.otherSong.id)) continue;
    seen.add(partner.otherSong.id);
    others.push(partner.otherSong);
  }

  const nodes: MapNode[] = [song, ...others].map((entry) => ({
    id: entry.id,
    kind: "track",
    label: entry.title,
    coverUrl: entry.artwork_url,
    genreLabel: trackGenre(entry),
  }));

  const edges: MapEdge[] = partners.map((partner) => ({
    source: song.id,
    target: partner.otherSong.id,
    kind: partner.type === "transition" ? "transition" : "relationship",
    relationshipType: partner.type,
  }));

  const links: MapLink[] = others.map((other) => {
    const [source, target] = song.id < other.id ? [song.id, other.id] : [other.id, song.id];
    return { source, target, s: DIALOG_LINK_PULL };
  });

  const seeds: Positions = new Map([[song.id, { x: 0, y: 0 }]]);
  others.forEach((other, index) => {
    const angle = index * GOLDEN_ANGLE - Math.PI / 2;
    const radius = DIALOG_SEED_RADIUS * Math.sqrt(index + 1);
    seeds.set(other.id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  });

  const legend: string[] = [];
  for (const type of RELATIONSHIP_TYPES) {
    if (partners.some((partner) => partner.type === type)) legend.push(type);
  }

  return { nodes, links, edges, positions: solveLayout(nodes, links, seeds), legend };
}

interface RelationshipGraphTabProps {
  /** The dialog's song: the graph's centre, whatever the details are showing. */
  song: Song;
  /** Its relationship partners, all eight types. */
  partners: readonly DialogPartner[];
  /** The track the details show; the graph stays centred on its song. */
  selectedId: string | null;
  /** The playing track, for the orange cut. */
  playingId: string | null;
  /** A node click selects that track. */
  onSelect(id: string | null): void;
  /** The track the details show. */
  shownSong: Song | null;
  /** Its partners, as the details list them. */
  shownPartners: PartnerRow[];
  isPlaying: boolean;
  onPlay(song: Song): void;
  onSongPage(song: Song): void;
  onShowRelationships(song: Song): void;
  /** Open in map: the dialog's way onto the full map, keyed on its song (TM-E3). */
  onOpenInMap(): void;
}

/**
 * The dialog's graph tab: the canvas over the seeded partner ring, the legend of
 * the relationship types on screen, and the selected track's compact details
 * (partners, Play, Song page, Show its relationships, Open in map). Loaded on
 * demand, so the renderer stays out of the library's first paint.
 */
export default function RelationshipGraphTab({
  song,
  partners,
  selectedId,
  playingId,
  onSelect,
  shownSong,
  shownPartners,
  isPlaying,
  onPlay,
  onSongPage,
  onShowRelationships,
  onOpenInMap,
}: RelationshipGraphTabProps) {
  const graph = useMemo(() => buildDialogGraph(song, partners), [partners, song]);
  const graphLabel = `Relationships of ${song.title}: ${graph.nodes.length} tracks`;

  return (
    <div className="space-y-4">
      <div className="h-[24rem] w-full overflow-hidden rounded-lg border border-border">
        <TrackMapCanvas
          nodes={graph.nodes}
          edges={graph.edges}
          positions={graph.positions}
          selectedId={selectedId}
          playingId={playingId}
          label={graphLabel}
          onSelect={onSelect}
        />
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Relationship line styles">
        {graph.legend.map((type) => (
          <li key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RelationLine type={type} />
            {RELATIONSHIP_STYLES[type as RelationshipType]?.label ?? type}
          </li>
        ))}
      </ul>
      {shownSong && (
        <TrackDetails
          song={shownSong}
          partners={shownPartners}
          isPlaying={isPlaying}
          onPlay={onPlay}
          onSongPage={onSongPage}
          onShowRelationships={onShowRelationships}
          onOpenInMap={onOpenInMap}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}
