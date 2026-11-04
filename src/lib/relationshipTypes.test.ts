import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The relationship type list on the client (issue #81).
 *
 * A relationship row stores a type id, and every view resolves the reading from
 * this list. These tests pin the part that is easy to get wrong: one fact reads
 * two ways on two tracks, and never the wrong way round.
 */

import {
  getRelationshipTypes,
  isTransitionType,
  refreshRelationshipTypes,
  refreshRelationshipTypesQuietly,
  relationshipLegend,
  relationshipPartnerArrow,
  relationshipPhrase,
  relationshipTypeById,
  relationshipTypeColor,
  relationshipTypeName,
  relationshipTypesLoaded,
  setRelationshipTypesForTests,
  subscribeRelationshipTypes,
  TRANSITION_TYPE_ID,
  __resetRelationshipTypesForTests,
  type RelationshipType,
} from "./relationshipTypes";
import { relationshipStyle } from "./relationshipStyle";

const DEFAULTS: RelationshipType[] = [
  { id: "remix", name: "is remix of", color: "#6B5BD6", both_ways: false, opposite_id: "original", uses: 0 },
  { id: "original", name: "is original of", color: "#6B5BD6", both_ways: false, opposite_id: "remix", uses: 0 },
  { id: "same_sample", name: "same sample", color: "#C9A227", both_ways: true, opposite_id: null, uses: 0 },
  { id: "works_as_mashup", name: "works as mashup", color: "#E0607E", both_ways: true, opposite_id: null, uses: 0 },
  { id: "transition", name: "transition", color: null, both_ways: false, opposite_id: null, uses: 0 },
  { id: "same_vibe", name: "same vibe", color: "#4E9A2A", both_ways: true, opposite_id: null, uses: 0 },
];

beforeEach(() => {
  __resetRelationshipTypesForTests();
  setRelationshipTypesForTests(DEFAULTS);
});

describe("the type list", () => {
  it("resolves a name from an id", () => {
    expect(relationshipTypeName("remix")).toBe("is remix of");
    expect(relationshipTypeById("same_vibe")?.both_ways).toBe(true);
  });

  it("shows the id when the list does not know it, never an empty cell", () => {
    expect(relationshipTypeName("cover")).toBe("cover");
    expect(relationshipTypeName("")).toBe("");
    expect(relationshipTypeName(null)).toBe("");
  });

  it("reads the list from the backend and tells its subscribers", async () => {
    __resetRelationshipTypesForTests();
    let told = 0;
    subscribeRelationshipTypes(() => (told += 1));
    vi.stubGlobal("fetch", async () =>
      new Response(JSON.stringify(DEFAULTS), { status: 200, headers: { "content-type": "application/json" } }),
    );

    await refreshRelationshipTypes();

    expect(getRelationshipTypes()).toHaveLength(6);
    expect(relationshipTypesLoaded()).toBe(true);
    expect(told).toBe(1);
  });

  it("keeps the current copy when the read fails", async () => {
    vi.stubGlobal("fetch", async () => new Response("no", { status: 500 }));

    await refreshRelationshipTypesQuietly();

    expect(relationshipTypeName("remix")).toBe("is remix of");
  });

  it("names the transition type by its fixed id, whatever it is called", () => {
    setRelationshipTypesForTests(
      DEFAULTS.map((entry) => (entry.id === TRANSITION_TYPE_ID ? { ...entry, name: "transitions into" } : entry)),
    );

    expect(isTransitionType("transition")).toBe(true);
    expect(isTransitionType("same_vibe")).toBe(false);
    expect(relationshipTypeName("transition")).toBe("transitions into");
  });
});

describe("a relationship reads in its direction", () => {
  it("shows the type's name on the source track", () => {
    expect(relationshipPhrase("remix", "source")).toBe("is remix of");
  });

  it("shows the opposite's name on the target track", () => {
    // "A is remix of B" reads "is original of A" on B (REQ-14-RD VC4).
    expect(relationshipPhrase("remix", "target")).toBe("is original of");
    expect(relationshipPhrase("original", "target")).toBe("is remix of");
  });

  it("shows the type's name on both tracks when it reads both ways", () => {
    expect(relationshipPhrase("same_vibe", "source")).toBe("same vibe");
    expect(relationshipPhrase("same_vibe", "target")).toBe("same vibe");
  });

  it("shows the type's name both ways when it is one-way without an opposite", () => {
    expect(relationshipPhrase("transition", "source")).toBe("transition");
    expect(relationshipPhrase("transition", "target")).toBe("transition");
  });

  it("marks the direction with an arrow only where the phrase cannot", () => {
    // A one-way type without an opposite reads the same either way, so the row
    // points at the partner instead (REQ-14-RD VC6).
    expect(relationshipPartnerArrow("transition", "source")).toBe("→");
    expect(relationshipPartnerArrow("transition", "target")).toBe("←");
    expect(relationshipPartnerArrow("remix", "source")).toBe("");
    expect(relationshipPartnerArrow("same_vibe", "target")).toBe("");
  });

  it("reads an unknown type by its id, both ways", () => {
    expect(relationshipPhrase("cover", "source")).toBe("cover");
    expect(relationshipPhrase("cover", "target")).toBe("cover");
    expect(relationshipPartnerArrow("cover", "source")).toBe("");
  });
});

describe("the line a type draws", () => {
  it("takes the type's own colour", () => {
    expect(relationshipStyle("remix").color).toBe("#6B5BD6");
    expect(relationshipStyle("same_sample").color).toBe("#C9A227");
  });

  it("draws a one-way type solid and a both-ways type dotted", () => {
    expect(relationshipStyle("remix").dash).toEqual([]);
    expect(relationshipStyle("same_sample").dash.length).toBeGreaterThan(0);
  });

  it("keeps the transition line the heaviest", () => {
    const transition = relationshipStyle("transition");
    expect(transition.width).toBeGreaterThan(relationshipStyle("remix").width);
    expect(transition.width).toBeGreaterThan(relationshipStyle("same_sample").width);
  });

  it("draws a null colour in the foreground", () => {
    expect(relationshipStyle("transition").color).toBeNull();
    expect(relationshipTypeColor("transition")).toBeNull();
  });
});

describe("the legend", () => {
  it("gives a type and its opposite one entry that names both", () => {
    const legend = relationshipLegend(["remix", "original"]);

    expect(legend).toHaveLength(1);
    expect(legend[0].label).toBe("is remix of / is original of");
    expect(legend[0].color).toBe("#6B5BD6");
  });

  it("keeps a lone side of a pair as its own entry", () => {
    const legend = relationshipLegend(["original"]);

    expect(legend).toHaveLength(1);
    expect(legend[0].label).toBe("is original of");
    expect(legend[0].id).toBe("original");
  });

  it("names only what is on screen, in the list's order", () => {
    const legend = relationshipLegend(["same_vibe", "remix"]);

    expect(legend.map((entry) => entry.id)).toEqual(["remix", "same_vibe"]);
  });

  it("puts a type the list does not know after the ones it does", () => {
    const legend = relationshipLegend(["unheard_of", "transition"]);

    expect(legend.map((entry) => entry.id)).toEqual(["transition", "unheard_of"]);
  });
});
