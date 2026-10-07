import { useRef } from "react";
import { Check } from "lucide-react";

import { ENTITY_COLORS } from "@/lib/palette";
import { cn } from "@/lib/utils";

interface SwatchPickerProps {
  value: string;
  onChange: (hex: string) => void;
  /** Accessible group label, e.g. "Tag colour". */
  label: string;
  className?: string;
}

/**
 * Pick a colour for a tag, genre, block or set from the editorial palette.
 * A radio group with roving focus: Tab lands on the selected swatch, arrow
 * keys move and select. A stored colour outside the palette (older data) is
 * shown first so it stays selectable.
 */
export function SwatchPicker({ value, onChange, label, className }: SwatchPickerProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const inPalette = ENTITY_COLORS.some((c) => c.hex.toLowerCase() === value?.toLowerCase());
  const colors = inPalette || !value ? ENTITY_COLORS : [{ name: "Current colour", hex: value }, ...ENTITY_COLORS];
  const selectedIndex = Math.max(
    0,
    colors.findIndex((c) => c.hex.toLowerCase() === value?.toLowerCase()),
  );

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + colors.length) % colors.length;
    onChange(colors[next].hex);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-1.5", className)}>
      {colors.map((c, i) => {
        const selected = i === selectedIndex && !!value;
        return (
          <button
            key={c.hex}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={c.name}
            title={c.name}
            tabIndex={i === selectedIndex ? 0 : -1}
            onClick={() => onChange(c.hex)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "relative inline-flex h-7 w-7 items-center justify-center rounded-full ring-1 ring-inset ring-foreground/10 transition-transform duration-fast hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover",
              selected && "ring-2 ring-foreground ring-offset-2 ring-offset-popover",
            )}
            style={{ backgroundColor: c.hex }}
          >
            {selected && <Check className="h-3.5 w-3.5 text-white mix-blend-difference" strokeWidth={3} />}
          </button>
        );
      })}
    </div>
  );
}
