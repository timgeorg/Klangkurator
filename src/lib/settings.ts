/**
 * Settings and genres as files, not as browser storage (issue #51).
 *
 * Preferences used to live only in `localStorage`: they did not travel with the
 * library, vanished when site data was cleared, and the desktop window could
 * not keep them at all. They are now two documents on the backend —
 * `settings.json` for UI preferences, `genres` in `library.json` for the genre
 * vocabulary — loaded once before the app renders.
 *
 * The synchronous getters the app already calls (`getGenreConfig()`,
 * `getMainGenreColor()`, …) read the in-memory copy, so no caller changed shape.
 * A write updates that copy at once and is persisted about 300 ms later.
 */

import { useEffect, useState } from "react";

import { api, describeApiError } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import type { GenreConfig } from "@/lib/genreData";

/** The keys `PUT /api/settings` accepts, each keeping the shape it had in `localStorage`. */
export interface SettingsDocument {
  version?: number;
  columns?: unknown;
  map?: unknown;
  theme?: string;
  covers?: string;
  playerDock?: string;
  volume?: number;
  crateTabsExpanded?: boolean;
}

/** How long a burst of writes waits before it is sent as one request. */
const SAVE_DELAY_MS = 300;

let settings: SettingsDocument = {};
let genres: GenreConfig[] | null = null;
let loaded = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let genreTimer: ReturnType<typeof setTimeout> | null = null;
let pending: SettingsDocument = {};
const listeners = new Set<() => void>();

/** The legacy `localStorage` keys, read once by the migration below. */
const LEGACY_KEYS = {
  columns: "klangkurator.columnConfig.v1",
  map: "klangkurator.map.v1",
  theme: "klangkurator.theme.v1",
  covers: "klangkurator.covers.v1",
  playerDock: "klangkurator.player.dock.v1",
  volume: "klangkurator.player.volume.v1",
  crateTabsExpanded: "klangkurator.crates.expanded",
  genres: "dj_database_genre_config",
} as const;

/** Marks that the browser's old values were copied into the files. */
const MIGRATED_KEY = "klangkurator.settingsMigrated.v1";

/** Whether the documents have arrived; false means `<SettingsGate>` still shows a skeleton. */
export function settingsLoaded(): boolean {
  return loaded;
}

/** Notify subscribers after the in-memory copy changed. */
function notify(): void {
  listeners.forEach((listener) => listener());
}

/** Subscribe to in-memory changes (used by `useSettings`). */
export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The current preferences, synchronously. */
export function getSettings(): SettingsDocument {
  return settings;
}

/** The current genres, synchronously. */
export function getGenres(): GenreConfig[] {
  return genres ?? [];
}

/**
 * Read one preference. The generic keeps each caller's own type, because the
 * document stores each key in the shape `localStorage` used to hold.
 */
export function readSetting<T>(key: keyof SettingsDocument, fallback: T): T {
  const value = settings[key];
  return (value as T | undefined) ?? fallback;
}

/**
 * Queue a preference change: applied at once, written 300 ms later.
 *
 * A value identical to the one already held is dropped. Components initialise
 * their state from the loaded document and then run a save-on-mount effect, so
 * without this an unchanged value would be re-sent — and a write queued during
 * that first render would overwrite what the one-time legacy migration had just
 * stored (found while verifying issue #51).
 */
export function saveSettings(patch: SettingsDocument): void {
  const changed = Object.fromEntries(
    Object.entries(patch).filter(([key, value]) => !sameValue(settings[key as keyof SettingsDocument], value)),
  ) as SettingsDocument;
  if (Object.keys(changed).length === 0) return;

  settings = { ...settings, ...changed };
  pending = { ...pending, ...changed };
  notify();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSettings, SAVE_DELAY_MS);
}

/** Structural equality for the JSON-shaped values a setting holds. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Send the queued changes; a failure keeps them for the next attempt. */
async function flushSettings(): Promise<void> {
  const patch = pending;
  pending = {};
  saveTimer = null;
  if (Object.keys(patch).length === 0) return;
  try {
    settings = { ...settings, ...(await api.put<SettingsDocument>("/settings", patch)) };
    notify();
  } catch (error) {
    // Keep the value in memory so the next burst carries it again: a transient
    // backend hiccup must not silently drop a preference.
    pending = { ...patch, ...pending };
    toast({
      variant: "destructive",
      title: "Settings not saved",
      description: describeApiError(error),
    });
  }
}

/** The queued genre list, if a write is waiting. */
let pendingGenres: GenreConfig[] | null = null;

/** Replace the genre list: applied at once, written 300 ms later. */
export function setGenres(next: GenreConfig[]): void {
  genres = next;
  // Queue it here: `flushGenres` sends what is queued, and only this line
  // decides what that is. Without it a genre change never reached the backend
  // (found while verifying issue #51).
  pendingGenres = next;
  notify();
  // Its own timer: a genre change and a preference change can be in flight
  // together, and sharing one handle meant the second cancelled the first.
  if (genreTimer) clearTimeout(genreTimer);
  genreTimer = setTimeout(flushGenres, SAVE_DELAY_MS);
}

/** Send the queued genre list; a failure keeps it for the next attempt. */
async function flushGenres(): Promise<void> {
  const next = pendingGenres;
  pendingGenres = null;
  genreTimer = null;
  if (!next) return;
  try {
    genres = await api.put<GenreConfig[]>("/genres", next);
    notify();
  } catch (error) {
    pendingGenres = next;
    toast({
      variant: "destructive",
      title: "Genres not saved",
      description: describeApiError(error),
    });
  }
}

/**
 * Load both documents, then copy any browser values the files lack.
 *
 * Only the browser can read `localStorage`, so the migration has to run here.
 * It happens once: after that the files are the truth (issue #51, decision 4).
 */
export async function loadSettings(): Promise<void> {
  if (loaded) return;
  const [settingsDoc, genreList] = await Promise.all([
    api.get<SettingsDocument>("/settings"),
    api.get<GenreConfig[]>("/genres"),
  ]);
  settings = settingsDoc ?? {};
  genres = genreList ?? [];
  // Migrate before anything can render: a component that mounted first would
  // queue a write of its defaults, which would flush over the migrated values.
  await migrateLegacyValues();
  loaded = true;
  notify();
  // The gate renders the app on the next tick; flush immediately so a mounting
  // component's first save cannot beat the migration to the file.
  await flushSettings();
}

/**
 * Copy the seven `localStorage` values into the files, once.
 *
 * A file value wins over a browser one, so this never overwrites what the user
 * already saved from another browser. A browser without storage (private mode,
 * the desktop window before #51) contributes nothing.
 */
async function migrateLegacyValues(): Promise<void> {
  try {
    if (localStorage.getItem(MIGRATED_KEY)) return;
  } catch {
    return; // no storage: nothing to migrate from
  }

  const patch: SettingsDocument = {};
  const has = (key: string): boolean => settings[key as keyof SettingsDocument] !== undefined;
  const read = (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };

  const columns = read(LEGACY_KEYS.columns);
  if (columns && !has("columns")) patch.columns = parseJson(columns);
  const map = read(LEGACY_KEYS.map);
  if (map && !has("map")) patch.map = parseJson(map);
  const theme = read(LEGACY_KEYS.theme);
  if (theme && !has("theme")) patch.theme = theme;
  const covers = read(LEGACY_KEYS.covers);
  if (covers && !has("covers")) patch.covers = covers;
  const dock = read(LEGACY_KEYS.playerDock);
  if (dock && !has("playerDock")) patch.playerDock = dock;
  const volume = read(LEGACY_KEYS.volume);
  if (volume && !has("volume")) {
    const parsed = Number(volume);
    if (Number.isFinite(parsed)) patch.volume = parsed;
  }
  const expanded = read(LEGACY_KEYS.crateTabsExpanded);
  if (expanded && !has("crateTabsExpanded")) patch.crateTabsExpanded = expanded === "1";

  try {
    if (Object.keys(patch).length > 0) {
      settings = { ...settings, ...(await api.put<SettingsDocument>("/settings", patch)) };
    }
    const legacyGenres = read(LEGACY_KEYS.genres);
    if (legacyGenres && genres !== null && genres.length === 0) {
      const parsed = parseJson(legacyGenres);
      if (Array.isArray(parsed) && parsed.length > 0) {
        genres = await api.put<GenreConfig[]>("/genres", parsed);
      }
    }
    localStorage.setItem(MIGRATED_KEY, "1");
  } catch {
    // A failed migration is retried on the next start; nothing is lost.
  }
}

/** Parse a `localStorage` value, or undefined when it is not JSON. */
function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Test seam: reset the in-memory copy. */
export function __resetSettingsForTests(): void {
  settings = {};
  genres = null;
  loaded = false;
  pending = {};
  pendingGenres = null;
  if (saveTimer) clearTimeout(saveTimer);
  if (genreTimer) clearTimeout(genreTimer);
  saveTimer = null;
  genreTimer = null;
  listeners.clear();
}

/** A counter that changes whenever any setting or genre does. */
export function useSettingsTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => subscribeSettings(() => setTick((value) => value + 1)), []);
  return tick;
}
