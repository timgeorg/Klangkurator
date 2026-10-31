import { describe, expect, it } from "vitest";

import { crateOf } from "@/lib/trackFormat";
import type { Song } from "@/lib/storage";

import { INITIAL_FILTERS, clickCrate, filterSongs, toggleCrate, visibleCrates } from "./libraryTable";

/** N crates in tab order: "crate-1", "crate-2", … */
function crateNames(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `crate-${index + 1}`);
}

describe("toggleCrate", () => {
  it("adds a crate to an empty selection", () => {
    expect(toggleCrate([], "crate-1")).toEqual(["crate-1"]);
  });

  it("appends the crate, keeping the selection's order", () => {
    expect(toggleCrate(["crate-1"], "crate-2")).toEqual(["crate-1", "crate-2"]);
    expect(toggleCrate(["crate-3", "crate-1"], "crate-2")).toEqual(["crate-3", "crate-1", "crate-2"]);
  });

  it("removes a crate the selection holds, leaving the others", () => {
    expect(toggleCrate(["crate-1", "crate-2", "crate-3"], "crate-2")).toEqual(["crate-1", "crate-3"]);
  });

  it("removing the last one gives an empty selection", () => {
    expect(toggleCrate(["crate-1"], "crate-1")).toEqual([]);
  });
});

describe("clickCrate", () => {
  it("on a member of a multi-selection gives just that crate", () => {
    expect(clickCrate(["crate-1", "crate-3"], "crate-1")).toEqual(["crate-1"]);
  });

  it("on the sole selected crate clears the selection", () => {
    expect(clickCrate(["crate-1"], "crate-1")).toEqual([]);
  });

  it("on an unselected crate gives just that crate", () => {
    expect(clickCrate(["crate-1", "crate-3"], "crate-4")).toEqual(["crate-4"]);
    expect(clickCrate([], "crate-1")).toEqual(["crate-1"]);
  });
});

describe("visibleCrates", () => {
  it("shows all ten crates and no toggle at ten", () => {
    const crates = crateNames(10);
    expect(visibleCrates(crates, [], false)).toEqual({ shown: crates, hidden: 0 });
  });

  it("shows ten and hides one at eleven", () => {
    const crates = crateNames(11);
    expect(visibleCrates(crates, [], false)).toEqual({ shown: crates.slice(0, 10), hidden: 1 });
  });

  it("shows a selected crate beyond the first ten after them", () => {
    const crates = crateNames(27);
    const result = visibleCrates(crates, ["crate-13"], false);
    expect(result.shown).toEqual([...crates.slice(0, 10), "crate-13"]);
    expect(result.hidden).toBe(16);
  });

  it("hides nothing when every hidden crate is selected", () => {
    const crates = crateNames(27);
    const result = visibleCrates(crates, crates.slice(10), false);
    expect(result.shown).toEqual(crates);
    expect(result.hidden).toBe(0);
  });

  it("shows every crate when expanded", () => {
    const crates = crateNames(27);
    expect(visibleCrates(crates, [], true)).toEqual({ shown: crates, hidden: 0 });
  });

  it("does not duplicate a selected crate within the first ten", () => {
    const crates = crateNames(27);
    const result = visibleCrates(crates, ["crate-3"], false);
    expect(result.shown).toEqual(crates.slice(0, 10));
    expect(result.hidden).toBe(17);
  });
});

describe("the Crate filter keys on ids (issue #11)", () => {
  const songs = [
    { id: "s1", title: "A", artist: "X", file_path: "/a/House/a.mp3", crate_id: "crate_a", energy: 0 },
    { id: "s2", title: "B", artist: "Y", file_path: "/b/House/b.mp3", crate_id: "crate_b", energy: 0 },
    { id: "s3", title: "C", artist: "Z", file_path: "/a/techno/c.mp3", crate_id: "crate_c", energy: 0 },
  ] as unknown as Song[];

  it("selects one of two crates that share a name", () => {
    const only = filterSongs(songs, {}, { ...INITIAL_FILTERS, crate: ["crate_a"] }, "");

    expect(only.map((song) => song.id)).toEqual(["s1"]);
  });

  it("keeps both crates apart when both are selected", () => {
    const both = filterSongs(songs, {}, { ...INITIAL_FILTERS, crate: ["crate_a", "crate_b"] }, "");

    expect(both.map((song) => song.id)).toEqual(["s1", "s2"]);
  });

  it("uses the file's folder for a row the registry never saw", () => {
    const unplaced = [{ id: "s4", title: "D", artist: "W", file_path: "/a/House/d.mp3", energy: 0 }] as unknown as Song[];

    expect(crateOf(unplaced[0])).toBe("House");
  });
});
