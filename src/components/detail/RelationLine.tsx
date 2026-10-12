import { relationshipStyle } from "@/lib/relationshipStyle";
import { cn } from "@/lib/utils";

/** A short sample of a relationship type's line (colour, weight, dash), for lists and legends. */
export function RelationLine({ type, className }: { type: string; className?: string }) {
  const style = relationshipStyle(type);
  return (
    <svg
      viewBox="0 0 24 8"
      aria-hidden
      className={cn("h-2 w-6 shrink-0", !style.color && "text-foreground", className)}
      style={style.color ? { color: style.color } : undefined}
    >
      <line
        x1="2"
        y1="4"
        x2="22"
        y2="4"
        stroke="currentColor"
        strokeWidth={style.width}
        strokeDasharray={style.dash.length ? style.dash.join(" ") : undefined}
        strokeLinecap="round"
      />
    </svg>
  );
}
