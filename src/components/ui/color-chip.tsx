import { X } from "lucide-react";

import { cn } from "@/lib/utils";

interface ColorChipProps {
  /** The user's colour for this genre or tag (any CSS colour, usually #rrggbb). */
  color?: string;
  label: string;
  /** Shows a remove button; the chip itself stays text. */
  onRemove?: () => void;
  size?: "sm" | "md";
  className?: string;
  title?: string;
}

/**
 * A genre, subgenre or tag: a hairline pill with the user's colour as a dot.
 * The colour never fills the chip, so any stored colour stays legible on
 * both themes; orange stays reserved for state.
 */
export function ColorChip({ color, label, onRemove, size = "sm", className, title }: ColorChipProps) {
  return (
    <span
      title={title ?? label}
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-chip border border-border bg-background/40 text-foreground",
        size === "sm" ? "h-5 pl-1.5 text-[11px]" : "h-6 pl-2 text-xs",
        onRemove ? "pr-0.5" : size === "sm" ? "pr-2" : "pr-2.5",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("shrink-0 rounded-full", size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2")}
        style={{ backgroundColor: color || "hsl(var(--muted-foreground))" }}
      />
      <span className="truncate">{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${label}`}
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            size === "sm" ? "h-4 w-4" : "h-5 w-5",
          )}
        >
          <X className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
        </button>
      )}
    </span>
  );
}
