// Track map (issue #8) — the map rail's selected-track section (plan phase 3).
// It is the full TrackDetails (BPM, key, genre, ratings, tags, the nearest
// tracks with their percentages, the relationship partners and the
// transitions), so the map's selection stays DOM and keyboard-readable
// (REQ-33-AX); the canvas is only ever the picture.
import { TrackDetails, type NearestRow, type PartnerRow } from "@/components/map/TrackDetails";
import type { Song, Tag } from "@/lib/storage";
import type { TransitionEdge } from "@/lib/trackMap/transitions";

import { RailSection } from "./RailSection";

interface SelectedTrackSectionProps {
  /** The selected track, or null when nothing is selected. */
  song: Song | null;
  /** The selected track's tags, for the tag chips. */
  tags: Tag[];
  /** Its nearest tracks under the current inputs, each with its similarity. */
  nearest: NearestRow[];
  /** Its relationship partners; an entry selects that track. */
  partners: PartnerRow[];
  /** The transition facts on the map; the details split them into in and out. */
  transitions: TransitionEdge[];
  /** Resolves the other end of a transition to its track. */
  songById: Map<string, Song>;
  isPlaying: boolean;
  onPlay(song: Song): void;
  onProperties(song: Song): void;
  onShowRelationships(song: Song): void;
  onSelect(id: string): void;
}

/** The selected track's details, in the rail's collapsible section. */
export function SelectedTrackSection({
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
}: SelectedTrackSectionProps) {
  return (
    <RailSection title="Selected track">
      {song ? (
        <TrackDetails
          song={song}
          variant="full"
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
      ) : (
        <p className="text-[13px] text-muted-foreground">
          No track selected. Click a track on the map, or open a track's link with <span className="k-num">?focus=</span>.
        </p>
      )}
    </RailSection>
  );
}
