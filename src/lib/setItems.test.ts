import { describe, expect, it, vi } from "vitest";

import { addSongToItems, itemRef, setHasSong } from "./setItems";
import type { SetItem } from "./storage";

// The app runs in a browser, where `crypto.randomUUID` is a global; vitest
// runs on node, so it is stubbed for the tests that mint an id.
let minted = 0;
vi.stubGlobal("crypto", { randomUUID: () => `uuid-${++minted}` });

const item = (over: Partial<SetItem> & { id: string; ref_id: string }): SetItem => ({
  type: "song",
  position: 0,
  transition_notes: "",
  alternative_transitions: [],
  ...over,
});

const ids = (list: { id: string }[]) => list.map((i) => i.id);

describe("addSongToItems", () => {
  it("appends the song as the last item", () => {
    const items = [item({ id: "a", ref_id: "s1" }), item({ id: "b", ref_id: "s2" })];
    const out = addSongToItems(items, "s9");
    expect(out).not.toBeNull();
    expect(out!.at(-1)).toMatchObject({ type: "song", ref_id: "s9", position: 2 });
  });

  it("returns null when the song is already in the set", () => {
    expect(addSongToItems([item({ id: "a", ref_id: "s1" })], "s1")).toBeNull();
  });

  it("does not treat a block reference as the song", () => {
    const items = [item({ id: "a", ref_id: "blk", type: "block" })];
    expect(addSongToItems(items, "blk")).not.toBeNull();
  });

  it("renumbers positions contiguously when the stored set has gaps", () => {
    // A stored set can have gaps: [0, 3]. The new item must land at 2, the end of
    // the order the list is read in; `position: items.length` would also be 2
    // here, so the next case pins the difference.
    const gapped = [
      item({ id: "a", ref_id: "s1", position: 0 }),
      item({ id: "c", ref_id: "s3", position: 3 }),
    ];
    const out = addSongToItems(gapped, "s9")!;
    expect(out.map((i) => i.position)).toEqual([0, 1, 2]);
    expect(out.at(-1)!.id).not.toBe("c");
  });

  it("puts the new item last even when stored positions are sparse", () => {
    // Four items stored at [0, 10, 20, 30]. `position: items.length` would store 4,
    // which sorts before every existing item and is not the end of the order.
    const sparse = [
      item({ id: "a", ref_id: "s1", position: 0 }),
      item({ id: "b", ref_id: "s2", position: 10 }),
      item({ id: "c", ref_id: "s3", position: 20 }),
      item({ id: "d", ref_id: "s4", position: 30 }),
    ];
    const out = addSongToItems(sparse, "s9")!;
    const newItem = out.at(-1)!;
    expect(newItem.position).toBe(4);
    expect(newItem.position).toBeGreaterThan(Math.max(...out.slice(0, -1).map((i) => i.position)));
  });

  it("normalises legacy song_id/block_id items so the request still validates", () => {
    const legacy = { id: "old", type: "song", song_id: "s1", position: 0 } as unknown as SetItem;
    const out = addSongToItems([legacy], "s9")!;
    expect(out[0]).not.toHaveProperty("song_id");
    expect(out[0].ref_id).toBe("s1");
  });

  it("keeps each existing item's id, so a set the editor wrote keeps its keys", () => {
    const items = [item({ id: "keep-me", ref_id: "s1" })];
    expect(ids(addSongToItems(items, "s9")!)).toContain("keep-me");
  });

  it("leaves out an empty transition note and keeps a real one", () => {
    const items = [
      item({ id: "a", ref_id: "s1", transition_notes: "   " }),
      item({ id: "b", ref_id: "s2", transition_notes: " long blend " }),
    ];
    const out = addSongToItems(items, "s9")!;
    expect(out[0]).not.toHaveProperty("transition_notes");
    expect(out[1].transition_notes).toBe("long blend");
  });

  it("mints a fresh id for the new item", () => {
    const spy = vi.spyOn(crypto, "randomUUID");
    addSongToItems([], "s9");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("works on an empty set", () => {
    const out = addSongToItems([], "s9")!;
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ ref_id: "s9", position: 0, alternative_transitions: [] });
  });

  it("does not mutate the list it was given", () => {
    const items = [item({ id: "a", ref_id: "s1" })];
    addSongToItems(items, "s9");
    expect(items).toHaveLength(1);
  });
});

describe("setHasSong", () => {
  it("finds a song in the flat running order", () => {
    expect(setHasSong([item({ id: "a", ref_id: "s1" })], [], "s1")).toBe(true);
  });

  it("finds a song stored inside a phase", () => {
    const phases = [{ items: [item({ id: "p", ref_id: "s7" })] }];
    expect(setHasSong([], phases, "s7")).toBe(true);
  });

  it("is false for a song the set does not hold", () => {
    expect(setHasSong([item({ id: "a", ref_id: "s1" })], [], "s2")).toBe(false);
  });

  it("tolerates a phase with no items", () => {
    expect(setHasSong([], [{ items: null }], "s1")).toBe(false);
  });
});

describe("itemRef", () => {
  it("prefers ref_id, then falls back to the older keys", () => {
    expect(itemRef({ ref_id: "a" })).toBe("a");
    expect(itemRef({ ref_id: "", song_id: "b" } as never)).toBe("b");
    expect(itemRef({ ref_id: "", block_id: "c" } as never)).toBe("c");
    expect(itemRef({ ref_id: "" })).toBe("");
  });
});
