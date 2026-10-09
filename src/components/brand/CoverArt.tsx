import { useState } from "react";
import { Music2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface CoverArtProps {
  src?: string | null;
  /** Marks the current track: the orange cut sweeps in. */
  current?: boolean;
  className?: string;
  /** Icon size for the no-artwork fallback. */
  iconClassName?: string;
  /** Eager-load covers that sit in the first viewport. */
  eager?: boolean;
}

/**
 * A track cover in the editorial treatment: black and white by default
 * (Settings can switch to original colour), with the orange cut over the
 * current track. Decorative: the title next to it carries the meaning.
 */
export function CoverArt({ src, current = false, className, iconClassName, eager = false }: CoverArtProps) {
  const [failed, setFailed] = useState(false);
  const showImage = !!src && !failed;
  return (
    <span
      aria-hidden
      data-cut={current ? "on" : "off"}
      className={cn(
        "k-cover k-cut relative flex shrink-0 items-center justify-center overflow-hidden",
        !showImage && "k-cut--solid",
        className,
      )}
    >
      {showImage ? (
        <img src={src!} alt="" loading={eager ? "eager" : "lazy"} decoding="async" onError={() => setFailed(true)} />
      ) : (
        <Music2 className={cn("h-1/3 w-1/3 text-muted-foreground/60", iconClassName)} />
      )}
    </span>
  );
}
