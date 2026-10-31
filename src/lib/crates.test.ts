import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The crate registry on the client (issue #11).
 *
 * A crate is an `{id, name, location_path}` entry, and a song stores only the
 * id. These tests pin the two things that made the registry necessary: a name
 * is never an identity, and a crate the registry does not know still shows
 * something honest.
 */

import {
  crateById,
  crateIdsAt,
  crateName,
  getCrates,
  getMusicLocations,
  refreshCrates,
  __resetCratesForTests,
} from "./crates";

const CRATES = [
  { id: "crate_a", name: "House", location_path: "/music/a", track_count: 3, missing_track_count: 0 },
  // The same name in a second location: two entries, two ids.
  { id: "crate_b", name: "House", location_path: "/music/b", track_count: 2, missing_track_count: 1 },
  { id: "crate_c", name: "tims-tech-house-picks", location_path: "/music/a", track_count: 9, missing_track_count: 0 },
];

const LOCATIONS = [
  { id: "loc_a", path: "/music/a", exists: true, crate_count: 2, track_count: 12 },
  { id: "loc_b", path: "/music/b", exists: false, crate_count: 1, track_count: 2 },
];

function stubBackend() {
  vi.stubGlobal("fetch", async (input: string) => {
    const path = String(input).replace("/api", "");
    const body = path === "/library/crates" ? CRATES : path === "/library/locations" ? LOCATIONS : null;
    return new Response(JSON.stringify(body ?? []), { status: 200, headers: { "content-type": "application/json" } });
  });
}

beforeEach(() => {
  __resetCratesForTests();
  vi.unstubAllGlobals();
});

describe("the crate registry", () => {
  it("resolves a name for an id, never the other way round", async () => {
    stubBackend();
    await refreshCrates();

    expect(crateName("crate_a")).toBe("House");
    expect(crateName("crate_b")).toBe("House");
    expect(crateById("crate_a")?.location_path).toBe("/music/a");
    expect(crateById("crate_b")?.location_path).toBe("/music/b");
  });

  it("keeps two crates with one name apart", async () => {
    stubBackend();
    await refreshCrates();

    const houses = getCrates().filter((crate) => crate.name === "House");
    expect(houses).toHaveLength(2);
    expect(new Set(houses.map((crate) => crate.id)).size).toBe(2);
  });

  it("shows the id for a crate the registry lost, rather than nothing", async () => {
    stubBackend();
    await refreshCrates();

    expect(crateName("crate_from_another_machine")).toBe("crate_from_another_machine");
    expect(crateName(null)).toBe("");
    expect(crateName(undefined)).toBe("");
  });

  it("lists a location's crates by path", async () => {
    stubBackend();
    await refreshCrates();

    expect(crateIdsAt("/music/a").sort()).toEqual(["crate_a", "crate_c"]);
    expect(crateIdsAt("/music/nowhere")).toEqual([]);
  });

  it("reports which locations are mounted", async () => {
    stubBackend();
    await refreshCrates();

    const [first, second] = getMusicLocations();
    expect(first.exists).toBe(true);
    expect(second.exists).toBe(false);
  });
});
