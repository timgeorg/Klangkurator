// Track map (issue #8) — the route helpers the app shell reads (plan phase 3).
// The map is a property of the route, not of the player's saved state, so the
// player shows as the bottom bar and its dock buttons stay hidden there
// without touching the stored dock preference (TM-M8).
export const MAP_PATH = "/map";

/** Whether a pathname is the map's route (or a child of it). */
export function isMapRoute(pathname: string): boolean {
  return pathname === MAP_PATH || pathname.startsWith(`${MAP_PATH}/`);
}
