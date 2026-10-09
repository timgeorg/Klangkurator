import { useEffect, useRef } from "react";

import { RelationLine } from "@/components/detail/RelationLine";
import { RELATIONSHIP_STYLES, RELATIONSHIP_TYPES, relationshipStyle } from "@/lib/relationshipStyle";
import type { Song, SongRelationship } from "@/lib/storage";

export interface GraphRelationships {
  asSource: Array<SongRelationship & { targetSong: Song }>;
  asTarget: Array<SongRelationship & { sourceSong: Song }>;
}

interface SongRelationshipGraphProps {
  centerSong: Song;
  relationships: GraphRelationships;
  onNavigateToSong?: (song: Song) => void;
}

interface GraphNode {
  id: string;
  song: Song;
  x: number;
  y: number;
  vx: number;
  vy: number;
  center: boolean;
  r: number;
}

interface GraphEdge {
  from: string;
  to: string;
  type: string;
}

interface Palette {
  fg: string;
  muted: string;
  border: string;
  signal: string;
  sunken: string;
  labelBg: string;
  /** Opacity of the flat orange disc over the multiplied one (--cut-tint). */
  cutTint: number;
}

const CENTER_R = 38;
const NODE_R = 26;
const LABEL_WIDTH = 136;
const SANS = '"Inter Variable", Inter, system-ui, sans-serif';

/** Read the design tokens at draw time so the canvas follows the theme. */
function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const hsl = (name: string, alpha = 1) => `hsl(${css.getPropertyValue(`--${name}`).trim()} / ${alpha})`;
  return {
    fg: hsl("foreground"),
    muted: hsl("muted-foreground"),
    border: hsl("border"),
    signal: hsl("signal"),
    sunken: hsl("surface-sunken"),
    labelBg: hsl("popover", 0.9),
    cutTint: parseFloat(css.getPropertyValue("--cut-tint")) || 0.8,
  };
}

// Covers prepared for the canvas (black and white unless the user chose original colour).
const coverCache = new Map<string, HTMLCanvasElement | "loading" | "failed">();

function coverFor(url: string, onReady: () => void): HTMLCanvasElement | null {
  const mode = document.documentElement.dataset.covers === "original" ? "original" : "bw";
  const key = `${mode}:${url}`;
  const cached = coverCache.get(key);
  if (cached instanceof HTMLCanvasElement) return cached;
  if (cached) return null;
  coverCache.set(key, "loading");
  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    const size = 112;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scale = Math.max(size / img.width, size / img.height);
    ctx.drawImage(img, (size - img.width * scale) / 2, (size - img.height * scale) / 2, img.width * scale, img.height * scale);
    if (mode === "bw") {
      try {
        const data = ctx.getImageData(0, 0, size, size);
        const d = data.data;
        for (let i = 0; i < d.length; i += 4) {
          const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2] - 128) * 1.08 + 128;
          d[i] = d[i + 1] = d[i + 2] = Math.max(0, Math.min(255, l));
        }
        ctx.putImageData(data, 0, 0);
      } catch {
        /* a tainted canvas keeps its colour */
      }
    }
    coverCache.set(key, canvas);
    onReady();
  };
  img.onerror = () => coverCache.set(key, "failed");
  img.src = url;
  return null;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function truncate(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(text.slice(0, mid) + "…").width <= width) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo).trimEnd() + "…";
}

/**
 * The relationship graph: the song in the centre (with the orange cut), its
 * direct relations around it, one line style per relationship type. A canvas
 * that reads the design tokens, scales for HiDPI and sleeps once the layout
 * settles. The list view is the keyboard path; the canvas says so.
 */
export function SongRelationshipGraph({ centerSong, relationships, onNavigateToSong }: SongRelationshipGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigateRef = useRef(onNavigateToSong);
  navigateRef.current = onNavigateToSong;

  const sim = useRef({
    nodes: [] as GraphNode[],
    edges: [] as GraphEdge[],
    w: 600,
    h: 416,
    dpr: 1,
    hover: null as string | null,
    drag: null as { id: string; startX: number; startY: number; moved: boolean } | null,
    raf: null as number | null,
    palette: null as Palette | null,
  });

  const related = relationships.asSource.length + relationships.asTarget.length;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const s = sim.current;
    s.palette = readPalette();

    // ---- graph data ----
    const nodeMap = new Map<string, GraphNode>();
    nodeMap.set(centerSong.id, { id: centerSong.id, song: centerSong, x: 0, y: 0, vx: 0, vy: 0, center: true, r: CENTER_R });
    const edges: GraphEdge[] = [];
    const addNode = (song: Song) => {
      if (!nodeMap.has(song.id)) nodeMap.set(song.id, { id: song.id, song, x: 0, y: 0, vx: 0, vy: 0, center: false, r: NODE_R });
    };
    relationships.asSource.forEach((rel) => {
      addNode(rel.targetSong);
      edges.push({ from: centerSong.id, to: rel.targetSong.id, type: rel.relationship_type });
    });
    relationships.asTarget.forEach((rel) => {
      addNode(rel.sourceSong);
      edges.push({ from: rel.sourceSong.id, to: centerSong.id, type: rel.relationship_type });
    });
    s.nodes = [...nodeMap.values()];
    s.edges = edges;

    // Related songs sit on an ellipse sized to the canvas, so wide canvases spread out
    const radii = () => ({ rx: Math.max(110, s.w * 0.36), ry: Math.max(96, s.h * 0.33) });
    const ellipseRadius = (angle: number) => {
      const { rx, ry } = radii();
      return (rx * ry) / Math.hypot(ry * Math.cos(angle), rx * Math.sin(angle));
    };
    const place = () => {
      const cx = s.w / 2;
      const cy = s.h / 2 - 8;
      const others = s.nodes.filter((n) => !n.center);
      const step = (2 * Math.PI) / Math.max(1, others.length);
      s.nodes.forEach((n) => {
        if (n.center) {
          n.x = cx;
          n.y = cy;
        }
      });
      const { rx, ry } = radii();
      others.forEach((n, i) => {
        const angle = step * i - Math.PI / 2;
        n.x = cx + Math.cos(angle) * rx;
        n.y = cy + Math.sin(angle) * ry;
        n.vx = 0;
        n.vy = 0;
      });
    };

    // ---- simulation: spring to the ellipse + mutual repulsion; returns peak speed ----
    const step = () => {
      const cx = s.w / 2;
      const cy = s.h / 2 - 8;
      let peak = 0;
      for (const n of s.nodes) {
        if (n.center) {
          n.x = cx;
          n.y = cy;
          continue;
        }
        if (s.drag?.id === n.id) continue;
        const dx = n.x - cx;
        const dy = n.y - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const spring = (dist - ellipseRadius(Math.atan2(dy, dx))) * 0.025;
        n.vx -= (dx / dist) * spring;
        n.vy -= (dy / dist) * spring;
        for (const o of s.nodes) {
          if (o === n || o.center) continue;
          const ox = n.x - o.x;
          const oy = n.y - o.y;
          const od = Math.hypot(ox, oy) || 1;
          if (od < 150) {
            const push = (150 - od) * 0.012;
            n.vx += (ox / od) * push;
            n.vy += (oy / od) * push;
          }
        }
        n.vx *= 0.82;
        n.vy *= 0.82;
        n.x = Math.max(70, Math.min(s.w - 70, n.x + n.vx));
        n.y = Math.max(44, Math.min(s.h - 56, n.y + n.vy));
        peak = Math.max(peak, Math.abs(n.vx), Math.abs(n.vy));
      }
      return peak;
    };

    // ---- drawing ----
    const draw = () => {
      const ctx = canvas.getContext("2d");
      const p = s.palette;
      if (!ctx || !p) return;
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      ctx.clearRect(0, 0, s.w, s.h);
      const byId = new Map(s.nodes.map((n) => [n.id, n]));
      const hovered = s.hover;

      // Boxes edge labels must stay clear of: node discs and the title plates under them.
      const ordered = [...s.nodes].sort((x, y) => Number(x.center) - Number(y.center));
      const plates = ordered.map((n) => {
        ctx.font = n.center ? `650 13px ${SANS}` : `600 12px ${SANS}`;
        const titleW = ctx.measureText(truncate(ctx, n.song.title, LABEL_WIDTH)).width;
        ctx.font = `400 11px ${SANS}`;
        const artistW = ctx.measureText(truncate(ctx, n.song.artist, LABEL_WIDTH)).width;
        const w = Math.max(titleW, artistW) + 14;
        return { x: n.x - w / 2, y: n.y + n.r + 8, w, h: 34 };
      });
      const blockers: Box[] = [
        ...plates,
        ...s.nodes.map((n) => ({ x: n.x - n.r - 3, y: n.y - n.r - 3, w: n.r * 2 + 6, h: n.r * 2 + 6 })),
      ];

      // edges: the hovered route burns brightest, the rest recede
      for (const e of s.edges) {
        const a = byId.get(e.from);
        const b = byId.get(e.to);
        if (!a || !b) continue;
        const style = relationshipStyle(e.type);
        const color = style.color ?? p.fg;
        const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const ux = (b.x - a.x) / dist;
        const uy = (b.y - a.y) / dist;
        const x1 = a.x + ux * (a.r + 4);
        const y1 = a.y + uy * (a.r + 4);
        const x2 = b.x - ux * (b.r + 6);
        const y2 = b.y - uy * (b.r + 6);
        const dim = hovered && hovered !== e.from && hovered !== e.to;
        ctx.globalAlpha = dim ? 0.3 : 1;
        ctx.strokeStyle = color;
        ctx.lineWidth = style.width;
        ctx.lineCap = "round";
        ctx.setLineDash(style.dash);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);
        // arrowhead at the target end
        const head = 7;
        const angle = Math.atan2(uy, ux);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - head * Math.cos(angle - 0.45), y2 - head * Math.sin(angle - 0.45));
        ctx.lineTo(x2 - head * Math.cos(angle + 0.45), y2 - head * Math.sin(angle + 0.45));
        ctx.closePath();
        ctx.fill();
        // type label: a third of the way out from the centre song, slid along the
        // edge until it clears every node disc, title plate and earlier label; on a
        // short edge it steps off to the side of the line instead
        const label = style.label;
        ctx.font = `500 10.5px ${SANS}`;
        const lw = ctx.measureText(label).width + 10;
        const place = (fromCentre: number, aside: number) => {
          const t = a.center ? fromCentre : 1 - fromCentre;
          return { x: x1 + (x2 - x1) * t - uy * aside, y: y1 + (y2 - y1) * t + ux * aside };
        };
        const tries: Array<[number, number]> = [0.34, 0.42, 0.26, 0.5, 0.58, 0.66, 0.74, 0.18].map((f) => [f, 0]);
        for (const aside of [14, -14, 22, -22, 30, -30]) {
          for (const f of [0.5, 0.42, 0.58, 0.34, 0.66]) tries.push([f, aside]);
        }
        let spot = place(0.34, 0);
        for (const [f, aside] of tries) {
          const c = place(f, aside);
          const box = { x: c.x - lw / 2, y: c.y - 8, w: lw, h: 16 };
          if (!blockers.some((o) => overlaps(box, o))) {
            spot = c;
            break;
          }
        }
        const mx = spot.x;
        const my = spot.y;
        blockers.push({ x: mx - lw / 2, y: my - 8, w: lw, h: 16 });
        ctx.fillStyle = p.labelBg;
        ctx.beginPath();
        ctx.roundRect(mx - lw / 2, my - 8, lw, 16, 8);
        ctx.fill();
        ctx.fillStyle = p.muted;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, mx, my + 0.5);
        ctx.globalAlpha = 1;
      }

      // nodes: covers in circles; the centre carries the orange cut
      for (const n of ordered) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.clip();
        const cover = n.song.artwork_url ? coverFor(n.song.artwork_url, kick) : null;
        if (cover) {
          ctx.drawImage(cover, n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
        } else {
          ctx.fillStyle = p.sunken;
          ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
        }
        if (n.center) {
          ctx.globalCompositeOperation = cover ? "multiply" : "source-over";
          ctx.fillStyle = p.signal;
          ctx.beginPath();
          ctx.arc(n.x + n.r, n.y, n.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = p.cutTint;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.restore();
        ctx.lineWidth = n.center ? 1.5 : 1;
        ctx.strokeStyle = n.center ? p.fg : p.border;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.stroke();
        if (hovered === n.id && !n.center) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = p.signal;
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r + 4, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // labels under the nodes
      for (const n of ordered) {
        const titleFont = n.center ? `650 13px ${SANS}` : `600 12px ${SANS}`;
        ctx.font = titleFont;
        const title = truncate(ctx, n.song.title, LABEL_WIDTH);
        const titleW = ctx.measureText(title).width;
        ctx.font = `400 11px ${SANS}`;
        const artist = truncate(ctx, n.song.artist, LABEL_WIDTH);
        const artistW = ctx.measureText(artist).width;
        const bw = Math.max(titleW, artistW) + 14;
        const top = n.y + n.r + 8;
        ctx.fillStyle = p.labelBg;
        ctx.beginPath();
        ctx.roundRect(n.x - bw / 2, top, bw, 34, 6);
        ctx.fill();
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.font = titleFont;
        ctx.fillStyle = hovered === n.id && !n.center ? p.signal : p.fg;
        ctx.fillText(title, n.x, top + 4);
        ctx.font = `400 11px ${SANS}`;
        ctx.fillStyle = p.muted;
        ctx.fillText(artist, n.x, top + 19);
      }
    };

    // ---- loop: run while something moves, then sleep ----
    const loop = () => {
      const peak = step();
      draw();
      if (peak > 0.04 || s.drag) {
        s.raf = requestAnimationFrame(loop);
      } else {
        s.raf = null;
      }
    };
    function kick() {
      if (s.raf === null) s.raf = requestAnimationFrame(loop);
    }

    // ---- size (HiDPI) ----
    const resize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.max(280, rect.width);
      const h = Math.max(320, rect.height);
      const sx = w / s.w;
      const sy = h / s.h;
      s.w = w;
      s.h = h;
      s.dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(w * s.dpr);
      canvas.height = Math.round(h * s.dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      s.nodes.forEach((n) => {
        n.x *= sx;
        n.y *= sy;
      });
      kick();
    };
    const rect = container.getBoundingClientRect();
    s.w = Math.max(280, rect.width);
    s.h = Math.max(320, rect.height);
    place();
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    // ---- theme and cover-style changes ----
    const themeObserver = new MutationObserver(() => {
      s.palette = readPalette();
      kick();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "data-covers"] });
    document.fonts?.ready.then(kick);

    // ---- pointer interaction ----
    const pointAt = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const hit = (x: number, y: number) => {
      for (let i = s.nodes.length - 1; i >= 0; i--) {
        const n = s.nodes[i];
        if (Math.hypot(x - n.x, y - n.y) <= n.r + 2) return n;
      }
      return null;
    };
    const onDown = (e: PointerEvent) => {
      const { x, y } = pointAt(e);
      const n = hit(x, y);
      if (n && !n.center) {
        s.drag = { id: n.id, startX: x, startY: y, moved: false };
        canvas.setPointerCapture(e.pointerId);
        kick();
      }
    };
    const onMove = (e: PointerEvent) => {
      const { x, y } = pointAt(e);
      if (s.drag) {
        const n = s.nodes.find((node) => node.id === s.drag?.id);
        if (n) {
          if (Math.hypot(x - s.drag.startX, y - s.drag.startY) > 5) s.drag.moved = true;
          n.x = Math.max(40, Math.min(s.w - 40, x));
          n.y = Math.max(40, Math.min(s.h - 40, y));
          n.vx = 0;
          n.vy = 0;
        }
        kick();
        return;
      }
      const n = hit(x, y);
      const next = n && !n.center ? n.id : null;
      canvas.style.cursor = next ? "pointer" : "default";
      if (next !== s.hover) {
        s.hover = next;
        kick();
      }
    };
    const onUp = (e: PointerEvent) => {
      const drag = s.drag;
      s.drag = null;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      if (drag && !drag.moved) {
        const n = s.nodes.find((node) => node.id === drag.id);
        if (n) navigateRef.current?.(n.song);
      }
      kick();
    };
    const onLeave = () => {
      if (!s.drag && s.hover) {
        s.hover = null;
        kick();
      }
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerleave", onLeave);

    return () => {
      resizeObserver.disconnect();
      themeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      if (s.raf !== null) cancelAnimationFrame(s.raf);
      s.raf = null;
    };
  }, [centerSong, relationships]);

  if (related === 0) {
    return <p className="py-10 text-center text-[13px] text-muted-foreground">No relationships to draw yet.</p>;
  }

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="relative h-[26rem] w-full overflow-hidden rounded-lg border border-border">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Relationship graph of ${centerSong.title}: ${related} related ${related === 1 ? "track" : "tracks"}. Use the list view to browse them with the keyboard.`}
          className="block touch-none"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Line styles">
          {RELATIONSHIP_TYPES.map((type) => (
            <li key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <RelationLine type={type} />
              {RELATIONSHIP_STYLES[type].label}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">Click a track to explore its relationships.</p>
      </div>
    </div>
  );
}
