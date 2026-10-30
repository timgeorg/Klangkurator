import { describe, expect, it } from "vitest";

import { initialRevealedCount, nextRevealedCount, revealedCountFor, REVEAL_PAGE } from "./useRevealedRows";

describe("nextRevealedCount", () => {
  it("adds one page while more rows remain", () => {
    expect(nextRevealedCount(50, 1907)).toBe(100);
  });

  it("clamps the last step to the total, so 1907 is not rounded up", () => {
    expect(nextRevealedCount(1900, 1907)).toBe(1907);
    expect(nextRevealedCount(1900, 1907)).not.toBe(1950);
  });

  it("does not grow past a list of one", () => {
    expect(nextRevealedCount(0, 1)).toBe(1);
    expect(nextRevealedCount(1, 1)).toBe(1);
  });

  it("grows a list of 51 in two steps", () => {
    expect(nextRevealedCount(50, 51)).toBe(51);
  });

  it("stays at the total for a list of exactly one page", () => {
    expect(nextRevealedCount(50, 50)).toBe(50);
  });

  it("returns 0 for an empty list", () => {
    expect(nextRevealedCount(0, 0)).toBe(0);
    expect(nextRevealedCount(50, 0)).toBe(0);
  });

  it("treats a negative count as the start", () => {
    expect(nextRevealedCount(-10, 500)).toBe(REVEAL_PAGE);
  });

  it("never returns a fractional row", () => {
    expect(Number.isInteger(nextRevealedCount(75, 1907))).toBe(true);
  });
});

describe("initialRevealedCount", () => {
  it("opens at one page", () => {
    expect(initialRevealedCount(1907)).toBe(50);
  });

  it("opens at the whole list when the list is shorter than a page", () => {
    expect(initialRevealedCount(12)).toBe(12);
    expect(initialRevealedCount(0)).toBe(0);
  });

  it("opens at exactly one page for a list of exactly one page", () => {
    expect(initialRevealedCount(50)).toBe(50);
  });
});

describe("revealedCountFor", () => {
  it("opens at one page and adds a page per step", () => {
    expect(revealedCountFor(1907, 0)).toBe(50);
    expect(revealedCountFor(1907, 1)).toBe(100);
    expect(revealedCountFor(1907, 38)).toBe(1907);
  });

  it("never exceeds the list, however many steps arrive", () => {
    expect(revealedCountFor(1907, 999)).toBe(1907);
    expect(revealedCountFor(12, 5)).toBe(12);
    expect(revealedCountFor(0, 3)).toBe(0);
  });

  it("derives the first page from the list, so a late-arriving list still shows", () => {
    expect(revealedCountFor(0, 0)).toBe(0);
    expect(revealedCountFor(1907, 0)).toBe(50);
  });

  it("ignores a negative step count", () => {
    expect(revealedCountFor(1907, -4)).toBe(50);
  });

  it("walks 1,907 in 38 steps, the last one short", () => {
    let n = 0;
    let steps = 0;
    do {
      n = revealedCountFor(1907, ++steps);
    } while (n < 1907 && steps < 100);
    expect(n).toBe(1907);
    expect(steps).toBe(38);
  });
});
