/**
 * Settings and genres as files, not as browser storage (issue #51).
 *
 * They are two documents on the backend — `settings.json` for UI preferences,
 * `genres` in `library.json` for the genre vocabulary — loaded once before the
 * app renders. Nothing is read from `localStorage` any more: copying the data
 * folder is enough to reproduce the app exactly.
 *
 * The synchronous getters the app already calls (`getGenreConfig()`,
 * `getMainGenreColor()`, …) read the in-memory copy, so no caller changed shape.
 * A write updates that copy at once and is persisted about 300 ms later.
 */

import { useEffect, useState } from "react";

import { api, describeApiError } from "@/lib/api";
import { refreshCrates } from "@/lib/crates";
import { toast } from "@/hooks/use-toast";
import type { GenreConfig } from "@/lib/genreData";

/** The keys `PUT /api/settings` accepts, each keeping its original shape. */
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

/** Whether the genre document has ever been loaded (it is `null` before that). */
export function genresLoaded(): boolean {
  return genres !== null;
}

/**
 * Re-read the genre list from the backend without writing it back.
 *
 * An import merges genres server-side, and `PUT /api/genres` replaces the whole
 * list — so a stale in-memory copy would delete the imported genres on the next
 * edit (review of #51).
 */
export async function refreshGenres(): Promise<void> {
  try {
    genres = (await api.get<GenreConfig[]>("/genres")) ?? [];
    notify();
  } catch {
    // A failed refresh leaves the current copy; the next edit still works.
  }
}

/**
 * Read one preference. The generic keeps each caller's own type, because each
 * key keeps the shape it was first stored in.
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
 * without this an unchanged value would be re-sent on every mount, and a write
 * queued during that first render would overwrite what the load had just read
 * (found while verifying issue #51).
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
 * Load both documents. The files are the only source of truth.
 *
 * There is no migration out of `localStorage` any more: the app is the author's
 * own, and every value it reads now is written to `settings.json` or
 * `library.json`. A browser copy from an older build is ignored, so a copy of
 * the data folder always reproduces the same app.
 */
export async function loadSettings(): Promise<void> {
  if (loaded) return;
  const [settingsDoc, genreList] = await Promise.all([
    api.get<SettingsDocument>("/settings"),
    api.get<GenreConfig[]>("/genres"),
    // The crate registry is read here too: the library table, the crate tabs
    // and the Crate column all need it before the first row renders (#11).
    refreshCrates(),
  ]);
  settings = settingsDoc ?? {};
  genres = genreList ?? [];
  loaded = true;
  notify();
  // The gate renders the app on the next tick; flush immediately so a mounting
  // component's first save cannot beat the load to the file.
  await flushSettings();
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
