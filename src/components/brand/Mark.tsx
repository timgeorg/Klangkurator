import { useId } from "react";

import { cn } from "@/lib/utils";

interface MarkProps {
  className?: string;
  /** Accessible name. Omit when the mark sits next to the wordmark text. */
  title?: string;
}

/**
 * The Klangkurator asterisk. Same geometry as design-system/assets/mark.svg;
 * fills with currentColor (text-signal by default via className).
 */
export function Mark({ className, title }: MarkProps) {
  const maskId = `k-mark-cut-${useId().replace(/:/g, "")}`;
  return (
    <svg
      viewBox="0 0 64 64"
      fill="currentColor"
      className={cn("shrink-0 text-signal", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <mask id={maskId}>
          <rect width="64" height="64" fill="#fff" />
          <rect x="28.6" y="28.6" width="6.8" height="6.8" transform="rotate(45 32 32)" fill="#000" />
        </mask>
      </defs>
      <g mask={`url(#${maskId})`}>
        <rect x="26.4" y="3.5" width="11.2" height="57" transform="rotate(45 32 32)" />
        <rect x="26.4" y="3.5" width="11.2" height="57" transform="rotate(-45 32 32)" />
        <rect x="29.8" y="2" width="4.4" height="60" />
        <rect x="2" y="29.8" width="60" height="4.4" />
      </g>
    </svg>
  );
}
