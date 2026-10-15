// Track map (issue #8) — the cold renderer, shared by the dialog and the map
// page (plan phase 2). It only draws: the layout comes in as `positions`, and
// every position is pinned with fx/fy so the renderer's own simulation cannot
// drift it. `autoPauseRedraw` stays pinned on — the phase 2 spike measured 0
// canvas paints in 2 s idle with it, and a continuously redrawing canvas would
// cost at 5,000 tracks and in the WebKitGTK window.
//
// The canvas follows the design system's canvas rules: tokens are read at
// runtime (so the theme and cover mode follow), the renderer scales the backing
// store by devicePixelRatio, text is drawn after `document.fonts.ready`, and the
// canvas redraws when the theme class or the cover mode changes. Orange means
// "this one": the playing node carries the orange cut and the selected node the
// focus ring; hover emphasis and every edge use other colours.
//
// Phase 5 gives it its edge language: edges that share a pair are drawn side by
// side (several relationship types, or A→B beside B→A), and a selected track's
// transition edges show their deduplicated notes as labels (TM-L1, TM-L2,
// TM-L3, TM-L6). Both come from the pure, tested
// `lib/trackMap/layerEdges.ts`.
//
// Phase 6: a cluster node draws differently from a track — hollow, a tinted arc
// of its genre colour with a hairline outline, sized by its track count through
// `nodeRadius`, and labelled with its value and count — so a group never reads
// as one track. Clicking one chooses that cluster (the page turns the click into
// a `ClusterFilter`; TM-C3).
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import type { ForceGraphMethods, LinkObject, NodeObject } from "react-force-graph-2d";
import { getMainGenreColor } from "@/lib/genreData";
import { relationshipStyle } from "@/lib/relationshipStyle";
import { offsetEdges, transitionNotes } from "@/lib/trackMap/layerEdges";
import {
  labelBox,
  labelFontSize,
  wrapLabel,
  LABEL_BOX_PAD_X,
  LABEL_GRAPH_FONT,
  LABEL_GAP,
  LABEL_MAX_SCREEN_PX,
  LABEL_MIN_SCREEN_PX,
  LABEL_WRAP_WIDTH,
} from "@/lib/trackMap/labels";
import { DEFAULT_NODE_THRESHOLD } from "@/lib/trackMap/clusters";
import { nodeRadius } from "@/lib/trackMap/layout";
import { animationProgress, easeOutCubic, interpolatePositions } from "@/lib/trackMap/positionsAnimation";
import type { MapEdge, MapNode, Positions, TrackMapCanvasHandle, TrackMapCanvasProps } from "@/lib/trackMap/types";

/** The camera moves in the app's own 220 ms, not the position animation's 400. */
const CAMERA_MS = 220;
/** Padding the fit leaves around the map. */
const FIT_PADDING = 48;
/** One zoom step of the toolbar's buttons. */
const ZOOM_STEP = 1.3;
const MIN_SCALE = 0.2;
const MAX_SCALE = 8;
/** A hovered or selected node's halo, past the disc. */
const RING_GAP = 5;
/**
 * The zoom at which a track's artwork starts to draw (issue #31). Covers are
 * expensive — at 5,000 tracks the map would try to decode thousands of them — so
 * they appear once the camera is this close. Below it a node is the full genre
 * colour.
 *
 * It is deliberately low: Tim, 2026-10-15 — *"album covers can be displayed a lot
 * longer, only very late at zoomout they shall be collapsed."* It pairs with
 * `ARTWORK_ZOOM_HYSTERESIS`, which keeps the covers from flickering on and off
 * while the user zooms around the threshold.
 */
const ARTWORK_SCALE = 0.35;
/** How far past the threshold the camera must travel back out before covers are
 *  dropped again — one zoom step — so the boundary does not flicker. */
const ARTWORK_SCALE_EXIT = ARTWORK_SCALE / ZOOM_STEP;
/** Report the zoom level to the page at most this often while it is changing. */
const ZOOM_REPORT_MS = 120;
/** The cover's inset inside the genre ring: the ring stays visible as a contour. */
const ARTWORK_INSET = 0.24;
/** How long a cover is cached before it is dropped again, so a big map keeps a
 *  bounded number of decoded images. */
/**
 * The cache holds every cover a track-mode map can draw — `DEFAULT_NODE_THRESHOLD`
 * tracks, above which the map clusters and stops drawing covers at all — plus
 * slack for the zoom transitions around it. Sizing it below that would evict and
 * re-decode covers on every frame, which is the cost this cache exists to avoid.
 */
const ARTWORK_CACHE_MAX = DEFAULT_NODE_THRESHOLD + 100;
/** The gap a line leaves at a node's edge. */
const EDGE_GAP = 3;
/** The extra room an arrowhead leaves at the target node. */
const ARROW_GAP = 6;
/** The widest a transition's note may draw as an edge label before it is trimmed. */
const EDGE_LABEL_MAX_WIDTH = 160;
/** How far the pointer may move between down and up and still count as a click. */
const CLICK_SLOP = 5;
/** The gap between two clicks that still counts as a double-click. */
const DOUBLE_CLICK_MS = 350;
/** The slop a node's hit area gains, so small discs are still easy to hit. */
const HIT_SLOP = 4;
/** A position change below this is not worth animating. */
const EPSILON = 0.01;

/**
 * A node as the renderer draws it: the map node plus its pinned position. A
 * type alias, not an interface, so it keeps the renderer's own implicit index
 * signature and stays assignable to the shapes its props expect.
 */
type GraphNode = NodeObject & {
  id: string;
  map: MapNode;
};

/**
 * A drawn edge. A type alias, not an interface, so it is still assignable to
 * the renderer's own link shape (which carries an implicit index signature).
 * `offset` is the perpendicular place the edge takes among the edges on its
 * pair, so several relationship types between the same two tracks — or the two
 * directions of a transition — are drawn side by side (TM-L1, TM-L3).
 */
type GraphLink = {
  source: string | GraphNode;
  target: string | GraphNode;
  edge: MapEdge;
  offset: number;
};

/** The design tokens the canvas draws with, read at draw time so themes follow. */
interface Palette {
  fg: string;
  muted: string;
  border: string;
  signal: string;
  labelBg: string;
  sans: string;
  /** Opacity of the flat orange disc over the multiplied one (--cut-tint). */
  cutTint: number;
  /** The app's cover mode, so a canvas cover matches a DOM one (issue #31). */
  covers: string;
}

/**
 * The design tokens as canvas paint, read from the document at draw time.
 * Canvas cannot use Tailwind classes, so this is the one place raw values are
 * read — from the tokens, never hardcoded (the design system's canvas rule).
 */
function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const hsl = (name: string, alpha = 1) => `hsl(${css.getPropertyValue(`--${name}`).trim()} / ${alpha})`;
  return {
    fg: hsl("foreground"),
    muted: hsl("muted-foreground"),
    border: hsl("border"),
    signal: hsl("signal"),
    labelBg: hsl("popover", 0.9),
    sans: css.getPropertyValue("--font-sans").trim() || "Inter, system-ui, sans-serif",
    cutTint: parseFloat(css.getPropertyValue("--cut-tint")) || 0.8,
    covers: document.documentElement.dataset.covers ?? "editorial",
  };
}

/** Whether the user asked for less motion; a position change then jumps. */
function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The track covers the canvas draws (issue #31), kept as decoded images so a
 * frame never waits on a network or a decode. Far out the map draws genre
 * colours instead, so a big library never loads thousands of covers: the cache
 * fills only while the artwork zoom holds, and it is trimmed oldest-first once
 * it passes `ARTWORK_CACHE_MAX`.
 */
const artworkCache = new Map<string, HTMLImageElement | "loading" | "failed">();

function artworkFor(url: string | undefined, onReady: () => void): HTMLImageElement | null {
  if (!url) return null;
  const cached = artworkCache.get(url);
  if (cached === "failed") return null;
  if (cached === "loading") return null;
  if (cached) return cached;
  artworkCache.set(url, "loading");
  const image = new Image();
  image.decoding = "async";
  image.onload = () => {
    artworkCache.set(url, image);
    trimArtworkCache();
    onReady();
  };
  image.onerror = () => artworkCache.set(url, "failed");
  image.src = url;
  return null;
}

function trimArtworkCache(): void {
  if (artworkCache.size <= ARTWORK_CACHE_MAX) return;
  for (const [key, value] of artworkCache) {
    if (value === "loading") continue;
    artworkCache.delete(key);
    if (artworkCache.size <= ARTWORK_CACHE_MAX) break;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** A rounded rectangle path, so labels draw the same on any canvas renderer. */
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

/** Trims text to a width, with an ellipsis, so labels never overrun their neighbours. */
function truncate(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(`${text.slice(0, mid)}…`).width <= width) lo = mid;
    else hi = mid - 1;
  }
  return `${text.slice(0, lo).trimEnd()}…`;
}

/** Whether two solves landed every node on the same spot, within a hair's width. */
function samePositions(a: Positions, b: Positions, nodes: readonly MapNode[]): boolean {
  for (const node of nodes) {
    const from = a.get(node.id);
    const to = b.get(node.id);
    if (!from || !to) return false;
    if (Math.abs(from.x - to.x) > EPSILON || Math.abs(from.y - to.y) > EPSILON) return false;
  }
  return true;
}

/**
 * The track map's canvas: discs in the users' genre colours, one line style per
 * relationship type, the orange cut and the focus ring on the tracks that are
 * playing and selected. Edges that share a pair are spread beside each other,
 * so they never draw on top of one another, and the selected track's transition
 * edges carry their notes as labels.
 *
 * Everything positional is pinned, so the renderer never simulates and never
 * redraws while idle. A change of `positions` moves the nodes into place in one
 * 400 ms ease-out animation (a jump under reduced motion), reporting the
 * mid-animation positions through `onDisplayedPositions` for a warm start. The
 * animation's timing and arithmetic are pure and tested, in
 * `lib/trackMap/positionsAnimation.ts`. The canvas's accessible name is `label`;
 * the details beside it are DOM, not canvas, and are the keyboard path.
 */
export const TrackMapCanvas = forwardRef<TrackMapCanvasHandle, TrackMapCanvasProps>(function TrackMapCanvas(
  { nodes, edges, positions, selectedId, playingId, label, onSelect, onDoubleClick, onHover, onZoom, onDisplayedPositions },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  // The renderer's imperative handle, typed exactly as its own `ref` prop
  // declares it for the JSX generics below.
  const graphRef = useRef<
    ForceGraphMethods<NodeObject<GraphNode>, LinkObject<GraphNode, GraphLink>> | undefined
  >(undefined);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [palette, setPalette] = useState<Palette>(readPalette);
  const [fontsReady, setFontsReady] = useState(() => typeof document === "undefined" || !document.fonts);
  const [displayed, setDisplayed] = useState<Positions>(positions);

  const displayedRef = useRef<Positions>(positions);
  /** The map nodes by id, for the link renderer's endpoint lookup. */
  const nodeIndex = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const animationRef = useRef<number | null>(null);
  const idSetRef = useRef<string>("");
  /** Bumped to ask the pinned renderer for exactly one more frame (a cover
   *  finished decoding, or the artwork zoom was crossed). */
  const [repaint, setRepaint] = useState(0);
  /** Whether covers draw at the current zoom; a latch, see `artworkOnRef`. */
  const [artworkVisible, setArtworkVisible] = useState(false);
  /** The last zoom level reported to the page, for the throttle below. */
  const zoomReportRef = useRef(0);
  const requestRepaint = useCallback(() => setRepaint((tick) => tick + 1), []);

  /**
   * Latch the artwork to the zoom: on at `ARTWORK_SCALE`, staying on until the
   * camera is a step further out (`ARTWORK_SCALE_EXIT`), so covers neither
   * flicker at the boundary nor disappear the moment the user nudges the wheel.
   * Runs per drawn frame and only sets state when the answer changes, so it
   * cannot loop.
   */
  const syncArtwork = useCallback(() => {
    const scale = graphRef.current?.zoom() ?? 1;
    const next = artworkOnRef.current ? scale >= ARTWORK_SCALE_EXIT : scale >= ARTWORK_SCALE;
    if (next === artworkOnRef.current) return;
    artworkOnRef.current = next;
    setArtworkVisible(next);
  }, []);

  /**
   * Report the camera's zoom to the page. Throttled, because a wheel or a pinch
   * fires continuously; `flush` (used on `onZoomEnd`) always reports, so the
   * readout settles on the value actually on screen.
   */
  const reportZoom = useCallback((scale: number, flush = false) => {
    const now = performance.now();
    if (!flush && now - zoomReportRef.current < ZOOM_REPORT_MS) return;
    zoomReportRef.current = now;
    onZoomRef.current?.(scale);
  }, []);
  /** The first layout appears in place; nothing animates on mount. */
  const firstRunRef = useRef(true);
  /** Set when a fit is wanted; performed once the positions have settled. */
  const pendingFitRef = useRef(true);
  /** The first fit is instant: the map appears in place, nothing moved on load. */
  const firstFitRef = useRef(true);
  /** Bumped whenever a position commit finishes, so the fit effect runs after it. */
  const [settleTick, setSettleTick] = useState(0);
  // The animation effect must not re-run when the parent hands in a new callback
  // identity, so it reads the latest one through a ref.
  const onDisplayedPositionsRef = useRef(onDisplayedPositions);
  /** Issue #32 / #35: the latest double-click and hover handlers, read by the
   *  pointer effect without re-binding it. */
  const onDoubleClickRef = useRef(onDoubleClick);
  const onHoverRef = useRef(onHover);
  /** The latest zoom reporter, so the renderer's own prop stays stable. */
  const onZoomRef = useRef(onZoom);
  /**
   * Whether covers are currently drawn. Latched, with the two thresholds above,
   * so the artwork does not flicker on and off while the user zooms around the
   * boundary (Tim asked for covers to stay "a lot longer"; this keeps the far
   * side stable too rather than letting it chatter).
   */
  const artworkOnRef = useRef(false);

  const selected = selectedId ?? null;
  const playing = playingId ?? null;

  useEffect(() => {
    onDisplayedPositionsRef.current = onDisplayedPositions;
    onZoomRef.current = onZoom;
  }, [onDisplayedPositions, onZoom]);

  // The canvas fills its container; the parent decides how much room it gets.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      const rect = container.getBoundingClientRect();
      setSize({ width: Math.max(1, Math.round(rect.width)), height: Math.max(1, Math.round(rect.height)) });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // The first layout appears in place and is framed; every later change — the
  // shown set, a weight, the core — moves the nodes from where they are into
  // their new places, in one 400 ms ease-out run (a jump under reduced motion).
  // A node the canvas is not showing yet appears at its new place rather than
  // flying in, so a change of the shown set reads as the map rearranging.
  useEffect(() => {
    const ids = nodes.map((node) => node.id).join("\u0000");
    const nodeSetChanged = ids !== idSetRef.current;
    idSetRef.current = ids;

    const previous = displayedRef.current;
    if (pendingFitRef.current || nodeSetChanged || !previous) pendingFitRef.current = true;

    const firstRun = firstRunRef.current;
    firstRunRef.current = false;

    const commit = (next: Positions) => {
      displayedRef.current = next;
      setDisplayed(next);
      onDisplayedPositionsRef.current?.(next);
    };

    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    // Nothing animates on the first layout, under reduced motion, or when the
    // positions are where they already are (a re-render, not a re-solve).
    if (firstRun || !previous || prefersReducedMotion() || samePositions(previous, positions, nodes)) {
      commit(positions);
      setSettleTick((tick) => tick + 1);
      return;
    }

    const from = previous;
    const startedAt = performance.now();
    const step = () => {
      // The timing is pure (positionsAnimation.ts): the frame asks how far in it
      // is and where the nodes are at that moment.
      const progress = animationProgress(startedAt, performance.now());
      commit(interpolatePositions(nodes, from, positions, easeOutCubic(progress)));
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(step);
      } else {
        animationRef.current = null;
        setSettleTick((tick) => tick + 1);
      }
    };
    step();

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [nodes, positions]);

  // The theme and the cover mode both live on the root element; a change
  // re-reads the tokens and repaints, so no colour is left over from the old one.
  useEffect(() => {
    const observer = new MutationObserver(() => setPalette(readPalette()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "data-covers"],
    });
    return () => observer.disconnect();
  }, []);

  // Text waits for the fonts, so labels are measured and drawn in Inter.
  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) return;
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) setFontsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Frames the map's bounds: the camera lands on everything on screen. */
  const frame = useCallback(
    (target: Positions, duration: number) => {
      const graph = graphRef.current;
      if (!graph || !size.width || !size.height) return;
      const spots = nodes
        .map((node) => ({ node, spot: target.get(node.id) }))
        .filter((entry): entry is { node: MapNode; spot: { x: number; y: number } } => !!entry.spot);
      if (!spots.length) return;
      const radius = Math.max(...spots.map((entry) => nodeRadius(entry.node)));
      const xs = spots.map((entry) => entry.spot.x);
      const ys = spots.map((entry) => entry.spot.y);
      const minX = Math.min(...xs) - radius;
      const maxX = Math.max(...xs) + radius;
      const minY = Math.min(...ys) - radius;
      const maxY = Math.max(...ys) + radius;
      const spanX = Math.max(1, maxX - minX);
      const spanY = Math.max(1, maxY - minY);
      const scale = clamp(
        Math.min((size.width - FIT_PADDING * 2) / spanX, (size.height - FIT_PADDING * 2) / spanY),
        MIN_SCALE,
        MAX_SCALE,
      );
      graph.centerAt((minX + maxX) / 2, (minY + maxY) / 2, duration);
      graph.zoom(scale, duration);
    },
    [nodes, size.height, size.width],
  );

  const frameRef = useRef(frame);
  frameRef.current = frame;

  // A wanted fit runs once the positions have settled and the renderer is ready.
  // The first fit is instant, so the map appears in place with nothing animating
  // on load; a later node-set change moves the camera in the app's 220 ms — and
  // instantly under reduced motion, so a change that re-frames the map still
  // leaves two screenshots after it identical (the phase 4b clause, TM-R2).
  useEffect(() => {
    if (!pendingFitRef.current || !graphRef.current || !size.width) return;
    pendingFitRef.current = false;
    const duration = firstFitRef.current || prefersReducedMotion() ? 0 : CAMERA_MS;
    firstFitRef.current = false;
    frameRef.current(displayedRef.current, duration);
  }, [settleTick, size.width]);

  const handle = useMemo<TrackMapCanvasHandle>(
    () => ({
      zoomIn: () => {
        const graph = graphRef.current;
        if (graph) graph.zoom(clamp(graph.zoom() * ZOOM_STEP, MIN_SCALE, MAX_SCALE), CAMERA_MS);
      },
      zoomOut: () => {
        const graph = graphRef.current;
        if (graph) graph.zoom(clamp(graph.zoom() / ZOOM_STEP, MIN_SCALE, MAX_SCALE), CAMERA_MS);
      },
      fit: () => frame(displayedRef.current, CAMERA_MS),
      reset: () => {
        const graph = graphRef.current;
        if (!graph) return;
        graph.centerAt(0, 0, CAMERA_MS);
        graph.zoom(1, CAMERA_MS);
      },
      centreOn: (id: string) => {
        const spot = displayedRef.current.get(id);
        if (graphRef.current && spot) graphRef.current.centerAt(spot.x, spot.y, CAMERA_MS);
      },
      zoomLevel: () => graphRef.current?.zoom() ?? 1,
    }),
    [frame],
  );
  useImperativeHandle(ref, () => handle, [handle]);

  /**
   * The graph's nodes, sorted so the selected one paints last (on top), each
   * pinned to its displayed position with fx/fy — the pin is what stops the
   * renderer's own engine from nudging a node off the solved layout.
   */
  const graphNodes = useMemo<GraphNode[]>(() => {
    const ordered = [...nodes].sort((a, b) => Number(a.id === selected) - Number(b.id === selected));
    return ordered.map((node): GraphNode => {
      const spot = displayed.get(node.id) ?? positions.get(node.id);
      const x = spot?.x ?? 0;
      const y = spot?.y ?? 0;
      return { id: node.id, map: node, x, y, fx: x, fy: y };
    });
  }, [displayed, nodes, positions, selected]);
  const graphLinks = useMemo<GraphLink[]>(() => {
    const known = new Set(nodes.map((node) => node.id));
    // The edges are placed in their side-by-side order before they reach the
    // renderer, so a pair carrying several types never draws one on top of the
    // other (TM-L1, TM-L3). `offsetEdges` is pure and tested in
    // `lib/trackMap/layerEdges.ts`.
    return offsetEdges(edges)
      .filter(({ edge }) => known.has(edge.source) && known.has(edge.target))
      .map(({ edge, offset }): GraphLink => ({ source: edge.source, target: edge.target, edge, offset }));
  }, [edges, nodes]);

  // A repaint is requested by re-rendering: the inline render callbacks below
  // change identity every render, and the renderer treats that as a change worth
  // one frame. An animation step, a hover, a selection and a theme change
  // therefore each paint once and then sleep again — and an idle canvas, whose
  // component does not re-render, paints not at all.
  const graphData = useMemo(() => ({ nodes: graphNodes, links: graphLinks }), [graphLinks, graphNodes]);

  /** Whether an end of the edge is hovered, so the rest of the map can dim. */
  const highlighted = useCallback(
    (from: string, to: string): boolean => hoveredId === null || from === hoveredId || to === hoveredId,
    [hoveredId],
  );

  // `repaint` is bumped when a cover decodes; reading it here keeps the frame's
  // render callbacks changing identity, which is how the pinned canvas is asked
  // for one more frame.
  void repaint;

  /** A transition's note, on a chip over the edge's own middle. */
  const drawEdgeLabel = useCallback(
    (ctx: CanvasRenderingContext2D, text: string, x: number, y: number) => {
      ctx.save();
      // The font is set before the text is measured, so the trim and the drawn
      // label agree.
      ctx.font = `500 11px ${palette.sans}`;
      const shown = truncate(ctx, text, EDGE_LABEL_MAX_WIDTH);
      const width = ctx.measureText(shown).width;
      ctx.fillStyle = palette.labelBg;
      roundedRect(ctx, x - width / 2 - 5, y - 9, width + 10, 18, 5);
      ctx.fill();
      ctx.fillStyle = palette.fg;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(shown, x, y);
      ctx.restore();
    },
    [palette],
  );

  const drawLink = useCallback(
    (link: GraphLink, ctx: CanvasRenderingContext2D) => {
      const { edge } = link;
      // The ends are resolved here, from the positions the canvas is showing,
      // rather than from the renderer's own link mutation (`source`/`target`
      // become node objects only once its force engine ticks, and a pinned
      // canvas never ticks). Both ends must be on the map.
      const sourceId = typeof link.source === "object" ? link.source.id : link.source;
      const targetId = typeof link.target === "object" ? link.target.id : link.target;
      const sourceNode = nodeIndex.get(sourceId);
      const targetNode = nodeIndex.get(targetId);
      const source = displayedRef.current.get(sourceId);
      const target = displayedRef.current.get(targetId);
      if (!sourceNode || !targetNode || !source || !target) return;

      // Transitions are the foreground and heaviest; a relationship type keeps
      // its own line language; similarity is thin and neutral, so computed and
      // authored edges never read alike.
      const style = edge.kind === "relationship" ? relationshipStyle(edge.relationshipType ?? "") : null;
      const colour =
        edge.kind === "transition" ? palette.fg : style?.color ?? (edge.kind === "nearest" ? palette.border : palette.muted);
      const width = edge.kind === "transition" ? 2.5 : style?.width ?? 1;
      const dash = edge.kind === "nearest" ? [] : style?.dash ?? [];

      const ax = source.x;
      const ay = source.y;
      const bx = target.x;
      const by = target.y;
      const distance = Math.hypot(bx - ax, by - ay) || 1;
      const ux = (bx - ax) / distance;
      const uy = (by - ay) / distance;
      // The edge's side-by-side place, measured in the pair's own frame (the
      // lower id to the higher one), so the two directions of a transition land
      // on opposite sides rather than sharing one. The endpoints stay on their
      // nodes; only the middle of the line moves, so the edge bends.
      const flip = edge.source <= edge.target ? 1 : -1;
      const nx = -uy * flip;
      const ny = ux * flip;
      const shift = link.offset ?? 0;
      const from = {
        x: ax + ux * (nodeRadius(sourceNode) + EDGE_GAP),
        y: ay + uy * (nodeRadius(sourceNode) + EDGE_GAP),
      };
      const to = { x: bx - ux * (nodeRadius(targetNode) + ARROW_GAP), y: by - uy * (nodeRadius(targetNode) + ARROW_GAP) };
      const mid = { x: (from.x + to.x) / 2 + nx * shift, y: (from.y + to.y) / 2 + ny * shift };

      ctx.save();
      ctx.globalAlpha = highlighted(edge.source, edge.target) ? 1 : 0.18;
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.quadraticCurveTo(mid.x, mid.y, to.x, to.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Authored edges are directional and carry an arrowhead; similarity does not.
      if (edge.kind !== "nearest") {
        // The arrow points along the curve's own end, so a bent edge still
        // aims at its target.
        const angle = Math.atan2(to.y - mid.y, to.x - mid.x);
        const head = 7;
        ctx.fillStyle = colour;
        ctx.beginPath();
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(to.x - head * Math.cos(angle - 0.45), to.y - head * Math.sin(angle - 0.45));
        ctx.lineTo(to.x - head * Math.cos(angle + 0.45), to.y - head * Math.sin(angle + 0.45));
        ctx.closePath();
        ctx.fill();
      }

      // The selected track's transitions show their notes as edge labels
      // (TM-L2, TM-L6); the notes are already deduplicated across the edge's
      // sources, so the same note written on a block and its set draws once.
      const onSelected = selected !== null && (edge.source === selected || edge.target === selected);
      if (fontsReady && onSelected && edge.kind === "transition") {
        const label = transitionNotes(edge).join(" · ");
        if (label) drawEdgeLabel(ctx, label, mid.x, mid.y);
      }
      ctx.restore();
    },
    [drawEdgeLabel, fontsReady, highlighted, nodeIndex, palette, selected],
  );

  const drawNode = useCallback(
    (mapNode: MapNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const spot = displayedRef.current.get(mapNode.id);
      if (!spot) return;
      const radius = nodeRadius(mapNode);
      const x = spot.x;
      const y = spot.y;
      const isSelected = mapNode.id === selected;
      const isPlaying = mapNode.id === playing;
      const isHovered = mapNode.id === hoveredId;
      const isCluster = mapNode.kind === "cluster";
      const genre = mapNode.genreLabel;

      // The disc: the user's genre colour when the track has one, neutral when
      // not. A cluster draws hollow — a hairline outline over a tinted fill —
      // so a group never reads as one track (REQ-33-CL).
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = genre ? getMainGenreColor(genre) : palette.muted;
      ctx.globalAlpha = isCluster ? 0.25 : 1;
      ctx.fill();
      ctx.restore();

      // Issue #31: from `ARTWORK_SCALE` on, a track's cover sits in the centre
      // and the genre reads as the outer ring. Far out the node stays the full
      // genre colour, so a large map never draws thousands of covers. The latch
      // (set in the draw pass below) holds them on past the threshold as the
      // camera pulls back, so the boundary does not flicker.
      if (!isCluster && mapNode.coverUrl && artworkVisible) {
        const cover = artworkFor(mapNode.coverUrl, requestRepaint);
        if (cover) {
          const inner = radius * (1 - ARTWORK_INSET);
          ctx.save();
          ctx.beginPath();
          ctx.arc(x, y, inner, 0, Math.PI * 2);
          ctx.clip();
          // The app's cover mode: editorial draws covers black and white, the
          // user's choice in Settings draws them in colour (REQ-33-NE). The
          // canvas reads the same flag the DOM does, so the two never disagree.
          ctx.filter = palette.covers === "editorial" ? "grayscale(1) contrast(1.05)" : "none";
          ctx.drawImage(cover, x - inner, y - inner, inner * 2, inner * 2);
          ctx.restore();
        }
      }

      // The genre ring: the outer contour, always drawn, so the genre stays
      // legible over artwork and the cover reads as an inset (issue #31).
      if (!isCluster && genre) {
        ctx.save();
        ctx.strokeStyle = getMainGenreColor(genre);
        ctx.lineWidth = Math.max(2, radius * ARTWORK_INSET);
        ctx.beginPath();
        ctx.arc(x, y, radius - ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (isCluster) {
        ctx.save();
        ctx.strokeStyle = palette.border;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // The orange cut: the playing track's disc carries the signal half-disc,
      // multiplied then laid flat, exactly like CoverArt's treatment.
      if (isPlaying) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.beginPath();
        ctx.arc(x + radius, y, radius, 0, Math.PI * 2);
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = palette.signal;
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = palette.cutTint;
        ctx.fill();
        ctx.restore();
      }

      // The focus ring marks the selected track; hover uses the foreground. It
      // sits outside the genre ring, so it stays readable over artwork.
      const ring = isSelected ? palette.signal : isHovered ? palette.fg : null;
      if (ring) {
        ctx.save();
        ctx.strokeStyle = ring;
        ctx.lineWidth = 2 / globalScale;
        ctx.beginPath();
        ctx.arc(x, y, radius + RING_GAP / globalScale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Issue #37: every track's title draws in full, wrapped onto as many lines
      // as it needs — nothing is trimmed and nothing is hidden. The layout
      // reserves the room (the label-aware collide radius), so the labels do not
      // overlap however the map settles.
      if (!fontsReady) return;
      const title = mapNode.kind === "cluster" ? `${mapNode.label} · ${mapNode.count ?? 0}` : mapNode.label;
      if (!title) return;
      // The context is scaled by the zoom, so a label that should read at a
      // constant size on screen is drawn at `screen px / globalScale`. It is
      // then capped at the size the layout reserved, and — because the layout
      // sizes a label from an *estimate* of the text's width, which the real
      // font can beat on a wide title — any label whose measured lines would
      // exceed the reserved box is shrunk until they fit. Drawing inside the
      // reserved box is what makes "no two labels overlap" true rather than
      // likely (TM-L9).
      const screenPx = clamp(labelFontSize(title) * globalScale, LABEL_MIN_SCREEN_PX, LABEL_MAX_SCREEN_PX);
      const reserved = labelBox(title);
      const reservedText = reserved.halfWidth * 2 - LABEL_BOX_PAD_X * 2;
      let fontPx = Math.min(screenPx / globalScale, labelFontSize(title));
      const lineHeight = () => fontPx * 1.25;
      ctx.save();
      ctx.font = `600 ${fontPx}px ${palette.sans}`;
      let lines = wrapLabel(title, LABEL_WRAP_WIDTH, LABEL_GRAPH_FONT);
      let widest = lines.reduce((max, line) => Math.max(max, ctx.measureText(line).width), 0);
      if (widest > reservedText && widest > 0) {
        fontPx *= reservedText / widest;
        ctx.font = `600 ${fontPx}px ${palette.sans}`;
        // Re-wrap at the drawn size too, so the lines are as wide as allowed
        // rather than merely scaled.
        lines = wrapLabel(title, reservedText, fontPx);
        widest = lines.reduce((max, line) => Math.max(max, ctx.measureText(line).width), 0);
      }
      const top = y + radius + LABEL_GAP / globalScale + fontPx / 2;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = palette.labelBg;
      roundedRect(
        ctx,
        x - widest / 2 - fontPx * 0.35,
        top - fontPx / 2 - fontPx * 0.18,
        widest + fontPx * 0.7,
        lines.length * lineHeight() + fontPx * 0.2,
        fontPx * 0.3,
      );
      ctx.fill();
      ctx.fillStyle = palette.fg;
      lines.forEach((line, index) => {
        ctx.fillText(line, x, top + index * lineHeight());
      });
      ctx.restore();
    },
    [artworkVisible, fontsReady, hoveredId, palette, playing, requestRepaint, selected],
  );

  /**
   * The node under a client point, or null. The canvas is pinned, so the
   * renderer's own hover hit-test would go stale between redraws; this reads the
   * positions the canvas is actually showing, through the renderer's own
   * screen-to-graph conversion.
   */
  const nodeAt = useCallback(
    (clientX: number, clientY: number): MapNode | null => {
      const graph = graphRef.current;
      const container = containerRef.current;
      if (!graph || !container) return null;
      const rect = container.getBoundingClientRect();
      const point = graph.screen2GraphCoords(clientX - rect.left, clientY - rect.top);
      let best: MapNode | null = null;
      let bestDistance = Infinity;
      for (const node of nodes) {
        const spot = displayedRef.current.get(node.id);
        if (!spot) continue;
        const distance = Math.hypot(point.x - spot.x, point.y - spot.y);
        if (distance <= nodeRadius(node) + HIT_SLOP && distance < bestDistance) {
          best = node;
          bestDistance = distance;
        }
      }
      return best;
    },
    [nodes],
  );

  // Pointer interaction: the hover that highlights an edge's ends, and the click
  // that selects a node or clears the selection. A pan (movement past a few px)
  // is left to the renderer's own zoom and pan.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let pressed: { x: number; y: number; node: MapNode | null } | null = null;

    const onMove = (event: PointerEvent) => {
      if (pressed) return;
      const node = nodeAt(event.clientX, event.clientY);
      setHoveredId((current) => (current === (node?.id ?? null) ? current : node?.id ?? null));
      onHoverRef.current?.(node?.id ?? null, node ? event.clientX : null, node ? event.clientY : null);
    };
    const onDown = (event: PointerEvent) => {
      pressed = { x: event.clientX, y: event.clientY, node: nodeAt(event.clientX, event.clientY) };
    };
    let lastClick: { id: string; node: MapNode | null; at: number } | null = null;
    const onUp = (event: PointerEvent) => {
      const start = pressed;
      pressed = null;
      if (!start) return;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_SLOP) return;
      const node = nodeAt(event.clientX, event.clientY);
      const now = performance.now();
      const id = node?.id ?? null;
      // Issue #32: two clicks on the same track inside the window play it. The
      // first click still selects immediately — a single click is never held
      // back waiting for a second one — so a double-click reads as "select,
      // then play".
      if (node && lastClick && lastClick.id === id && now - lastClick.at <= DOUBLE_CLICK_MS) {
        lastClick = null;
        onDoubleClickRef.current?.(node.id);
        return;
      }
      lastClick = node ? { id: node.id, node, at: now } : null;
      if (node) onSelect(node.id);
      else if (!start.node) onSelect(null);
    };
    const onLeave = () => {
      pressed = null;
      setHoveredId((current) => (current === null ? current : null));
      onHoverRef.current?.(null, null, null);
    };

    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerdown", onDown);
    container.addEventListener("pointerup", onUp);
    container.addEventListener("pointercancel", onLeave);
    container.addEventListener("pointerleave", onLeave);
    return () => {
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerdown", onDown);
      container.removeEventListener("pointerup", onUp);
      container.removeEventListener("pointercancel", onLeave);
      container.removeEventListener("pointerleave", onLeave);
    };
  }, [nodeAt, onSelect]);

  // The double-click and hover callbacks are read through refs, so the pointer
  // effect does not re-bind (and lose a pending first click) when the page hands
  // in a new callback identity.
  useEffect(() => {
    onDoubleClickRef.current = onDoubleClick;
    onHoverRef.current = onHover;
  }, [onDoubleClick, onHover]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={label}
      className="relative h-full w-full cursor-grab overflow-hidden active:cursor-grabbing"
    >
      {size.width > 0 && size.height > 0 && (
        <ForceGraph2D<GraphNode, GraphLink>
          ref={graphRef}
          graphData={graphData}
          width={size.width}
          height={size.height}
          // Cold and pinned: the layout is solved headless, so the renderer's own
          // simulation must not move anything and must not redraw while idle.
          // Pointer interaction is ours (see above), so the hover canvas that
          // would throttle and go stale stays off.
          autoPauseRedraw
          cooldownTicks={1}
          warmupTicks={0}
          d3AlphaDecay={1}
          d3VelocityDecay={1}
          enableNodeDrag={false}
          enablePointerInteraction={false}
          minZoom={MIN_SCALE}
          maxZoom={MAX_SCALE}
          nodeRelSize={1}
          nodeCanvasObject={(node, ctx, globalScale) => drawNode(node.map, ctx, globalScale)}
          nodeCanvasObjectMode={() => "replace"}
          // The latch is read per frame (and only changes state when the answer
          // changes), and the zoom is reported on every camera change, so the
          // page's readout follows the wheel and a pinch too.
          onRenderFramePost={() => syncArtwork()}
          onZoom={(transform) => reportZoom(transform.k)}
          onZoomEnd={(transform) => reportZoom(transform.k, true)}
          // These two are deliberately not memoised: a prop whose identity changed
          // tells the renderer to draw exactly one frame, which is how the pinned
          // (auto-pausing) canvas repaints on an animation step, a hover, a
          // selection or a theme change — and never while idle.
          linkCanvasObject={(link, ctx) => drawLink(link as unknown as GraphLink, ctx)}
          linkCanvasObjectMode={() => "replace"}
        />
      )}
    </div>
  );
});
