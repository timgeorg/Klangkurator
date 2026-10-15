import { describe, expect, it } from "vitest";

import type { SongRelationship } from "@/lib/storage";

import { coreMemberIds } from "./core";

/** A relationship row, written as connections.test.ts writes one. */
const relationship = (
  id: string,
  source: string,
  target: string,
  type: SongRelationship["relationship_type"] = "remix",
): SongRelationship => ({
  id,
  source_song_id: source,
  target_song_id: target,
  relationship_type: type,
  created_at: "2026-10-15T00:00:00Z",
});

describe("coreMemberIds", () => {
  it("gives the core and its partners, whichever way the relationship points", () => {
    const relationships = [
      relationship("r1", "core", "out"),
      relationship("r2", "in", "core"),
      relationship("r3", "other", "elsewhere"),
    ];
    expect(coreMemberIds("core", relationships)).toEqual(new Set(["core", "in", "out"]));
  });

  it("counts a partner by any of the eight types, a transition relationship included", () => {
    // TM-D1's given: two by relationship types, one by a `transition` relationship.
    const relationships = [
      relationship("r1", "core", "remix", "remix"),
      relationship("r2", "core", "sample", "same_sample"),
      relationship("r3", "core", "mix", "transition"),
    ];
    expect(coreMemberIds("core", relationships)).toEqual(new Set(["core", "remix", "sample", "mix"]));
  });

  it("is only the core when it has no relationship of its own", () => {
    expect(coreMemberIds("lonely", [relationship("r1", "a", "b")])).toEqual(new Set(["lonely"]));
  });

  it("counts a partner once, however many rows join the pair", () => {
    const relationships = [
      relationship("r1", "core", "x"),
      relationship("r2", "x", "core"),
      relationship("r3", "core", "x", "cover"),
    ];
    expect(coreMemberIds("core", relationships)).toEqual(new Set(["core", "x"]));
  });

  it("never adds an empty id, and an empty core has no members", () => {
    expect(coreMemberIds("core", [relationship("r1", "core", "")])).toEqual(new Set(["core"]));
    expect(coreMemberIds("", [relationship("r1", "", "a")])).toEqual(new Set());
  });

  it("does not read a relationship between two other tracks", () => {
    const relationships = [relationship("r1", "a", "b"), relationship("r2", "b", "a")];
    expect(coreMemberIds("core", relationships)).toEqual(new Set(["core"]));
  });
});
