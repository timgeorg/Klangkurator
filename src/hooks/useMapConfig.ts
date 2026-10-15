// Track map (issue #8) — the map's saved settings (plan phase 4a): the
// similarity inputs and their weights, the layers slice phase 5 reads, the
// collapse states of the map rail and of each of its sections, and the whole
// rail's own collapse. They persist like the app's other saved UI state
// (`klangkurator.map.v1`, the same shape of key as the column configuration and
// the dock preference), and what is read back is validated: a stored value that
// does not fit is replaced by the default (REQ-33-PS).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  DEFAULT_INPUTS,
  MAP_INPUTS,
  type InputSetting,
  type MapInput,
  type MapInputs,
} from "@/lib/trackMap/types";

/** The save key the plan pins for the map's settings. */
export const MAP_CONFIG_STORAGE_KEY = "klangkurator.map.v1";

/** The weight an enabled input may take: 0.5 to 3, in steps of 0.5. */
export const MAP_WEIGHT_MIN = 0.5;
export const MAP_WEIGHT_MAX = 3;
export const MAP_WEIGHT_STEP = 0.5;

/** The three edge layers; each may be switched on or off (phase 5). */
export interface MapLayers {
  relationships: boolean;
  transitions: boolean;
  nearest: boolean;
}

/** All three on by default. */
export const DEFAULT_MAP_LAYERS: MapLayers = { relationships: true, transitions: true, nearest: true };

/** Everything the map saves. */
export interface MapConfig {
  inputs: MapInputs;
  layers: MapLayers;
  /** Whether each rail section is open, by the section's own id; a section not named here is open. */
  sections: Record<string, boolean>;
  /** Whether the map rail itself is shown. */
  railOpen: boolean;
}

export const DEFAULT_MAP_CONFIG: MapConfig = {
  inputs: DEFAULT_INPUTS,
  layers: DEFAULT_MAP_LAYERS,
  sections: {},
  railOpen: true,
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Whether a number is a weight: finite, in range and on the 0.5 grid. */
const isWeight = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= MAP_WEIGHT_MIN &&
  value <= MAP_WEIGHT_MAX &&
  Number.isInteger(Number((value / MAP_WEIGHT_STEP).toFixed(6)));

/** One input's saved setting, or the default when it does not fit. */
const readInput = (value: unknown, fallback: InputSetting): InputSetting => {
  if (!isPlainObject(value)) return fallback;
  const enabled = value.enabled;
  const weight = value.weight;
  return typeof enabled === "boolean" && isWeight(weight) ? { enabled, weight } : fallback;
};

/** Every input's setting: a missing or unfitting one falls back to the default. */
const readInputs = (value: unknown): MapInputs => {
  const stored = isPlainObject(value) ? value : {};
  return Object.fromEntries(
    MAP_INPUTS.map((input): [MapInput, InputSetting] => [input, readInput(stored[input], DEFAULT_INPUTS[input])]),
  ) as MapInputs;
};

/** The layers: a missing or unfitting one falls back to the default (on). */
const readLayers = (value: unknown): MapLayers => {
  const stored = isPlainObject(value) ? value : {};
  const layers: MapLayers = { ...DEFAULT_MAP_LAYERS };
  for (const layer of Object.keys(DEFAULT_MAP_LAYERS) as (keyof MapLayers)[]) {
    const on = stored[layer];
    if (typeof on === "boolean") layers[layer] = on;
  }
  return layers;
};

/** The sections' open states: only the boolean entries count. */
const readSections = (value: unknown): Record<string, boolean> => {
  if (!isPlainObject(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"),
  );
};

/** The persisted config, or the defaults when nothing valid is stored. */
const loadPersistedMapConfig = (): MapConfig => {
  try {
    const raw = localStorage.getItem(MAP_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_MAP_CONFIG;
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) return DEFAULT_MAP_CONFIG;
    return {
      inputs: readInputs(parsed.inputs),
      layers: readLayers(parsed.layers),
      sections: readSections(parsed.sections),
      railOpen: typeof parsed.railOpen === "boolean" ? parsed.railOpen : DEFAULT_MAP_CONFIG.railOpen,
    };
  } catch {
    return DEFAULT_MAP_CONFIG;
  }
};

/**
 * The map's saved settings, validated on read and written back on every change.
 * Nothing here is a dependency of the model: toggling a layer or collapsing a
 * section never re-solves the layout (PM-8).
 */
export function useMapConfig() {
  const [config, setConfig] = useState<MapConfig>(loadPersistedMapConfig);

  // The last written blob, so a re-render or a theme change does not rewrite it.
  const lastSavedBlob = useRef<string | null>(null);
  useEffect(() => {
    const blob = JSON.stringify(config);
    if (blob === lastSavedBlob.current) return;
    try {
      localStorage.setItem(MAP_CONFIG_STORAGE_KEY, blob);
      lastSavedBlob.current = blob;
    } catch {
      // Private mode or a full quota: the settings last for this session.
    }
  }, [config]);

  const setInputEnabled = useCallback((input: MapInput, enabled: boolean) => {
    setConfig((prev) => ({ ...prev, inputs: { ...prev.inputs, [input]: { ...prev.inputs[input], enabled } } }));
  }, []);

  const setInputWeight = useCallback((input: MapInput, weight: number) => {
    setConfig((prev) => ({ ...prev, inputs: { ...prev.inputs, [input]: { ...prev.inputs[input], weight } } }));
  }, []);

  /** Every input and weight back to the spec's default table (TM-R4). */
  const resetInputs = useCallback(() => {
    setConfig((prev) => ({ ...prev, inputs: DEFAULT_INPUTS }));
  }, []);

  const setLayer = useCallback((layer: keyof MapLayers, on: boolean) => {
    setConfig((prev) => ({ ...prev, layers: { ...prev.layers, [layer]: on } }));
  }, []);

  const setSectionOpen = useCallback((id: string, open: boolean) => {
    setConfig((prev) => ({ ...prev, sections: { ...prev.sections, [id]: open } }));
  }, []);

  const setRailOpen = useCallback((open: boolean) => {
    setConfig((prev) => ({ ...prev, railOpen: open }));
  }, []);

  const sectionOpen = useCallback((id: string) => config.sections[id] ?? true, [config.sections]);

  const enabledCount = useMemo(
    () => MAP_INPUTS.filter((input) => config.inputs[input].enabled).length,
    [config.inputs],
  );

  return {
    inputs: config.inputs,
    layers: config.layers,
    railOpen: config.railOpen,
    /** How many inputs are on; 0 is the map's "Pick at least one input" state (TM-R5). */
    enabledCount,
    sectionOpen,
    setInputEnabled,
    setInputWeight,
    resetInputs,
    setLayer,
    setSectionOpen,
    setRailOpen,
  };
}

export type UseMapConfigReturn = ReturnType<typeof useMapConfig>;
