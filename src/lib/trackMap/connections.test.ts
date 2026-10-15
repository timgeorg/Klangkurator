import { describe, expect, it } from "vitest";

import type { SongRelationship } from "@/lib/storage";

import { buildConnections, connectionSet, isConnected } from "./connections";
import { buildTransitions } from "./transitions";

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

describe("buildConnections", () => {
  it("connects a relationship both ways, whatever its type", () => {
    const connections = buildConnections([
      relationship("r1", "a", "b", "remix"),
      relationship("r2", "c", "d", "in_playlist"),
      relationship("r3", "e", "f", "same_sample"),
      relationship("r4", "g", "h", "cover"),
      relationship("r5", "i", "j", "mashup"),
      relationship("r6", "k", "l", "edit"),
      relationship("r7", "m", "n", "bootleg"),
      relationship("r8", "o", "p", "transition"),
    ]);
    for (const [from, to] of [
      ["a", "b"],
      ["c", "d"],
      ["e", "f"],
      ["g", "h"],
      ["i", "j"],
      ["k", "l"],
      ["m", "n"],
      ["o", "p"],
    ]) {
      expect(isConnected(connections, from, to)).toBe(true);
      expect(isConnected(connections, to, from)).toBe(true);
    }
  });

  it("connects a transition fact both ways", () => {
    const connections = buildConnections([], [{ source: "x", target: "y", kind: "transition", sources: [] }]);
    expect(isConnected(connections, "x", "y")).toBe(true);
    expect(isConnected(connections, "y", "x")).toBe(true);
  });

  it("never connects a song to itself and ignores empty ids", () => {
    const connections = buildConnections([relationship("r1", "a", "a"), relationship("r2", "", "b")]);
    expect(connectionSet(connections, "a")).toEqual(new Set());
    expect(connectionSet(connections, "b")).toEqual(new Set());
  });

  it("gives an empty set for a song with no connection, and without inputs", () => {
    expect(connectionSet(buildConnections([]), "a")).toEqual(new Set());
    expect(connectionSet(undefined, "a")).toEqual(new Set());
    expect(isConnected(undefined, "a", "b")).toBe(false);
  });

  it("counts a transition fact built from a relationship as one connection", () => {
    const transitions = buildTransitions({ relationships: [relationship("r1", "T1", "T2", "transition")] });
    const connections = buildConnections([relationship("r1", "T1", "T2", "transition")], transitions);
    expect(connectionSet(connections, "T1")).toEqual(new Set(["T2"]));
  });
});
