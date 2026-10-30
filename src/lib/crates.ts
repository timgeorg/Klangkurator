/**
 * Crate and music-location registry (issue #11).
 *
 * A crate is no longer a string derived from a folder name: it is an entry with
 * an `id`, a `name` and the `location_path` of the music location holding it.
 * A song stores only the id, and every screen resolves the name here. Two
 * folders called "House" in two locations are therefore two crates, not one.
 *
 * The registry is loaded once before the app renders (beside the settings and
 * the genres) and re-read after anything that changes it — a scan, a location
 * added or removed, an import. The getters are synchronous, so the table, the
 * tabs and the filter read the same copy.
 */

import { api } from "@/lib/api";

/** One crate, as `GET /api/library/crates` reports it. */
export interface Crate {
  id: string;
  name: string;
  /** The music location that holds this crate. */
  location_path: string;
  track_count: number;
  /** Songs kept and flagged because their location was removed. */
  missing_track_count: number;
}

/** One music location, as `GET /api/library/locations` reports it. */
export interface MusicLocation {
  id: string;
  path: string;
  /** False when the folder is not mounted right now. */
  exists: boolean;
  crate_count: number;
  track_count: number;
}

let crates: Crate[] = [];
let locations: MusicLocation[] = [];
let loaded = false;
const listeners = new Set<() => void>();

/** Notify subscribers after the registry changed. */
function notify(): void {
  listeners.forEach((listener) => listener());
}

/** Subscribe to registry changes. */
export function subscribeCrates(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Every crate, in name order. */
export function getCrates(): Crate[] {
  return crates;
}

/** Every music location, in path order. */
export function getMusicLocations(): MusicLocation[] {
  return locations;
}

/** Whether the registry has been read at least once. */
export function cratesLoaded(): boolean {
  return loaded;
}

/** The crate with this id, or undefined when the registry does not know it. */
export function crateById(id?: string | null): Crate | undefined {
  if (!id) return undefined;
  return crates.find((crate) => crate.id === id);
}

/**
 * The name to show for a crate id.
 *
 * A song whose crate the registry does not know still shows something honest:
 * the id it carries, not an empty cell.
 *
 * @param id - The crate id a song stores.
 * @returns The crate's name, or "" when the song carries no crate.
 */
export function crateName(id?: string | null): string {
  if (!id) return "";
  return crateById(id)?.name ?? id;
}

/**
 * The ids of the crates a location holds.
 *
 * @param locationPath - The music location's folder path.
 * @returns The crate ids under that location.
 */
export function crateIdsAt(locationPath: string): string[] {
  return crates.filter((crate) => crate.location_path === locationPath).map((crate) => crate.id);
}

/** Read the registry from the backend. A failure keeps the current copy. */
export async function refreshCrates(): Promise<void> {
  const [nextCrates, nextLocations] = await Promise.all([
    api.get<Crate[]>("/library/crates"),
    api.get<MusicLocation[]>("/library/locations"),
  ]);
  crates = nextCrates ?? [];
  locations = nextLocations ?? [];
  loaded = true;
  notify();
}

/** `refreshCrates`, but a failed read is not an error the caller must handle. */
export async function refreshCratesQuietly(): Promise<void> {
  try {
    await refreshCrates();
  } catch {
    // A failed refresh leaves the in-memory copy; the page still renders.
  }
}

/** Test seam: reset the in-memory copy. */
export function __resetCratesForTests(): void {
  crates = [];
  locations = [];
  loaded = false;
  listeners.clear();
}
