import { cn } from "@/lib/utils";

export type ShapeKind = "circle" | "half" | "quarter" | "block";

interface ShapeProps {
  kind: ShapeKind;
  /** Rotation in quarter turns, clockwise. Half: 0 = flat edge down. Quarter: 0 = curve top-left. */
  turn?: 0 | 1 | 2 | 3;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * One piece of the moodboard's geometric vocabulary. Purely decorative:
 * colour it with text-* (fills with currentColor), size it with w-*.
 */
export function Shape({ kind, turn = 0, className, style }: ShapeProps) {
  return (
    <span
      aria-hidden
      className={cn("k-shape", `k-shape--${kind}`, className)}
      style={{ ...style, transform: turn ? `rotate(${turn * 90}deg)` : style?.transform }}
    />
  );
}
