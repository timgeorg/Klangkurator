import { useCallback, useEffect, useState } from "react";

/** Rows added per reveal step, and the size of the first build. */
export const REVEAL_PAGE = 50;

/**
 * The next row count after one reveal step.
 *
 * The rendered set is always a prefix of the row list, so this only ever grows
 * the count towards `total`; it never returns more rows than exist.
 *
 * @param count (number): The rows rendered now.
 * @param total (number): The rows that match.
 * @param page (number): The rows one step adds.
 * @returns (number): `count + page`, clamped to `total`.
 */
export function nextRevealedCount(count: number, total: number, page = REVEAL_PAGE): number {
  if (total <= 0) return 0;
  const start = Math.min(Math.max(count, 0), total);
  return Math.min(start + Math.max(page, 1), total);
}

/** The first build's row count: one page, or the whole list if it is shorter. */
export function initialRevealedCount(total: number, page = REVEAL_PAGE): number {
  return Math.min(Math.max(total, 0), Math.max(page, 1));
}

/**
 * The rows to render for a list of `total` after `extra` reveal steps.
 *
 * Derived rather than stored, so a list that arrives after the first render, a
 * list that shrinks and a new list all fall out of the arithmetic: the first page
 * is always shown, each step adds a page, and the answer never exceeds the list.
 *
 * @param total (number): The rows that match.
 * @param extra (number): Reveal steps taken for this list.
 * @param page (number): Rows per step.
 * @returns (number): The rows to render.
 */
export function revealedCountFor(total: number, extra: number, page = REVEAL_PAGE): number {
  const first = initialRevealedCount(total, page);
  const grown = first + Math.max(extra, 0) * Math.max(page, 1);
  return Math.min(grown, Math.max(total, 0));
}

/**
 * How many library rows to render, growing while the sentinel stays in view.
 *
 * The table renders `rows.slice(0, count)`. A new `resetKey` — the library's
 * `viewKey`, which covers search, filters and sort but not inline edits — starts
 * the count again, so a new list opens at one page and an edit keeps its rows.
 *
 * The steps are held with the key they were taken for, and the count is derived,
 * so nothing is set during render and a step counted for an old list can never
 * grow a new one.
 *
 * @param total (number): The rows that match, before any slicing.
 * @param resetKey (string): Changes when the list changes, not when a row is edited.
 * @returns (object): `count`, the rows to render, and `sentinelRef`, to attach to the
 *   element after the last rendered row.
 */
export function useRevealedRows(
  total: number,
  resetKey: string,
): { count: number; sentinelRef: (node: HTMLDivElement | null) => void } {
  const [steps, setSteps] = useState<{ key: string; extra: number }>({ key: resetKey, extra: 0 });
  const [node, setNode] = useState<HTMLDivElement | null>(null);

  const extra = steps.key === resetKey ? steps.extra : 0;
  const count = revealedCountFor(total, extra);

  const sentinelRef = useCallback((next: HTMLDivElement | null) => setNode(next), []);

  useEffect(() => {
    if (!node || count >= total || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setSteps((prev) => ({
          key: resetKey,
          // A step that arrives for a list that has just changed starts that list
          // at one page instead of adding to the old list's count.
          extra: prev.key === resetKey ? prev.extra + 1 : 0,
        }));
      },
      // One screen of the table ahead, so the next page is ready before it is
      // reached. The root is the viewport; the table's own scroll container clips
      // the sentinel, so this stays a near-page reveal rather than an early one.
      { rootMargin: "100% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, count, total, resetKey]);

  return { count, sentinelRef };
}
