// Track map (issue #8) — the map rail's Similarity section (plan phase 4a):
// one row per input, a switch that turns it on or off and a weight from 0.5 to
// 3 (step 0.5), and Reset to defaults. A switch commits at once; a weight
// commits on release, which is what lets the page turn a drag into one
// re-solve (TM-R1, TM-R4; the plan's "Weights commit on release").
import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { MAP_WEIGHT_MAX, MAP_WEIGHT_MIN, MAP_WEIGHT_STEP } from "@/hooks/useMapConfig";
import { MAP_INPUTS, type MapInput, type MapInputs } from "@/lib/trackMap/types";

/** The input names the rail shows, in `MAP_INPUTS` order. */
const INPUT_LABELS: Record<MapInput, string> = {
  bpm: "BPM",
  tags: "Tags",
  relationships: "Relationships",
  genre: "Genre",
  subgenre: "Subgenre",
  key: "Key",
  energy: "Energy",
  danceability: "Danceability",
  social_acceptance: "Social acceptance",
  year: "Year",
  duration: "Duration",
};

interface SimilaritySectionProps {
  inputs: MapInputs;
  /** A switch commits at once (TM-R1). */
  onEnabledChange(input: MapInput, enabled: boolean): void;
  /** A weight commits when the slider is released. */
  onWeightCommit(input: MapInput, weight: number): void;
  /** Every input and weight back to the spec's default table (TM-R4). */
  onReset(): void;
}

/** A weight as it reads in mono: 3 for 3, 0.5 for 0.5. */
const formatWeight = (weight: number): string => String(Number(weight.toFixed(1)));

/** The weights as the sliders are dragging them, keyed by input. */
const draftsOf = (inputs: MapInputs): Record<MapInput, number> =>
  Object.fromEntries(
    MAP_INPUTS.map((input): [MapInput, number] => [input, inputs[input].weight]),
  ) as Record<MapInput, number>;

/**
 * The similarity inputs and their weights. The weight sliders hold a draft
 * while they are dragged and hand the value over on release, so one drag is one
 * change; the switch commits its own change at once.
 */
export function SimilaritySection({ inputs, onEnabledChange, onWeightCommit, onReset }: SimilaritySectionProps) {
  const [drafts, setDrafts] = useState<Record<MapInput, number>>(() => draftsOf(inputs));

  // A commit (or a reset) lands in `inputs`; the drafts follow it, so the
  // slider agrees with the saved weight once the drag is over.
  useEffect(() => {
    setDrafts(draftsOf(inputs));
  }, [inputs]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        What two tracks are compared on, and how much each input counts. A track without a value is skipped for that
        pair.
      </p>

      <ul className="space-y-2.5">
        {MAP_INPUTS.map((input) => {
          const label = INPUT_LABELS[input];
          const setting = inputs[input];
          return (
            <li key={input} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium">{label}</span>
                <span className="flex items-center gap-2">
                  <span className="k-num text-xs text-muted-foreground">{formatWeight(drafts[input])}</span>
                  <Switch
                    checked={setting.enabled}
                    onCheckedChange={(checked) => onEnabledChange(input, checked)}
                    aria-label={`${label} input`}
                  />
                </span>
              </div>
              <Slider
                aria-label={`${label} weight`}
                min={MAP_WEIGHT_MIN}
                max={MAP_WEIGHT_MAX}
                step={MAP_WEIGHT_STEP}
                value={[drafts[input]]}
                onValueChange={([weight]) => setDrafts((prev) => ({ ...prev, [input]: weight }))}
                onValueCommit={([weight]) => onWeightCommit(input, weight)}
              />
            </li>
          );
        })}
      </ul>

      <Button variant="outline" size="sm" onClick={onReset}>
        <RotateCcw />
        Reset to defaults
      </Button>
    </div>
  );
}
