import { describe, expect, it } from "vitest";

import {
  estimateTextWidth,
  labelBox,
  labelFontSize,
  labelledCollideRadius,
  wrapLabel,
  LABEL_GRAPH_FONT,
  LABEL_SMALL_AFTER,
  LABEL_SMALL_FONT,
  LABEL_WRAP_WIDTH,
} from "./labels";

describe("wrapLabel", () => {
  it("keeps a short title on one line", () => {
    expect(wrapLabel("Ember", LABEL_WRAP_WIDTH, LABEL_GRAPH_FONT)).toEqual(["Ember"]);
  });

  // Issue #37: nothing is cut off. A long title wraps instead of truncating.
  it("wraps a long title onto several lines and loses no characters", () => {
    const title = "Premiere: Sol Ortega - West Code";
    const lines = wrapLabel(title, LABEL_WRAP_WIDTH, LABEL_GRAPH_FONT);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(" ")).toBe(title);
  });

  it("breaks a single word wider than the line instead of dropping it", () => {
    const word = "A".repeat(60);
    const lines = wrapLabel(word, LABEL_WRAP_WIDTH, LABEL_GRAPH_FONT);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toBe(word);
    for (const line of lines) expect(estimateTextWidth(line, LABEL_GRAPH_FONT)).toBeLessThanOrEqual(LABEL_WRAP_WIDTH);
  });

  it("returns nothing for an empty title", () => {
    expect(wrapLabel("   ", LABEL_WRAP_WIDTH, LABEL_GRAPH_FONT)).toEqual([]);
  });

  it("keeps every line inside the wrap width", () => {
    const lines = wrapLabel("St. Concrete - Warscar Raptor Long Title Here", LABEL_WRAP_WIDTH, LABEL_GRAPH_FONT);
    for (const line of lines) expect(estimateTextWidth(line, LABEL_GRAPH_FONT)).toBeLessThanOrEqual(LABEL_WRAP_WIDTH);
  });
});

describe("labelFontSize", () => {
  it("uses the normal face up to the threshold and the smaller one after", () => {
    expect(labelFontSize("Ember")).toBe(LABEL_GRAPH_FONT);
    expect(labelFontSize("x".repeat(LABEL_SMALL_AFTER))).toBe(LABEL_GRAPH_FONT);
    expect(labelFontSize("x".repeat(LABEL_SMALL_AFTER + 1))).toBe(LABEL_SMALL_FONT);
  });
});

describe("labelBox", () => {
  it("grows taller with more lines and wider with a longer line", () => {
    const short = labelBox("Ember");
    const long = labelBox("Premiere: Sol Ortega - West Code");
    expect(long.lines).toBeGreaterThanOrEqual(short.lines);
    expect(long.height).toBeGreaterThanOrEqual(short.height);
  });

  it("never reserves less than the minimum text width", () => {
    expect(labelBox("Ai").halfWidth).toBeGreaterThan(10);
  });
});

describe("labelledCollideRadius", () => {
  // The layout depends on this: a labelled node must reserve room for its box,
  // so two labels cannot overlap however the force settles (#37).
  it("reserves at least the room a label box needs below the disc", () => {
    const title = "Premiere: Sol Ortega - West Code";
    const box = labelBox(title);
    const radius = labelledCollideRadius(7, title);
    expect(radius).toBeGreaterThan(box.halfWidth - 1);
    expect(radius * 2).toBeGreaterThan(7 + box.height);
  });

  it("is larger for a long title than for a short one", () => {
    expect(labelledCollideRadius(7, "Premiere: Sol Ortega - West Code")).toBeGreaterThan(labelledCollideRadius(7, "Ember"));
  });
});
