import { useCallback, useEffect, useRef, useState } from "react";

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
 * The nearest ancestor that scrolls vertically: the table's own scroll container.
 *
 * @param el (HTMLElement | null): The element to start from.
 * @returns (HTMLElement | null): The scrolling ancestor, or null for the page itself.
 */
function scrollParent(el: HTMLElement | null): HTMLElement | null {
  let parent = el?.parentElement ?? null;
  while (parent) {
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === "auto" || overflowY === "scroll") return parent;
    parent = parent.parentElement;
  }
  return null;
}

/** One screen of the scroller ahead, so the next page is ready before it is reached. */
const SCROLLER_MARGIN = "100% 0px";

/**
 * Whether a rendered list key change must start the count again.
 *
 * A key is not an identity — returning to a crate or clearing a search brings the
 * same key back — so comparing the incoming key with the one last rendered, not
 * with the key stored beside the steps, is what makes a return start at one page.
 *
 * @param lastRenderedKey (string): The key of the list the table last rendered.
 * @param incomingKey (string): The key of the list about to render.
 * @returns (boolean): True when this is a different visit and the count restarts.
 */
export function isNewVisit(lastRenderedKey: string, incomingKey: string): boolean {
  return lastRenderedKey !== incomingKey;
}

/**
 * How many library rows to render, growing while the sentinel stays in view.
 *
 * The table renders `rows.slice(0, count)`. A list change — the library's
 * `viewKey`, which covers search, filters and sort but not inline edits — starts
 * the count again at one page, so an inline edit keeps its rows and its scroll.
 *
 * A key is not an identity: going back to a crate or clearing a search brings the
 * *same* key back, and the count must start again rather than remember how far the
 * previous visit had grown. So the key the table last rendered is tracked, and any
 * change to it — including a return to an earlier key — resets the steps. A step is
 * held beside the key it was taken for, so a step counted for one visit can never
 * grow another.
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
  // The steps taken for the current visit, tagged with the key they belong to.
  const [steps, setSteps] = useState<{ key: string; extra: number }>({ key: resetKey, extra: 0 });
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  // The key the table last rendered. Comparing against it — rather than against the
  // key inside `steps` — is what makes returning to an earlier list start again.
  const [lastKey, setLastKey] = useState(resetKey);

  // A key change is a new visit. Both are adjusted during render, so the very first
  // render of the returned list already reads `extra` 0: clearing the key alone
  // would let the next render find the returned key still matching `steps.key` and
  // restore the count the earlier visit had grown to.
  if (isNewVisit(lastKey, resetKey)) {
    setLastKey(resetKey);
    setSteps({ key: resetKey, extra: 0 });
  }

  const extra = steps.key === resetKey ? steps.extra : 0;
  const count = revealedCountFor(total, extra);

  const sentinelRef = useCallback((next: HTMLDivElement | null) => setNode(next), []);

  useEffect(() => {
    if (!node || count >= total || typeof IntersectionObserver === "undefined") return;
    // The table scrolls inside its own container, not the page. An observer rooted
    // at the viewport intersects the sentinel with every ancestor's clip rect and
    // does not apply `rootMargin` to those clips, so the next page would only be
    // asked for once the sentinel is genuinely on screen. Rooting the observer at
    // the table's scroller makes "one screen ahead" mean one screen of the table.
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        // A step taken for an earlier visit to this same key must not be added to
        // this one, so a step always starts the visit it belongs to.
        setSteps((prev) => ({ key: resetKey, extra: prev.key === resetKey ? prev.extra + 1 : 1 }));
      },
      { root: scrollParent(node), rootMargin: SCROLLER_MARGIN },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, count, total, resetKey]);

  return { count, sentinelRef };
}
